import ExpoModulesCore
import UIKit

/// AirPlay casting for the OGS shell (docs/adrs/2026-10-23-airplay-display.md): when the user picks
/// Control Center > Screen Mirroring, iOS hands the app an external display. This module puts a second,
/// full-screen WKWebView on it with the TV page (the OGS TV launcher), rendered by this phone, while the
/// phone keeps the game's controller. It also watches the audio route (sound-only AirPlay), looks for
/// AirPlay receivers, keeps the phone awake while it draws the TV, and logs every step (native client log).
///
/// iOS can't start mirroring for an app; the shell's sheet shows the Control Center steps. There is no
/// AirPlay route picker on purpose: AVRoutePickerView only routes audio and media.
public class OgsAirplayDisplayModule: Module {
  private lazy var controller = ExternalDisplayController()
  private lazy var audio = AudioRouteMonitor()
  private lazy var routes = RouteDetector()

  public func definition() -> ModuleDefinition {
    Name("OgsAirplayDisplay")

    Events("onConnect", "onDisconnect", "onLog", "onAudioOnlyAirPlay", "onRoutes")

    OnCreate {
      DispatchQueue.main.async { [weak self] in
        guard let self else { return }
        NativeLog.shared.sink = { [weak self] event in self?.sendEvent("onLog", event.payload) }
        self.controller.onChange = { [weak self] connected, info in
          guard let self else { return }
          if connected, let info {
            self.audio.enterTvMode()
            self.sendEvent("onConnect", info.payload)
          } else {
            self.audio.exitTvMode()
            self.sendEvent("onDisconnect", [:])
          }
          PhonePages.notify(connected: connected, logContext: self.controller.logContext, log: NativeLog.shared)
          self.audio.scheduleCheck()
        }
        self.audio.hasExternalDisplay = { [weak self] in self?.controller.isConnected ?? false }
        self.audio.onAudioOnlyAirPlay = { [weak self] name in self?.sendEvent("onAudioOnlyAirPlay", ["name": name]) }
        self.routes.onChange = { [weak self] available in self?.sendEvent("onRoutes", ["available": available]) }
        self.controller.startObserving()
        self.audio.start()
      }
    }

    OnDestroy {
      DispatchQueue.main.async { [weak self] in
        self?.controller.stopObserving()
        self?.audio.stop()
        self?.routes.stop()
        NativeLog.shared.sink = nil
      }
    }

    /// Show this TV page on the external display (now, or when one connects).
    AsyncFunction("start") { (tvUrl: String) in
      guard let url = URL(string: tvUrl), let scheme = url.scheme, ["https", "http"].contains(scheme) else {
        throw InvalidTvUrlException(TvViewController.safeUrl(URL(string: tvUrl)))
      }
      self.controller.start(url)
    }.runOnQueue(.main)

    /// The app's name on the TV's idle card and "Open <name> to keep the TV going".
    AsyncFunction("setAppName") { (name: String) in
      self.controller.appName = name
    }.runOnQueue(.main)

    /// The TV's idle card: the line under the app's name and its colour ("#rrggbb"; "" keeps the OGS one).
    AsyncFunction("setIdleCard") { (line: String, background: String) in
      self.controller.idleCard = IdleCard(line: line.isEmpty ? IdleCard.defaultLine : line, background: background.isEmpty ? nil : background)
    }.runOnQueue(.main)

    /// The app's log ids (flat strings), handed to the TV page (window.__OGS_LOG__ at document start) and
    /// to the phone page with each `ogs:tv`, so their log lines carry the app's device.
    AsyncFunction("setLogContext") { (context: [String: String]) in
      self.controller.logContext = context
    }.runOnQueue(.main)

    /// Tells the phone page whether the TV window is on again (call when the page says it is ready:
    /// a page that loaded after the display connected missed the `ogs:tv` event).
    AsyncFunction("syncPhonePages") {
      PhonePages.notify(connected: self.controller.isConnected, logContext: self.controller.logContext, log: NativeLog.shared)
    }.runOnQueue(.main)

    /// Back to the idle card on the TV.
    AsyncFunction("stop") {
      self.controller.stop()
    }.runOnQueue(.main)

    /// The connected display's name and size, or null.
    AsyncFunction("currentDisplay") { () -> [String: Any]? in
      self.controller.refresh()
      guard let host = self.controller.host else { return nil }
      return DisplayInfo(
        name: ExternalDisplayController.displayName(),
        width: Double(host.bounds.width),
        height: Double(host.bounds.height)
      ).payload
    }.runOnQueue(.main)

    /// Look for AirPlay receivers on this network for `seconds` (onRoutes reports changes); returns what is known now.
    AsyncFunction("detectRoutes") { (seconds: Double) -> Bool in
      self.routes.detect(seconds: seconds)
      return self.routes.available
    }.runOnQueue(.main)

    /// Native log events after `seq` (0: everything still in the ring), for JS that started listening late.
    AsyncFunction("recentLog") { (after: Int) -> [[String: Any]] in
      NativeLog.shared.since(after).map { $0.payload }
    }.runOnQueue(.main)

    /// A JS-side event worth having in os_log too.
    AsyncFunction("log") { (type: String, level: String, data: [String: Any]) in
      NativeLog.shared.emit(type, level, data)
    }.runOnQueue(.main)
  }
}

final class InvalidTvUrlException: GenericException<String>, @unchecked Sendable {
  override var reason: String { "Not an http(s) TV URL: \(param)" }
}
