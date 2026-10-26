import AVFoundation
import UIKit
import WebKit

/// The phone as a player sees it: its controller page full screen. Behind it, a hidden 1280×720
/// WKWebView renders the TV page, which FrameCapture snapshots at 30 fps and Streamer sends to the TV.
final class NativeController: UIViewController, WKNavigationDelegate, WKScriptMessageHandler {
  let args = UserDefaults.standard
  var controller: WKWebView!
  var tv: WKWebView!
  let status = UILabel()
  var signaling: Signaling!
  var streamer: Streamer!
  var capture: FrameCapture!
  var metrics: Metrics!

  var server: String { args.string(forKey: "server") ?? "http://192.168.68.113:8797" }

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .black
    UIApplication.shared.isIdleTimerDisabled = true
    // The TV page's Web Audio must run (its sound goes to the TV, muted on the phone): a playback
    // session that mixes, so WebKit doesn't treat the context as interrupted.
    try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [.mixWithOthers])
    try? AVAudioSession.sharedInstance().setActive(true)

    // The TV page: hidden, 1280×720 CSS px at scale 1, its Web Audio tapped to native (AudioBridge.js).
    let tvCfg = WKWebViewConfiguration()
    tvCfg.allowsInlineMediaPlayback = true
    tvCfg.mediaTypesRequiringUserActionForPlayback = []
    tvCfg.userContentController.addUserScript(WKUserScript(source: AudioTapScript.source, injectionTime: .atDocumentStart, forMainFrameOnly: true))
    tvCfg.userContentController.add(self, name: "ogsAudio")
    tv = WKWebView(frame: CGRect(x: 0, y: 0, width: 1280, height: 720), configuration: tvCfg)
    tv.scrollView.contentInsetAdjustmentBehavior = .never
    tv.isInspectable = true
    tv.navigationDelegate = self
    if args.string(forKey: "place") == "offscreen" { tv.frame.origin = CGPoint(x: 4000, y: 0) }
    view.addSubview(tv) // behind the controller (added first), never seen

    // The controller: the game's phone page, what the player looks at.
    let cCfg = WKWebViewConfiguration()
    cCfg.allowsInlineMediaPlayback = true
    controller = WKWebView(frame: view.bounds, configuration: cCfg)
    controller.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    controller.isInspectable = true
    controller.navigationDelegate = self
    view.addSubview(controller)

    status.frame = CGRect(x: 8, y: view.bounds.height - 34, width: view.bounds.width - 16, height: 26)
    status.autoresizingMask = [.flexibleTopMargin, .flexibleWidth]
    status.font = .monospacedSystemFont(ofSize: 10, weight: .regular)
    status.textColor = UIColor(white: 1, alpha: 0.85)
    status.backgroundColor = UIColor(white: 0, alpha: 0.55)
    status.numberOfLines = 2
    status.text = " TV: connecting…"
    view.addSubview(status)

    signaling = Signaling(url: URL(string: server.replacingOccurrences(of: "http", with: "ws") + "/ws?role=phone")!)
    streamer = Streamer(signaling: signaling)
    capture = FrameCapture(web: tv, stamp: args.bool(forKey: "stamp"), clock: signaling) { [weak self] pb, ns in
      self?.streamer.push(pb, timeNs: ns)
    }
    metrics = Metrics(server: server, capture: capture, streamer: streamer) { [weak self] line in
      self?.status.text = " " + line
    }
    signaling.onMessage = { [weak self] msg in self?.streamer.handle(msg) }
    signaling.connect()

    if let tvURL = args.string(forKey: "tv").flatMap(URL.init(string:)) { tv.load(URLRequest(url: tvURL)) }
    if let cURL = args.string(forKey: "controller").flatMap(URL.init(string:)) { controller.load(URLRequest(url: cURL)) }
    capture.start()
    metrics.start()
    // The TV page's audio contexts, as the page sees them (logged every 10 s).
    Timer.scheduledTimer(withTimeInterval: 10, repeats: true) { [weak self] _ in
      self?.tv.evaluateJavaScript("JSON.stringify({taps: window.__ogsAudioTap ? [...window.__ogsAudioTap.keys()].map(c => c.state + '@' + c.sampleRate) : null})") { r, _ in
        if let r = r as? String { self?.signaling.log("tv audio: \(r)") }
      }
    }
    NSLog("[spike] native: tv=%@ controller=%@", args.string(forKey: "tv") ?? "-", args.string(forKey: "controller") ?? "-")
  }

  func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
    guard webView == controller, let name = args.string(forKey: "name") else { return }
    // Join under a name, then answer every question with a random color (the player's thumbs).
    let js = """
    (() => {
      const setName = () => {
        const f = document.querySelector('[data-testid=nameField]');
        if (!f) return false;
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(f, \(String(reflecting: name)));
        f.dispatchEvent(new Event('input', { bubbles: true }));
        document.querySelector('[data-testid=joinButton]')?.click();
        return true;
      };
      const t = setInterval(() => { if (setName()) clearInterval(t); }, 500);
      setInterval(() => {
        const b = [...document.querySelectorAll('[data-testid^=pick-]:not([disabled])')];
        if (b.length && Math.random() < 0.5) b[Math.floor(Math.random() * b.length)].click();
      }, 1500);
    })();
    """
    controller.evaluateJavaScript(js)
  }

  func userContentController(_ uc: WKUserContentController, didReceive message: WKScriptMessage) {
    guard message.name == "ogsAudio", let body = message.body as? [String: Any],
          let b64 = body["pcm"] as? String, let rate = body["rate"] as? Double,
          let data = Data(base64Encoded: b64) else { return }
    streamer.audio.push(pcm16: data, sampleRate: rate)
  }
}

/// Injected into the TV page at document start: whatever the page connects to its AudioContext's
/// destination goes to a tap instead (so the phone stays silent), and the tap posts 16-bit mono PCM
/// to native every 1024 frames (~21 ms) for the call's audio track.
enum AudioTapScript {
  static let source = """
  (() => {
    if (window.__ogsAudioTap) return;
    const connect = AudioNode.prototype.connect;
    const taps = new Map();
    const b64 = (buf) => { let s = ''; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); };
    const tapFor = (ctx) => {
      let t = taps.get(ctx);
      if (t) return t;
      t = ctx.createGain();
      const sp = ctx.createScriptProcessor(1024, 2, 1);
      const mute = ctx.createGain();
      mute.gain.value = 0;
      connect.call(t, sp);
      connect.call(sp, mute);
      connect.call(mute, ctx.destination);
      sp.onaudioprocess = (e) => {
        const ib = e.inputBuffer;
        const L = ib.getChannelData(0), R = ib.numberOfChannels > 1 ? ib.getChannelData(1) : L;
        const out = new Int16Array(L.length);
        for (let i = 0; i < L.length; i++) { const v = (L[i] + R[i]) / 2; out[i] = Math.max(-1, Math.min(1, v)) * 32767; }
        window.webkit.messageHandlers.ogsAudio.postMessage({ rate: ctx.sampleRate, pcm: b64(out.buffer) });
      };
      taps.set(ctx, t);
      return t;
    };
    AudioNode.prototype.connect = function (dest, ...rest) {
      if (typeof AudioDestinationNode !== 'undefined' && dest instanceof AudioDestinationNode) { connect.call(this, tapFor(dest.context), ...rest); return dest; }
      return connect.call(this, dest, ...rest);
    };
    // The TV page is never tapped: start every context at once (the WebView allows it) and tap it
    // from the start, so the call has its audio track flowing before the first sound.
    // The phone's controller page plays its own sounds with a "playback" session, which interrupts any
    // other page's. The TV page mixes ("ambient"; its output is muted here anyway), and keeps it.
    const as = navigator.audioSession;
    if (as) {
      try { as.type = 'ambient'; } catch (e) {}
      try { Object.defineProperty(as, 'type', { configurable: true, get: () => 'ambient', set: () => {} }); } catch (e) {}
    }
    const Base = window.AudioContext || window.webkitAudioContext;
    if (Base) {
      const Started = class extends Base {
        constructor(...a) { super(...a); tapFor(this); this.resume().catch(() => {}); }
      };
      window.AudioContext = Started;
      window.webkitAudioContext = Started;
    }
    window.__ogsAudioTap = taps;
  })();
  """
}
