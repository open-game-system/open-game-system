import SwiftUI
import UIKit
import WebKit

/// Spike app (docs/exec-plans/active/2026-10-25-phone-p2p-cast.md). Launch arguments:
///   -mode web|snap   (a) the TV page streams itself from inside the WebView (capture.js + WebRTC);
///                    (b) native: takeSnapshot loop of an off-screen WKWebView (throughput only)
///   -url <TV page>   -place visible|offscreen|transparent  (where the TV WebView sits)
///   -seconds N       how long (b) measures
@main
struct P2PSpikeApp: App {
  var body: some Scene { WindowGroup { Root().ignoresSafeArea() } }
}

struct Root: UIViewControllerRepresentable {
  func makeUIViewController(context: Context) -> SpikeController { SpikeController() }
  func updateUIViewController(_ vc: SpikeController, context: Context) {}
}

final class SpikeController: UIViewController, WKNavigationDelegate {
  let args = UserDefaults.standard
  var web: WKWebView!
  let preview = UIImageView()
  let label = UILabel()

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .black
    let cfg = WKWebViewConfiguration()
    cfg.allowsInlineMediaPlayback = true
    cfg.mediaTypesRequiringUserActionForPlayback = []
    let mode0 = args.string(forKey: "mode") ?? "web"
    if mode0 == "snapstream" {
      // What the shell would inject: snapshot mode on, signaling to the TV, then capture.js.
      let server = args.string(forKey: "server") ?? "http://192.168.68.113:8797"
      let capture = (try? String(contentsOf: URL(string: "\(server)/capture.js")!, encoding: .utf8)) ?? ""
      let ws = server.replacingOccurrences(of: "http", with: "ws") + "/ws?role=phone"
      let prelude = "window.__ogsSnapMode = true; window.__ogsSignalUrl = '\(ws)';\n"
      cfg.userContentController.addUserScript(WKUserScript(source: prelude + capture, injectionTime: .atDocumentStart, forMainFrameOnly: true))
    }
    // The TV page is 1280×720 CSS px at scale 1 (what the TV gets), whatever the phone's screen.
    web = WKWebView(frame: CGRect(x: 0, y: 0, width: 1280, height: 720), configuration: cfg)
    web.isInspectable = true
    web.scrollView.contentInsetAdjustmentBehavior = .never
    web.navigationDelegate = self
    let place = args.string(forKey: "place") ?? "visible"
    let mode = args.string(forKey: "mode") ?? "web"
    let w = UIScreen.main.bounds.width
    if place == "offscreen" {
      web.frame.origin = CGPoint(x: 4000, y: 0)
    } else if place == "transparent" {
      web.alpha = 0.01
    } else {
      // Visible: scaled into the top of the phone screen so the recording shows the phone side.
      web.transform = CGAffineTransform(scaleX: w / 1280, y: w / 1280)
      web.frame.origin = CGPoint(x: 0, y: 80)
    }
    view.addSubview(web)
    preview.frame = CGRect(x: 0, y: 80 + w * 720 / 1280 + 20, width: w, height: w * 720 / 1280)
    preview.contentMode = .scaleAspectFit
    if mode == "snap" { view.addSubview(preview) }
    label.frame = CGRect(x: 16, y: UIScreen.main.bounds.height - 260, width: w - 32, height: 220)
    label.numberOfLines = 0
    label.textColor = .white
    label.font = .monospacedSystemFont(ofSize: 13, weight: .regular)
    label.text = "P2P spike: mode \(mode), TV page \(place)"
    view.addSubview(label)
    let url = URL(string: args.string(forKey: "url") ?? "http://192.168.68.113:8797/sender.html")!
    web.load(URLRequest(url: url))
    NSLog("[spike] mode=%@ place=%@ url=%@", mode, place, url.absoluteString)
  }

  func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
    NSLog("[spike] loaded")
    if args.string(forKey: "mode") == "snap" {
      DispatchQueue.main.asyncAfter(deadline: .now() + 2) { self.snapLoop() }
    }
    if args.string(forKey: "mode") == "snapstream" { streamLoop() }
  }

  /// (b): how many full 1280×720 snapshots per second can the phone take of the TV WebView, and what
  /// each costs, including the copy into a CVPixelBuffer that a libwebrtc video track would need.
  func snapLoop() {
    let seconds = max(5.0, args.double(forKey: "seconds"))
    let cfg = WKSnapshotConfiguration()
    cfg.rect = CGRect(x: 0, y: 0, width: 1280, height: 720)
    cfg.snapshotWidth = 1280
    cfg.afterScreenUpdates = false
    let start = CACurrentMediaTime()
    var times: [Double] = []
    var convert: [Double] = []
    var lastLog = start
    func one() {
      let t0 = CACurrentMediaTime()
      web.takeSnapshot(with: cfg) { image, error in
        let t1 = CACurrentMediaTime()
        times.append((t1 - t0) * 1000)
        if let image, let cg = image.cgImage {
          let c0 = CACurrentMediaTime()
          if self.args.object(forKey: "convert") == nil || self.args.bool(forKey: "convert") { _ = SpikeController.pixelBuffer(from: cg) }
          convert.append((CACurrentMediaTime() - c0) * 1000)
          if times.count % 3 == 0 { self.preview.image = image }
        } else if let error { NSLog("[spike] snapshot error %@", error.localizedDescription) }
        let now = CACurrentMediaTime()
        if now - lastLog > 1 {
          lastLog = now
          self.label.text = String(format: "(b) snapshots: %d in %.1fs = %.1f/s\nsnapshot p50 %.1f ms, to pixel buffer p50 %.1f ms", times.count, now - start, Double(times.count) / (now - start), SpikeController.p50(times), SpikeController.p50(convert))
        }
        if now - start < seconds { one() } else {
          let fps = Double(times.count) / (now - start)
          NSLog("[spike] RESULT snap fps=%.1f snapP50=%.1f snapP90=%.1f convertP50=%.1f n=%d size=%@", fps, SpikeController.p50(times), SpikeController.pct(times, 0.9), SpikeController.p50(convert), times.count, NSCoder.string(for: image?.size ?? .zero))
          self.label.text = (self.label.text ?? "") + "\nDONE"
        }
      }
    }
    one()
  }

  /// (b2): snapshot the TV WebView, JPEG it, hand it back to the page's injected capture.js, which
  /// draws it into its hidden canvas: that canvas (plus the page's Web Audio) is what WebRTC sends.
  var streamStarted = false
  func streamLoop() {
    if streamStarted { return }
    streamStarted = true
    let cfg = WKSnapshotConfiguration()
    cfg.rect = CGRect(x: 0, y: 0, width: 1280, height: 720)
    cfg.snapshotWidth = 1280
    cfg.afterScreenUpdates = false
    let quality = CGFloat(args.object(forKey: "jpeg") == nil ? 0.6 : args.double(forKey: "jpeg"))
    if args.object(forKey: "width") != nil { cfg.snapshotWidth = NSNumber(value: args.double(forKey: "width")) }
    let targetFps = args.object(forKey: "fps") == nil ? 30.0 : args.double(forKey: "fps")
    let maxInFlight = args.object(forKey: "inflight") == nil ? 3 : args.integer(forKey: "inflight")
    let encoders = DispatchQueue(label: "jpeg", qos: .userInteractive, attributes: .concurrent)
    var snapMs: [Double] = [], jpegMs: [Double] = [], evalMs: [Double] = [], sizes: [Double] = []
    var count = 0, inFlight = 0, seq = 0, lastSent = 0
    var windowStart = CACurrentMediaTime()
    // A snapshot every 1/fps; each JPEG encodes on its own core (up to maxInFlight at once); frames
    // reach the page in order (a late one is dropped).
    func report() {
      let now = CACurrentMediaTime()
      if now - windowStart < 5 { return }
      let line = String(format: "(b2) %.1f fps | snapshot %.1f ms | jpeg %.1f ms | to page %.1f ms | %.0f KB/frame | %d in flight max", Double(count) / (now - windowStart), SpikeController.p50(snapMs), SpikeController.p50(jpegMs), SpikeController.p50(evalMs), SpikeController.p50(sizes), maxInFlight)
      NSLog("[spike] RESULT %@", line)
      label.text = line
      count = 0; windowStart = now; snapMs = []; jpegMs = []; evalMs = []; sizes = []
    }
    Timer.scheduledTimer(withTimeInterval: 1 / targetFps, repeats: true) { _ in
      if inFlight >= maxInFlight { return }
      inFlight += 1
      seq += 1
      let mine = seq
      let t0 = CACurrentMediaTime()
      self.web.takeSnapshot(with: cfg) { image, _ in
        let t1 = CACurrentMediaTime()
        guard let image else { inFlight -= 1; return }
        encoders.async {
          let jpeg = image.jpegData(compressionQuality: quality)
          let t2 = CACurrentMediaTime()
          let b64 = jpeg?.base64EncodedString()
          DispatchQueue.main.async {
            inFlight -= 1
            guard let b64, let jpeg, mine > lastSent else { return }
            lastSent = mine
            self.web.evaluateJavaScript("window.__ogsFrame && window.__ogsFrame('\(b64)')") { _, _ in
              snapMs.append((t1 - t0) * 1000); jpegMs.append((t2 - t1) * 1000)
              evalMs.append((CACurrentMediaTime() - t2) * 1000); sizes.append(Double(jpeg.count) / 1024)
              count += 1
              report()
            }
          }
        }
      }
    }
  }

  static func pixelBuffer(from cg: CGImage) -> CVPixelBuffer? {
    var pb: CVPixelBuffer?
    let attrs = [kCVPixelBufferCGImageCompatibilityKey: true, kCVPixelBufferCGBitmapContextCompatibilityKey: true] as CFDictionary
    CVPixelBufferCreate(kCFAllocatorDefault, cg.width, cg.height, kCVPixelFormatType_32BGRA, attrs, &pb)
    guard let pb else { return nil }
    CVPixelBufferLockBaseAddress(pb, [])
    let ctx = CGContext(data: CVPixelBufferGetBaseAddress(pb), width: cg.width, height: cg.height, bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(pb), space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue)
    ctx?.draw(cg, in: CGRect(x: 0, y: 0, width: cg.width, height: cg.height))
    CVPixelBufferUnlockBaseAddress(pb, [])
    return pb
  }
  static func pct(_ a: [Double], _ p: Double) -> Double { let s = a.sorted(); return s.isEmpty ? 0 : s[min(s.count - 1, Int(p * Double(s.count)))] }
  static func p50(_ a: [Double]) -> Double { pct(a, 0.5) }
}
