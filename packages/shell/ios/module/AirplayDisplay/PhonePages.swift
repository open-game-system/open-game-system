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

  /// Logs the phone's WebViews when the TV window comes or goes, including whether each may AirPlay media
  /// (react-native-webview defaults allowsAirPlayForMediaPlayback to false; this proves it on the device).
  static func report(connected: Bool, log: NativeLog) {
    let views = webViews()
    log.info("phone_webview.notify", [
      "connected": connected,
      "webviews": views.count,
      "airplay_media": views.map { $0.configuration.allowsAirPlayForMediaPlayback ? "on" : "off" }.joined(separator: ","),
      "url": views.first?.url.map { "\($0.host ?? "")\($0.path)" } ?? "",
    ])
  }
}
