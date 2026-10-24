import AVFoundation
import MediaPlayer
import UIKit

/// The audio side of AirPlay casting (docs/adrs/2026-10-23-airplay-display.md "TV audio").
///
/// - While a TV window is up (`enterTvMode`), the app's audio session is `.playback` with `.mixWithOthers`:
///   it plays with the ringer on silent, but a mixable session is never the Now Playing app, so it never
///   shows a "now playing" card on an Apple TV. `exitTvMode` puts back the session the app had before, so
///   the app's audio is unchanged when nothing is on the TV.
/// - MPNowPlayingInfoCenter is cleared and never set.
/// - Every route change is logged with the outputs and category.
/// - Choosing the AirPlay *audio* route (not Screen Mirroring) shows up as an `.airPlay` output with no
///   external screen. After the route settles (screen mirroring connects its screen a moment after its
///   audio) `onAudioOnlyAirPlay` fires, so the app can say "That sent sound only".
final class AudioRouteMonitor: NSObject {
  var onAudioOnlyAirPlay: ((String) -> Void)?
  /// Seams for tests.
  var hasExternalDisplay: () -> Bool = { false }
  var outputs: () -> [(type: AVAudioSession.Port, name: String)] = {
    AVAudioSession.sharedInstance().currentRoute.outputs.map { ($0.portType, $0.portName) }
  }
  var settleDelay: TimeInterval = 1.5
  private let log: NativeLog
  private let center: NotificationCenter
  private var observing = false
  private var pending: DispatchWorkItem?

  init(log: NativeLog = .shared, center: NotificationCenter = .default) {
    self.log = log
    self.center = center
    super.init()
  }

  /// Pure: an AirPlay audio output while no external display exists.
  static func isAudioOnlyAirPlay(outputs: [AVAudioSession.Port], hasExternalDisplay: Bool) -> Bool {
    outputs.contains(.airPlay) && !hasExternalDisplay
  }

  func start() {
    guard !observing else { return }
    observing = true
    center.addObserver(self, selector: #selector(routeChanged(_:)), name: AVAudioSession.routeChangeNotification, object: nil)
    center.addObserver(self, selector: #selector(interrupted(_:)), name: AVAudioSession.interruptionNotification, object: nil)
    logRoute("audio.route.initial", reason: "start")
  }

  func stop() {
    center.removeObserver(self)
    observing = false
    pending?.cancel()
  }

  private var saved: (category: AVAudioSession.Category, mode: AVAudioSession.Mode, options: AVAudioSession.CategoryOptions)?

  /// A TV window is up: mixable playback (never Now Playing), the previous session kept for `exitTvMode`.
  func enterTvMode() {
    let session = AVAudioSession.sharedInstance()
    if saved == nil { saved = (session.category, session.mode, session.categoryOptions) }
    do {
      try session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
      log.info("audio.session", ["category": session.category.rawValue, "options": Int(session.categoryOptions.rawValue), "mix_with_others": true, "tv": true])
    } catch {
      log.error("audio.session", ["error": error.localizedDescription, "tv": true])
    }
    MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
  }

  /// The TV window is gone: the app's own audio session again.
  func exitTvMode() {
    guard let prev = saved else { return }
    saved = nil
    let session = AVAudioSession.sharedInstance()
    do {
      try session.setCategory(prev.category, mode: prev.mode, options: prev.options)
      log.info("audio.session", ["category": session.category.rawValue, "options": Int(session.categoryOptions.rawValue), "tv": false])
    } catch {
      log.error("audio.session", ["error": error.localizedDescription, "tv": false])
    }
  }

  @objc private func routeChanged(_ note: Notification) {
    let raw = (note.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt) ?? 0
    let reason = AVAudioSession.RouteChangeReason(rawValue: raw).map(Self.reasonName) ?? "unknown"
    DispatchQueue.main.async { [weak self] in
      guard let self else { return }
      self.logRoute("audio.route", reason: reason)
      self.scheduleCheck()
    }
  }

  @objc private func interrupted(_ note: Notification) {
    let raw = (note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt) ?? 0
    DispatchQueue.main.async { [weak self] in
      self?.log.info("audio.interruption", ["began": raw == AVAudioSession.InterruptionType.began.rawValue])
    }
  }

  /// Re-checks once the route and any mirroring screen have settled.
  func scheduleCheck() {
    pending?.cancel()
    let work = DispatchWorkItem { [weak self] in self?.check() }
    pending = work
    DispatchQueue.main.asyncAfter(deadline: .now() + settleDelay, execute: work)
  }

  func check() {
    let outs = outputs()
    let external = hasExternalDisplay()
    if Self.isAudioOnlyAirPlay(outputs: outs.map { $0.type }, hasExternalDisplay: external) {
      let name = outs.first { $0.type == .airPlay }?.name ?? "TV"
      log.warn("audio.airplay_audio_only", ["receiver": name])
      onAudioOnlyAirPlay?(name)
    }
  }

  private func logRoute(_ type: String, reason: String) {
    let session = AVAudioSession.sharedInstance()
    let outs = outputs()
    log.info(type, [
      "reason": reason,
      "outputs": outs.map { "\($0.type.rawValue):\($0.name)" }.joined(separator: ","),
      "airplay": outs.contains { $0.type == .airPlay },
      "external_display": hasExternalDisplay(),
      "category": session.category.rawValue,
      "mix_with_others": session.categoryOptions.contains(.mixWithOthers),
      "now_playing_set": MPNowPlayingInfoCenter.default().nowPlayingInfo != nil,
    ])
  }

  static func reasonName(_ r: AVAudioSession.RouteChangeReason) -> String {
    switch r {
    case .newDeviceAvailable: return "new-device"
    case .oldDeviceUnavailable: return "old-device-gone"
    case .categoryChange: return "category-change"
    case .override: return "override"
    case .wakeFromSleep: return "wake"
    case .noSuitableRouteForCategory: return "no-route"
    case .routeConfigurationChange: return "config-change"
    case .unknown: return "unknown"
    @unknown default: return "other"
    }
  }
}
