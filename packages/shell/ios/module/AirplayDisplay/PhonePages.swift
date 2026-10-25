import UIKit
import WebKit

/// The phone's own WebViews (the game's controller page), as opposed to the TV window's.
enum PhonePages {
  /// Every WKWebView in the app's phone windows.
  static func webViews() -> [WKWebView] {
    UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .filter { !ExternalDisplayController.isExternalRole($0.session.role) }
      .flatMap { $0.windows }
      .filter { $0.screen === UIScreen.main }
      .flatMap { find(in: $0) }
  }

  private static func find(in view: UIView) -> [WKWebView] {
    if let web = view as? WKWebView { return [web] }
    return view.subviews.flatMap { find(in: $0) }
  }

  /// A flat string map as a JSON object literal; nil when empty.
  static func json(_ context: [String: String]) -> String? {
    guard !context.isEmpty, let data = try? JSONSerialization.data(withJSONObject: context, options: [.sortedKeys]) else { return nil }
    return String(data: data, encoding: .utf8)
  }

  /// What the phone page is told: `window.__OGS_TV__` (is the app's TV window on?), the app's log ids
  /// as `window.__OGS_LOG__` when it has any, and an `ogs:tv` event with `{ connected }`. A page that
  /// plays sound goes quiet while the TV is on (the TV page plays it there).
  static func script(connected: Bool, logContext: [String: String]) -> String {
    var js = ""
    if let ctx = json(logContext) { js += "window.__OGS_LOG__ = \(ctx); " }
    js += "window.__OGS_TV__ = \(connected); "
    js += "window.dispatchEvent(new CustomEvent('ogs:tv', { detail: { connected: \(connected) } })); true;"
    return js
  }

  /// Tells the phone's WebViews whether the TV window is on (`script`), and logs what it found,
  /// including whether each may AirPlay media (react-native-webview defaults
  /// allowsAirPlayForMediaPlayback to false; this proves it on the device).
  static func notify(connected: Bool, logContext: [String: String], log: NativeLog) {
    let views = webViews()
    let js = script(connected: connected, logContext: logContext)
    for web in views { web.evaluateJavaScript(js, completionHandler: nil) }
    log.info("phone_webview.notify", [
      "connected": connected,
      "webviews": views.count,
      "airplay_media": views.map { $0.configuration.allowsAirPlayForMediaPlayback ? "on" : "off" }.joined(separator: ","),
      "url": views.first?.url.map { "\($0.host ?? "")\($0.path)" } ?? "",
    ])
  }
}
