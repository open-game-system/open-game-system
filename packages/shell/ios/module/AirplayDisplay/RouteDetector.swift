import AVFoundation

/// Whether any AirPlay receiver (an Apple TV, an AirPlay TV) is on this network: AVRouteDetector. The app
/// lists "Apple TV / AirPlay" as a TV only when one is (or a display is already connected), so a home with
/// no AirPlay TV still sees "No TV found" and the browser-TV way. Detection costs power, so it runs for a
/// while after each `detect` (the picker's search), not all the time. Main thread only.
final class RouteDetector: NSObject {
  var onChange: ((Bool) -> Void)?
  private let detector = AVRouteDetector()
  private var observing = false
  private let center: NotificationCenter
  private var stopWork: DispatchWorkItem?
  private let log: NativeLog
  private(set) var available = false

  init(log: NativeLog = .shared, center: NotificationCenter = .default) {
    self.log = log
    self.center = center
    super.init()
  }

  /// Look for AirPlay receivers for `seconds`, reporting every change.
  func detect(seconds: Double) {
    // A notification, not KVO: Swift KVO on multipleRoutesDetected crashes (it isn't KVO-compliant).
    if !observing {
      observing = true
      center.addObserver(self, selector: #selector(changed(_:)), name: .AVRouteDetectorMultipleRoutesDetectedDidChange, object: detector)
    }
    detector.isRouteDetectionEnabled = true
    update(detector.multipleRoutesDetected)
    stopWork?.cancel()
    let work = DispatchWorkItem { [weak self] in self?.detector.isRouteDetectionEnabled = false }
    stopWork = work
    DispatchQueue.main.asyncAfter(deadline: .now() + max(1, seconds), execute: work)
  }

  func stop() {
    stopWork?.cancel()
    detector.isRouteDetectionEnabled = false
    center.removeObserver(self)
    observing = false
  }

  @objc private func changed(_ note: Notification) {
    DispatchQueue.main.async { [weak self] in
      guard let self else { return }
      self.update(self.detector.multipleRoutesDetected)
    }
  }

  private func update(_ found: Bool) {
    guard found != available else { return }
    available = found
    log.info("airplay.routes", ["available": found])
    onChange?(found)
  }
}
