import AVFoundation

/// Whether any AirPlay receiver (an Apple TV, an AirPlay TV) is on this network: AVRouteDetector. The app
/// lists "Apple TV / AirPlay" as a TV only when one is (or a display is already connected), so a home with
/// no AirPlay TV still sees "No TV found" and the browser-TV way. Detection costs power, so it runs for a
/// while after each `detect` (the picker's search), not all the time. Main thread only.
final class RouteDetector: NSObject {
  var onChange: ((Bool) -> Void)?
  private let detector = AVRouteDetector()
  private var observation: NSKeyValueObservation?
  private var stopWork: DispatchWorkItem?
  private let log: NativeLog
  private(set) var available = false

  init(log: NativeLog = .shared) {
    self.log = log
    super.init()
  }

  /// Look for AirPlay receivers for `seconds`, reporting every change.
  func detect(seconds: Double) {
    if observation == nil {
      observation = detector.observe(\.multipleRoutesDetected, options: [.initial, .new]) { [weak self] d, _ in
        let found = d.multipleRoutesDetected
        DispatchQueue.main.async { self?.update(found) }
      }
    }
    detector.isRouteDetectionEnabled = true
    stopWork?.cancel()
    let work = DispatchWorkItem { [weak self] in self?.detector.isRouteDetectionEnabled = false }
    stopWork = work
    DispatchQueue.main.asyncAfter(deadline: .now() + max(1, seconds), execute: work)
  }

  func stop() {
    stopWork?.cancel()
    detector.isRouteDetectionEnabled = false
    observation?.invalidate()
    observation = nil
  }

  private func update(_ found: Bool) {
    guard found != available else { return }
    available = found
    log.info("airplay.routes", ["available": found])
    onChange?(found)
  }
}
