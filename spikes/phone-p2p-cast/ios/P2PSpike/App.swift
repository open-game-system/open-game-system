import SwiftUI
import UIKit

/// Spike app (docs/exec-plans/active/2026-10-25-phone-p2p-cast.md).
///   -mode native (default)  the phone shows its controller; a hidden 1280×720 WKWebView renders the
///                           TV page; native snapshots → libwebrtc (VideoToolbox H.264) → the TV.
///   -mode web|snap|snapstream   the first spike's approaches (Legacy.swift).
/// Arguments: -tv <TV page URL> -controller <phone page URL> -server <spike server> -stamp 1
///            -name <player name> -place behind|offscreen
@main
struct P2PSpikeApp: App {
  var body: some Scene {
    WindowGroup {
      Group {
        if ["web", "snap", "snapstream"].contains(UserDefaults.standard.string(forKey: "mode") ?? "native") {
          LegacyRoot()
        } else {
          NativeRoot()
        }
      }.ignoresSafeArea()
    }
  }
}

struct NativeRoot: UIViewControllerRepresentable {
  func makeUIViewController(context: Context) -> NativeController { NativeController() }
  func updateUIViewController(_ vc: NativeController, context: Context) {}
}
