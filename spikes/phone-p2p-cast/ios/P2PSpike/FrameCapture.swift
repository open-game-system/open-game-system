import CoreImage
import CoreVideo
import Metal
import UIKit
import WebKit

/// 30 fps capture of the hidden TV WebView. A CADisplayLink paced at exactly 30 Hz asks for a
/// snapshot; if the previous frame is still being captured or converted, this tick is dropped (never
/// queued, so latency can't build up). Each snapshot is rendered by Core Image on the GPU (Metal)
/// into an IOSurface-backed BGRA CVPixelBuffer from a pool, off the main thread, and handed to the
/// call. With `stamp`, the top-left 25 blocks carry the TV-clock time in ms (mod 2^24) + parity,
/// for the receiver's glass-to-glass measurement.
final class FrameCapture {
  private let web: WKWebView
  private let stamp: Bool
  private let clock: Signaling
  private let onFrame: (CVPixelBuffer, Int64) -> Void
  private var link: CADisplayLink?
  /// A snapshot is in flight / a frame is being rendered. At most one of each: a tick that finds the
  /// snapshot busy, or a snapshot that finds the renderer busy, is dropped, never queued.
  private var snapping = false
  private var rendering = false
  private let queue = DispatchQueue(label: "capture.render", qos: .userInteractive)
  private let ci: CIContext
  private var pool: CVPixelBufferPool?
  private let lock = NSLock()

  // Counters, drained by Metrics.
  private(set) var ticks = 0
  private(set) var captured = 0
  private(set) var dropped = 0
  private var snapMs: [Double] = []
  private var renderMs: [Double] = []
  private(set) var pixelSize = "?"

  init(web: WKWebView, stamp: Bool, clock: Signaling, onFrame: @escaping (CVPixelBuffer, Int64) -> Void) {
    self.web = web
    self.stamp = stamp
    self.clock = clock
    self.onFrame = onFrame
    if let dev = MTLCreateSystemDefaultDevice() {
      ci = CIContext(mtlDevice: dev, options: [.cacheIntermediates: false, .workingColorSpace: NSNull()])
    } else {
      ci = CIContext(options: [.cacheIntermediates: false])
    }
    let attrs: [CFString: Any] = [
      kCVPixelBufferPixelFormatTypeKey: kCVPixelFormatType_32BGRA,
      kCVPixelBufferWidthKey: 1280,
      kCVPixelBufferHeightKey: 720,
      kCVPixelBufferIOSurfacePropertiesKey: [:] as CFDictionary,
      kCVPixelBufferMetalCompatibilityKey: true,
    ]
    CVPixelBufferPoolCreate(nil, [kCVPixelBufferPoolMinimumBufferCountKey: 4] as CFDictionary, attrs as CFDictionary, &pool)
  }

  func start() {
    let link = CADisplayLink(target: self, selector: #selector(tick(_:)))
    link.preferredFrameRateRange = CAFrameRateRange(minimum: 30, maximum: 30, preferred: 30)
    link.add(to: .main, forMode: .common)
    self.link = link
  }

  func drain() -> (ticks: Int, captured: Int, dropped: Int, snapP50: Double, renderP50: Double) {
    lock.lock()
    defer {
      ticks = 0; captured = 0; dropped = 0; snapMs = []; renderMs = []
      lock.unlock()
    }
    return (ticks, captured, dropped, Self.p50(snapMs), Self.p50(renderMs))
  }

  @objc private func tick(_ link: CADisplayLink) {
    lock.lock(); ticks += 1; lock.unlock()
    if snapping {
      lock.lock(); dropped += 1; lock.unlock()
      return
    }
    snapping = true
    let cfg = WKSnapshotConfiguration()
    cfg.rect = CGRect(x: 0, y: 0, width: 1280, height: 720)
    // snapshotWidth is in points; the image comes back at the screen's scale. Ask for 1280 pixels.
    cfg.snapshotWidth = NSNumber(value: 1280.0 / Double(UIScreen.main.scale))
    cfg.afterScreenUpdates = false
    let t0 = CACurrentMediaTime()
    // The frame's capture time is the display link's vsync, not when this callback ran: evenly spaced
    // timestamps (33.3 ms) are what lets the TV's jitter buffer present an even 30 fps.
    let vsync = link.timestamp
    let stampMs = stamp ? clock.nowMs() : 0
    web.takeSnapshot(with: cfg) { [weak self] image, _ in
      guard let self else { return }
      let t1 = CACurrentMediaTime()
      self.snapping = false
      guard let cg = image?.cgImage else { return }
      if self.rendering {
        self.lock.lock(); self.dropped += 1; self.lock.unlock()
        return
      }
      self.rendering = true
      self.queue.async {
        guard let pool = self.pool else { DispatchQueue.main.async { self.rendering = false }; return }
        var out: CVPixelBuffer?
        CVPixelBufferPoolCreatePixelBuffer(nil, pool, &out)
        guard let pb = out else { DispatchQueue.main.async { self.rendering = false }; return }
        var img = CIImage(cgImage: cg)
        if img.extent.width != 1280 {
          img = img.transformed(by: CGAffineTransform(scaleX: 1280 / img.extent.width, y: 720 / img.extent.height))
        }
        if self.stamp { img = Self.stamped(img, ms: stampMs) }
        self.ci.render(img, to: pb, bounds: CGRect(x: 0, y: 0, width: 1280, height: 720), colorSpace: CGColorSpaceCreateDeviceRGB())
        let t2 = CACurrentMediaTime()
        let ns = Int64(vsync * 1_000_000_000)
        self.onFrame(pb, ns)
        self.lock.lock()
        self.captured += 1
        self.snapMs.append((t1 - t0) * 1000)
        self.renderMs.append((t2 - t1) * 1000)
        if self.pixelSize == "?" { self.pixelSize = "\(cg.width)x\(cg.height)" }
        self.lock.unlock()
        DispatchQueue.main.async { self.rendering = false }
      }
    }
  }

  /// 24 bits of (ms mod 2^24), most significant first, then parity: white = 1, black = 0, 48 px blocks
  /// along the top edge (Core Image's origin is bottom-left).
  static func stamped(_ img: CIImage, ms: Double) -> CIImage {
    let now = Int(ms) % 16_777_216
    var out = img
    var parity = 0
    for b in 0..<25 {
      let bit: Int
      if b < 24 { bit = (now >> (23 - b)) & 1; parity ^= bit } else { bit = parity }
      let block = CIImage(color: bit == 1 ? .white : .black).cropped(to: CGRect(x: b * 48, y: 720 - 48, width: 48, height: 48))
      out = block.composited(over: out)
    }
    return out
  }

  static func p50(_ a: [Double]) -> Double {
    let s = a.sorted()
    return s.isEmpty ? 0 : s[s.count / 2]
  }
}
