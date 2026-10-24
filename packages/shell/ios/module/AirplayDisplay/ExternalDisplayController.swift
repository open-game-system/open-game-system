import AVFoundation
import UIKit
import WebKit

/// Where the TV window lives: a window scene the system gave the app for an external display
/// (scene-based apps), or a bare external `UIScreen` (apps on the app-delegate life cycle, which
/// is what an Expo app is unless it adds a scene manifest).
enum ExternalHost: Equatable {
  case scene(UIWindowScene)
  case screen(UIScreen)

  var bounds: CGRect {
    switch self {
    case .scene(let scene): return scene.coordinateSpace.bounds
    case .screen(let screen): return screen.bounds
    }
  }
}

/// What the phone tells JS when a display connects.
struct DisplayInfo {
  let name: String
  let width: Double
  let height: Double

  var payload: [String: Any] { ["name": name, "width": width, "height": height] }
}

/// Finds the external display, puts a full-screen TV window on it and keeps it in step with
/// connects, disconnects, the TV URL (the OGS TV launcher a cast's LOAD_VIEW names) and the app going
/// to the background. Keeps the phone awake while a TV page is on a display. Main thread only.
final class ExternalDisplayController: NSObject {
  /// connected: true with the display's info, false on disconnect.
  var onChange: ((Bool, DisplayInfo?) -> Void)?

  private(set) var tvUrl: URL?
  private(set) var host: ExternalHost?
  private(set) var window: UIWindow?
  private var tvController: TvViewController?
  private var observing = false
  private var geometryObservation: NSKeyValueObservation?
  private let center: NotificationCenter

  /// Seams for tests: the scenes and screens the controller looks at.
  var connectedScenes: () -> Set<UIScene> = { UIApplication.shared.connectedScenes }
  var screens: () -> [UIScreen] = { UIScreen.screens }
  var mainScreen: () -> UIScreen = { UIScreen.main }
  var isAppActive: () -> Bool = { UIApplication.shared.applicationState == .active }
  var makeWindow: (ExternalHost) -> UIWindow = ExternalDisplayController.window(on:)
  var log: NativeLog = .shared
  /// Keep-awake: the phone must not auto-lock while it is drawing the TV (a locked phone stops the TV).
  var setIdleTimerDisabled: (Bool) -> Void = { UIApplication.shared.isIdleTimerDisabled = $0 }
  private(set) var keepingAwake = false
  /// The app's name on the TV's idle card and notice (JS sets it: the bundle's name may be a slug).
  var appName: String = appDisplayName() {
    didSet { tvController?.appName = appName }
  }

  init(center: NotificationCenter = .default) {
    self.center = center
    super.init()
  }

  var isConnected: Bool { host != nil }

  func startObserving() {
    guard !observing else { return }
    observing = true
    let names: [Notification.Name] = [
      UIScreen.didConnectNotification,
      UIScreen.didDisconnectNotification,
      UIScene.willConnectNotification,
      UIScene.didDisconnectNotification,
    ]
    for name in names {
      center.addObserver(self, selector: #selector(displaysChanged(_:)), name: name, object: nil)
    }
    // A TV can change mode mid-session (an AirPlay receiver switching resolution; the Simulator's
    // display connects at 720×480, then goes 1080p): the TV window follows the screen's new bounds.
    center.addObserver(self, selector: #selector(displayModeChanged(_:)), name: UIScreen.modeDidChangeNotification, object: nil)
    center.addObserver(self, selector: #selector(appResigned(_:)), name: UIApplication.willResignActiveNotification, object: nil)
    center.addObserver(self, selector: #selector(appResigned(_:)), name: UIApplication.didEnterBackgroundNotification, object: nil)
    center.addObserver(self, selector: #selector(appActive(_:)), name: UIApplication.didBecomeActiveNotification, object: nil)
    center.addObserver(self, selector: #selector(appActive(_:)), name: UIApplication.willEnterForegroundNotification, object: nil)
    log.info("display.observe", ["screens": screens().count, "external": findExternalHost() != nil])
    refresh()
  }

  func stopObserving() {
    center.removeObserver(self)
    observing = false
  }

  /// Show this TV page (on the display now, or as soon as one connects).
  func start(_ url: URL) {
    tvUrl = Self.withExtraQuery(url)
    if let shown = tvUrl { tvController?.load(shown) }
    refresh()
    syncKeepAwake()
  }

  /// Back to the idle card; the window stays so the TV never mirrors the phone's own screen.
  func stop() {
    tvUrl = nil
    tvController?.showIdle()
    syncKeepAwake()
  }

  /// Awake exactly while a TV page is on a connected display.
  private func syncKeepAwake() {
    let want = host != nil && tvUrl != nil
    guard want != keepingAwake else { return }
    keepingAwake = want
    setIdleTimerDisabled(want)
    log.info("keep_awake", ["on": want])
  }

  @objc private func displaysChanged(_ note: Notification) {
    logNotification(note)
    // A scene's role is set before willConnect is posted; screens may settle a moment later.
    refresh()
    DispatchQueue.main.async { [weak self] in self?.refresh() }
  }

  @objc private func displayModeChanged(_ note: Notification) {
    if let screen = note.object as? UIScreen { log.info("screen.mode", Self.screenInfo(screen)) }
    refresh()
    DispatchQueue.main.async { [weak self] in self?.refresh() }
  }

  @objc private func appResigned(_ note: Notification) {
    let type = note.name == UIApplication.didEnterBackgroundNotification ? "app.background" : "app.resign_active"
    log.info(type, ["tv_window": tvController != nil, "idle_timer_disabled": UIApplication.shared.isIdleTimerDisabled])
    tvController?.setAwayNotice(true)
  }

  @objc private func appActive(_ note: Notification) {
    let type = note.name == UIApplication.didBecomeActiveNotification ? "app.active" : "app.foreground"
    log.info(type, ["tv_window": tvController != nil, "external": host != nil, "idle_timer_disabled": UIApplication.shared.isIdleTimerDisabled])
    if note.name == UIApplication.didBecomeActiveNotification, !Self.noticePinned { tvController?.setAwayNotice(false) }
  }

  private func logNotification(_ note: Notification) {
    switch note.name {
    case UIScreen.didConnectNotification, UIScreen.didDisconnectNotification:
      let type = note.name == UIScreen.didConnectNotification ? "screen.connect" : "screen.disconnect"
      var data: [String: Any] = ["screens": screens().count]
      if let screen = note.object as? UIScreen { data.merge(Self.screenInfo(screen)) { a, _ in a } }
      log.info(type, data)
    default:
      let type = note.name == UIScene.willConnectNotification ? "scene.connect" : "scene.disconnect"
      var data: [String: Any] = [:]
      if let scene = note.object as? UIScene {
        data["role"] = scene.session.role.rawValue
        data["external_role"] = Self.isExternalRole(scene.session.role)
        if let ws = scene as? UIWindowScene {
          data.merge(Self.screenInfo(ws.screen)) { a, _ in a }
          data["scene_w"] = Double(ws.coordinateSpace.bounds.width)
          data["scene_h"] = Double(ws.coordinateSpace.bounds.height)
        }
      }
      log.info(type, data)
    }
  }

  /// Size, scale, mode and mirroring of a screen, for the log.
  static func screenInfo(_ screen: UIScreen) -> [String: Any] {
    var data: [String: Any] = [
      "w": Double(screen.bounds.width),
      "h": Double(screen.bounds.height),
      "scale": Double(screen.scale),
      "native_w": Double(screen.nativeBounds.width),
      "native_h": Double(screen.nativeBounds.height),
      "main": screen === UIScreen.main,
      "mirrored": screen.mirrored != nil,
      "max_fps": screen.maximumFramesPerSecond,
      "capture": screen.isCaptured,
    ]
    if let mode = screen.currentMode {
      data["mode_w"] = Double(mode.size.width)
      data["mode_h"] = Double(mode.size.height)
    }
    if let preferred = screen.preferredMode { data["preferred_w"] = Double(preferred.size.width) }
    data["overscan"] = screen.overscanCompensation.rawValue
    return data
  }

  /// AIRPLAY_DISPLAY_TV_QUERY (simctl launch env SIMCTL_CHILD_…), e.g. "tv3d-continuous&tv3d-hud": added to
  /// the TV page's query (simulator tests and frame-rate checks). Unset in normal use.
  static let extraQuery = ProcessInfo.processInfo.environment["AIRPLAY_DISPLAY_TV_QUERY"] ?? ""

  static func withExtraQuery(_ url: URL) -> URL {
    guard !extraQuery.isEmpty, var parts = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return url }
    parts.percentEncodedQuery = [parts.percentEncodedQuery, extraQuery].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: "&")
    return parts.url ?? url
  }

  /// AIRPLAY_DISPLAY_SHOW_NOTICE=1 (simctl launch env SIMCTL_CHILD_…) keeps the notice up, for screenshots.
  static let noticePinned = ProcessInfo.processInfo.environment["AIRPLAY_DISPLAY_SHOW_NOTICE"] == "1"

  /// Finds the external display and (re)builds or tears down the TV window to match.
  func refresh() {
    let next = findExternalHost()
    if next == host {
      fitWindowToHost()
      return
    }
    tearDown()
    if let next { attach(to: next) }
    syncKeepAwake()
  }

  /// Keeps the TV window the size of its display (the WKWebView and idle card autoresize with it).
  private func fitWindowToHost() {
    guard let host, let window else { return }
    let bounds = host.bounds
    if window.frame != bounds {
      log.info("display.resize", ["w": Double(bounds.width), "h": Double(bounds.height)])
      window.frame = bounds
    }
  }

  func findExternalHost() -> ExternalHost? {
    for scene in connectedScenes() {
      if let windowScene = scene as? UIWindowScene, Self.isExternalRole(windowScene.session.role) {
        return .scene(windowScene)
      }
    }
    let main = mainScreen()
    if let screen = screens().first(where: { $0 !== main }) {
      return .screen(screen)
    }
    return nil
  }

  static func isExternalRole(_ role: UISceneSession.Role) -> Bool {
    if #available(iOS 16.0, *), role == .windowExternalDisplayNonInteractive { return true }
    return role.rawValue == "UIWindowSceneSessionRoleExternalDisplay"
  }

  private func attach(to next: ExternalHost) {
    var info: [String: Any] = ["kind": { if case .scene = next { return "scene" } else { return "screen" } }(), "w": Double(next.bounds.width), "h": Double(next.bounds.height), "has_view": tvUrl != nil]
    switch next {
    case .scene(let scene): info.merge(Self.screenInfo(scene.screen)) { a, _ in a }
    case .screen(let screen): info.merge(Self.screenInfo(screen)) { a, _ in a }
    }
    log.info("display.attach", info)
    let controller = TvViewController()
    controller.appName = appName
    controller.log = log
    let win = makeWindow(next)
    win.frame = next.bounds
    win.rootViewController = controller
    win.backgroundColor = .black
    win.isHidden = false
    host = next
    window = win
    tvController = controller
    if case .scene(let scene) = next, #available(iOS 16.0, *) {
      geometryObservation = scene.observe(\.effectiveGeometry, options: [.new]) { [weak self] _, _ in
        DispatchQueue.main.async { self?.fitWindowToHost() }
      }
    }
    if let url = tvUrl { controller.load(url) } else { controller.showIdle() }
    controller.setAwayNotice(Self.noticePinned || !isAppActive())
    let size = next.bounds.size
    onChange?(true, DisplayInfo(name: Self.displayName(), width: Double(size.width), height: Double(size.height)))
  }

  static func window(on host: ExternalHost) -> UIWindow {
    switch host {
    case .scene(let scene):
      return UIWindow(windowScene: scene)
    case .screen(let screen):
      let win = UIWindow(frame: screen.bounds)
      win.screen = screen
      return win
    }
  }

  private func tearDown() {
    guard host != nil else { return }
    log.info("display.detach", [:])
    geometryObservation?.invalidate()
    geometryObservation = nil
    window?.isHidden = true
    window?.rootViewController = nil
    window = nil
    tvController = nil
    host = nil
    onChange?(false, nil)
  }

  /// The AirPlay receiver's name ("Living Room") when the audio route says so; else generic.
  static func displayName() -> String {
    let outputs = AVAudioSession.sharedInstance().currentRoute.outputs
    if let airplay = outputs.first(where: { $0.portType == .airPlay }) { return airplay.portName }
    return "TV"
  }
}

/// The app's name as the home screen shows it ("OpenGame", "Settlewood"): the TV's idle card and notice.
func appDisplayName() -> String {
  let info = Bundle.main.infoDictionary
  return (info?["CFBundleDisplayName"] as? String) ?? (info?["CFBundleName"] as? String) ?? "the app"
}

/// The TV window's content: the TV page (the OGS TV launcher) full screen, a calm idle card before
/// anything is cast, and the "Open <app> to keep the TV going" notice while the phone app is away.
final class TvViewController: UIViewController, WKNavigationDelegate {
  private(set) var webView: WKWebView!
  var log: NativeLog = .shared
  private var loadStarted = Date()
  private let idle = UIView()
  private let notice = UILabel()
  private let idleTitle = UILabel()
  var appName: String = appDisplayName() {
    didSet { applyName() }
  }
  private(set) var loadedUrl: URL?

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = UIColor(red: 0.07, green: 0.06, blue: 0.13, alpha: 1)

    let config = WKWebViewConfiguration()
    config.allowsInlineMediaPlayback = true
    config.mediaTypesRequiringUserActionForPlayback = []
    config.applicationNameForUserAgent = "OgsTV/airplay"
    // The TV page is shown in a window on the external display, never handed to AirPlay as media.
    config.allowsAirPlayForMediaPlayback = false
    config.allowsPictureInPictureMediaPlayback = false
    webView = WKWebView(frame: view.bounds, configuration: config)
    webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    webView.isOpaque = false
    webView.backgroundColor = .clear
    webView.scrollView.isScrollEnabled = false
    webView.scrollView.contentInsetAdjustmentBehavior = .never
    webView.navigationDelegate = self
    webView.accessibilityIdentifier = "airplayTvWebView"
    view.addSubview(webView)

    buildIdleCard()
    buildNotice()
    if let url = loadedUrl { webView.load(URLRequest(url: url)) }
    applyIdle(loadedUrl == nil)
  }

  func load(_ url: URL) {
    if loadedUrl == url, webView?.url != nil { return }
    loadedUrl = url
    guard isViewLoaded else { return }
    loadStarted = Date()
    webView.load(URLRequest(url: url))
    applyIdle(false)
  }

  func showIdle() {
    loadedUrl = nil
    guard isViewLoaded else { return }
    webView.loadHTMLString("", baseURL: nil)
    applyIdle(true)
  }

  /// Shown at once (the app is about to stop drawing, so no animation), hidden with a fade.
  func setAwayNotice(_ away: Bool) {
    loadViewIfNeeded()
    if away {
      notice.layer.removeAllAnimations()
      notice.alpha = 1
      view.layoutIfNeeded()
      CATransaction.flush()
    } else {
      UIView.animate(withDuration: 0.3) { self.notice.alpha = 0 }
    }
  }

  var isShowingNotice: Bool { notice.alpha > 0.5 }
  var noticeText: String? { notice.text }
  var idleTitleText: String? { idleTitle.text }

  private func applyName() {
    idleTitle.text = appName
    notice.text = "Open \(appName) to keep the TV going"
  }
  var isIdle: Bool { !idle.isHidden }

  private func applyIdle(_ on: Bool) {
    idle.isHidden = !on
    webView.isHidden = on
  }

  private func buildIdleCard() {
    idle.frame = view.bounds
    idle.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    let title = idleTitle
    title.font = UIFont(name: "Georgia-Bold", size: 72) ?? .boldSystemFont(ofSize: 72)
    title.textColor = UIColor(red: 0.98, green: 0.95, blue: 0.89, alpha: 1)
    let line = UILabel()
    line.text = "Pick a game on your phone to show it here."
    line.font = UIFont(name: "Georgia", size: 32) ?? .systemFont(ofSize: 32)
    line.textColor = UIColor(red: 0.98, green: 0.95, blue: 0.89, alpha: 0.8)
    let stack = UIStackView(arrangedSubviews: [title, line])
    stack.axis = .vertical
    stack.alignment = .center
    stack.spacing = 20
    stack.translatesAutoresizingMaskIntoConstraints = false
    idle.addSubview(stack)
    NSLayoutConstraint.activate([
      stack.centerXAnchor.constraint(equalTo: idle.centerXAnchor),
      stack.centerYAnchor.constraint(equalTo: idle.centerYAnchor),
    ])
    idle.accessibilityIdentifier = "airplayTvIdle"
    view.addSubview(idle)
  }

  /// Sits along the bottom edge, away from the game's focal area.
  private func buildNotice() {
    applyName()
    notice.font = UIFont(name: "Georgia", size: 30) ?? .systemFont(ofSize: 30)
    notice.textColor = UIColor(red: 0.98, green: 0.95, blue: 0.89, alpha: 1)
    notice.backgroundColor = UIColor(red: 0.11, green: 0.09, blue: 0.2, alpha: 0.9)
    notice.textAlignment = .center
    notice.layer.cornerRadius = 18
    notice.layer.masksToBounds = true
    notice.alpha = 0
    notice.accessibilityIdentifier = "airplayTvAwayNotice"
    notice.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(notice)
    NSLayoutConstraint.activate([
      notice.centerXAnchor.constraint(equalTo: view.centerXAnchor),
      notice.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -40),
      notice.heightAnchor.constraint(equalToConstant: 64),
      notice.widthAnchor.constraint(equalToConstant: 760),
    ])
  }

  func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
    loadStarted = Date()
    log.info("tv_webview.start", ["url": Self.safeUrl(webView.url)])
  }

  func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
    guard loadedUrl != nil else { return }
    log.info("tv_webview.finish", ["url": Self.safeUrl(webView.url), "ms": Int(Date().timeIntervalSince(loadStarted) * 1000), "airplay_media": webView.configuration.allowsAirPlayForMediaPlayback])
  }

  func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
    logFailure("tv_webview.fail", error)
    retrySoon()
  }

  func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
    logFailure("tv_webview.fail_provisional", error)
    retrySoon()
  }

  func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
    log.error("tv_webview.process_terminated", ["url": Self.safeUrl(webView.url)])
    if let url = loadedUrl { webView.load(URLRequest(url: url)) }
  }

  private func logFailure(_ type: String, _ error: Error) {
    let ns = error as NSError
    log.error(type, ["domain": ns.domain, "code": ns.code, "description": ns.localizedDescription, "url": Self.safeUrl((ns.userInfo[NSURLErrorFailingURLStringErrorKey] as? String).flatMap(URL.init(string:)))])
  }

  /// Host and path only: the launcher URL's query carries its token, which never goes in a log.
  static func safeUrl(_ url: URL?) -> String {
    guard let url else { return "" }
    return "\(url.host ?? "")\(url.path)"
  }

  /// A TV page that fails to load (Wi-Fi blip) tries again rather than leaving a blank TV.
  private func retrySoon() {
    guard let url = loadedUrl else { return }
    DispatchQueue.main.asyncAfter(deadline: .now() + 3) { [weak self] in
      guard let self, self.loadedUrl == url else { return }
      self.webView.load(URLRequest(url: url))
    }
  }
}
