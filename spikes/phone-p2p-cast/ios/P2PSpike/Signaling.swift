import Foundation

/// The spike's signaling: a WebSocket to the spike server, standing in for the Cast SDK's custom
/// namespace (urn:x-cast:org.opengame.view). Same messages: REQUEST_VIEW in, PEER_OFFER out,
/// PEER_ANSWER in. Also keeps the TV-side clock (TIME_PING / TIME_PONG, best of the round trips),
/// so frames can carry a timestamp the receiver compares with its own clock (glass-to-glass).
final class Signaling: NSObject, URLSessionWebSocketDelegate {
  let url: URL
  var onMessage: (([String: Any]) -> Void)?
  private var task: URLSessionWebSocketTask?
  private lazy var session = URLSession(configuration: .default, delegate: self, delegateQueue: .main)
  /// Server clock minus this phone's clock (ms), from the round trip with the smallest delay.
  private(set) var offsetMs: Double = 0
  private var bestRtt = Double.infinity
  private var pings = 0

  init(url: URL) { self.url = url }

  func connect() {
    task = session.webSocketTask(with: url)
    task?.resume()
    receive()
  }

  func urlSession(_ s: URLSession, webSocketTask: URLSessionWebSocketTask, didOpenWithProtocol p: String?) {
    NSLog("[spike] signaling open")
    syncClock()
  }

  func urlSession(_ s: URLSession, webSocketTask: URLSessionWebSocketTask, didCloseWith code: URLSessionWebSocketTask.CloseCode, reason: Data?) {
    NSLog("[spike] signaling closed; reconnecting")
    DispatchQueue.main.asyncAfter(deadline: .now() + 1) { self.connect() }
  }

  func nowMs() -> Double { Date().timeIntervalSince1970 * 1000 + offsetMs }

  func send(_ msg: [String: Any]) {
    guard let data = try? JSONSerialization.data(withJSONObject: msg), let text = String(data: data, encoding: .utf8) else { return }
    task?.send(.string(text)) { err in if let err { NSLog("[spike] send failed %@", err.localizedDescription) } }
  }

  func log(_ text: String) {
    NSLog("[spike] %@", text)
    send(["type": "LOG", "message": text])
  }

  private func syncClock() {
    pings = 0
    bestRtt = .infinity
    for i in 0..<20 {
      DispatchQueue.main.asyncAfter(deadline: .now() + Double(i) * 0.1) {
        self.send(["type": "TIME_PING", "t0": Date().timeIntervalSince1970 * 1000])
      }
    }
    // Clocks drift: sync again every minute.
    DispatchQueue.main.asyncAfter(deadline: .now() + 60) { [weak self] in self?.syncClock() }
  }

  private func receive() {
    task?.receive { [weak self] result in
      guard let self else { return }
      if case let .success(.string(text)) = result,
         let data = text.data(using: .utf8),
         let msg = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] {
        if msg["type"] as? String == "TIME_PONG", let t0 = msg["t0"] as? Double, let server = msg["server"] as? Double {
          let t1 = Date().timeIntervalSince1970 * 1000
          let rtt = t1 - t0
          if rtt < self.bestRtt {
            self.bestRtt = rtt
            self.offsetMs = server - (t0 + t1) / 2
          }
          self.pings += 1
          if self.pings == 20 { self.log(String(format: "clock: offset %.1f ms, best rtt %.1f ms", self.offsetMs, self.bestRtt)) }
        } else {
          self.onMessage?(msg)
        }
      }
      if case .failure = result { return }
      self.receive()
    }
  }
}
