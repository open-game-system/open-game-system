import Foundation
import UIKit

/// Every 5 s: capture (ticks, frames, drops, snapshot and render ms), the encoder (fps, ms per frame,
/// kbps, quality limit, implementation), this app's CPU (all threads; the WebContent process that
/// draws the TV page is separate and not counted), thermal state and battery. Posted to the spike
/// server's /metrics and shown in one line at the bottom of the controller.
final class Metrics {
  private let server: String
  private let capture: FrameCapture
  private let streamer: Streamer
  private let show: (String) -> Void
  private var last: [String: Double] = [:]
  private var lastAt = CACurrentMediaTime()

  init(server: String, capture: FrameCapture, streamer: Streamer, show: @escaping (String) -> Void) {
    self.server = server
    self.capture = capture
    self.streamer = streamer
    self.show = show
    UIDevice.current.isBatteryMonitoringEnabled = true
  }

  func start() {
    Timer.scheduledTimer(withTimeInterval: 5, repeats: true) { [weak self] _ in self?.sample() }
  }

  private func sample() {
    let now = CACurrentMediaTime()
    let dt = now - lastAt
    lastAt = now
    let c = capture.drain()
    streamer.stats { [weak self] s in
      guard let self else { return }
      let num = { (k: String) in (s[k] as? NSNumber)?.doubleValue ?? 0 }
      let enc = num("framesEncoded"), encT = num("totalEncodeTime"), bytes = num("bytesSent")
      let dEnc = enc - (self.last["enc"] ?? enc)
      let encodeMs = dEnc > 0 ? (encT - (self.last["encT"] ?? encT)) / dEnc * 1000 : 0
      let kbps = (bytes - (self.last["bytes"] ?? bytes)) * 8 / dt / 1000
      self.last = ["enc": enc, "encT": encT, "bytes": bytes]
      let thermal = ["nominal", "fair", "serious", "critical"][ProcessInfo.processInfo.thermalState.rawValue]
      let m: [String: Any] = [
        "role": "phone-native",
        "captureTicksPerS": Double(c.ticks) / dt,
        "capturedFps": Double(c.captured) / dt,
        "droppedPerS": Double(c.dropped) / dt,
        "snapshotMsP50": c.snapP50,
        "renderMsP50": c.renderP50,
        "pixelSize": self.capture.pixelSize,
        "encodedFps": dEnc / dt,
        "encodeMsPerFrame": encodeMs,
        "kbps": kbps,
        "size": "\(Int(num("frameWidth")))x\(Int(num("frameHeight")))",
        "limit": s["qualityLimitationReason"] as? String ?? "",
        "encoder": s["encoderImplementation"] as? String ?? "",
        "powerEfficientEncoder": (s["powerEfficientEncoder"] as? NSNumber)?.boolValue ?? false,
        "keyFrames": num("keyFramesEncoded"),
        "pli": num("pliCount"),
        "rttMs": s["rttMs"] ?? 0,
        "appCpuPercent": Self.appCpu(),
        "thermal": thermal,
        "battery": UIDevice.current.batteryLevel,
        "batteryState": UIDevice.current.batteryState.rawValue,
        "audioUnderruns": self.streamer.audio.underruns,
        "audioSamples": self.streamer.audio.received,
      ]
      let line = String(format: "TV %.0f fps · enc %.0f fps %.1f ms %@ · %.0f kbps · cpu %.0f%% · %@",
                       Double(c.captured) / dt, dEnc / dt, encodeMs, (s["encoderImplementation"] as? String) ?? "", kbps, Self.appCpu(), thermal)
      DispatchQueue.main.async { self.show(line) }
      guard let data = try? JSONSerialization.data(withJSONObject: m), let url = URL(string: "\(self.server)/metrics") else { return }
      var req = URLRequest(url: url)
      req.httpMethod = "POST"
      req.httpBody = data
      URLSession.shared.dataTask(with: req).resume()
    }
  }

  /// This process's CPU, all threads (100 = one core).
  static func appCpu() -> Double {
    var threads: thread_act_array_t?
    var count: mach_msg_type_number_t = 0
    guard task_threads(mach_task_self_, &threads, &count) == KERN_SUCCESS, let threads else { return -1 }
    var total = 0.0
    for i in 0..<Int(count) {
      var info = thread_basic_info()
      var n = mach_msg_type_number_t(THREAD_INFO_MAX)
      let kr = withUnsafeMutablePointer(to: &info) {
        $0.withMemoryRebound(to: integer_t.self, capacity: Int(n)) { thread_info(threads[i], thread_flavor_t(THREAD_BASIC_INFO), $0, &n) }
      }
      if kr == KERN_SUCCESS, info.flags & TH_FLAGS_IDLE == 0 { total += Double(info.cpu_usage) / Double(TH_USAGE_SCALE) * 100 }
    }
    vm_deallocate(mach_task_self_, vm_address_t(UInt(bitPattern: threads)), vm_size_t(Int(count) * MemoryLayout<thread_t>.stride))
    return total
  }
}
