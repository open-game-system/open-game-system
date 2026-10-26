import Foundation
import WebRTC

/// The call to the TV, in native libwebrtc (stasel/WebRTC 153.0.0): a video track fed by
/// FrameCapture through a custom capturer, H.264 first (VideoToolbox hardware encoder), and an audio
/// track fed by the TV page's Web Audio (PCMAudioDevice). Speaks the receiver's peer protocol:
/// REQUEST_VIEW → PEER_OFFER {sdp, iceServers: []} → PEER_ANSWER. No STUN/TURN: host candidates only
/// (native libwebrtc offers the phone's real LAN addresses, no mDNS names). Non-trickle.
final class Streamer: NSObject, RTCPeerConnectionDelegate {
  let audio = PCMAudioDevice()
  private let signaling: Signaling
  private let factory: RTCPeerConnectionFactory
  private let source: RTCVideoSource
  private let capturer: RTCVideoCapturer
  private let videoTrack: RTCVideoTrack
  private let audioTrack: RTCAudioTrack
  private(set) var pc: RTCPeerConnection?
  private var videoSender: RTCRtpSender?
  private var offering = false
  private var gathered: (() -> Void)?

  init(signaling: Signaling) {
    self.signaling = signaling
    RTCInitializeSSL()
    factory = RTCPeerConnectionFactory(
      encoderFactory: RTCDefaultVideoEncoderFactory(),
      decoderFactory: RTCDefaultVideoDecoderFactory(),
      audioDevice: audio)
    source = factory.videoSource()
    capturer = RTCVideoCapturer(delegate: source)
    videoTrack = factory.videoTrack(with: source, trackId: "tv-video")
    audioTrack = factory.audioTrack(with: factory.audioSource(with: nil), trackId: "tv-audio")
    super.init()
  }

  func push(_ pb: CVPixelBuffer, timeNs: Int64) {
    let frame = RTCVideoFrame(buffer: RTCCVPixelBuffer(pixelBuffer: pb), rotation: ._0, timeStampNs: timeNs)
    source.capturer(capturer, didCapture: frame)
  }

  func handle(_ msg: [String: Any]) {
    switch msg["type"] as? String {
    case "REQUEST_VIEW":
      if pc?.connectionState != .connected { offer() }
    case "PEER_ANSWER":
      guard let sdp = msg["sdp"] as? String, let pc else { return }
      pc.setRemoteDescription(RTCSessionDescription(type: .answer, sdp: sdp)) { [weak self] err in
        if let err { self?.signaling.log("answer failed: \(err.localizedDescription)"); return }
        self?.applyLimits()
        self?.signaling.log("answer set")
      }
    case "PEER_KEYFRAME":
      // libwebrtc already answers the receiver's RTCP PLI with a keyframe; logged to see how often.
      signaling.log("keyframe asked")
    case "PEER_ERROR":
      signaling.log("receiver error: \(msg["error"] ?? "")")
    default:
      break
    }
  }

  private func offer() {
    if offering { return }
    offering = true
    pc?.close()
    let cfg = RTCConfiguration()
    cfg.iceServers = []
    cfg.sdpSemantics = .unifiedPlan
    cfg.continualGatheringPolicy = .gatherOnce
    cfg.candidateNetworkPolicy = .all
    let constraints = RTCMediaConstraints(mandatoryConstraints: nil, optionalConstraints: nil)
    guard let pc = factory.peerConnection(with: cfg, constraints: constraints, delegate: self) else { offering = false; return }
    self.pc = pc
    let vInit = RTCRtpTransceiverInit()
    vInit.direction = .sendOnly
    vInit.streamIds = ["tv"]
    let vt = pc.addTransceiver(with: videoTrack, init: vInit)
    // H.264 first: the hardware encoder here and the hardware decoder on a Chromecast.
    let caps = factory.rtpSenderCapabilities(forKind: "video").codecs
    let first = UserDefaults.standard.string(forKey: "codec") ?? "H264"
    let ordered = caps.filter { $0.name == first } + caps.filter { $0.name != first }
    try? vt?.setCodecPreferences(ordered, error: ())
    videoSender = vt?.sender
    let aInit = RTCRtpTransceiverInit()
    aInit.direction = .sendOnly
    aInit.streamIds = ["tv"]
    _ = pc.addTransceiver(with: audioTrack, init: aInit)
    pc.offer(for: constraints) { [weak self] sdp, err in
      guard let self, let sdp else { self?.offering = false; return }
      pc.setLocalDescription(sdp) { _ in
        var sent = false
        let send = {
          if sent { return }
          sent = true
          self.offering = false
          guard let local = pc.localDescription else { return }
          let cands = local.sdp.components(separatedBy: "\r\n").filter { $0.hasPrefix("a=candidate") }.map { $0.split(separator: " ").dropFirst(4).prefix(4).joined(separator: " ") }
          self.signaling.log("offer: \(first) first, candidates \(cands.joined(separator: " | "))")
          self.signaling.send(["type": "PEER_OFFER", "sdp": local.sdp, "iceServers": [Any]()])
        }
        self.gathered = { DispatchQueue.main.async(execute: send) }
        DispatchQueue.main.asyncAfter(deadline: .now() + 2, execute: send)
      }
    }
  }

  /// Once negotiated (encodings exist): keep 30 fps, cap at 7 Mbit/s.
  private func applyLimits() {
    guard let sender = videoSender else { return }
    let p = sender.parameters
    p.degradationPreference = NSNumber(value: RTCDegradationPreference.maintainFramerate.rawValue)
    for e in p.encodings {
      e.maxBitrateBps = 7_000_000
      e.minBitrateBps = 2_000_000
      e.maxFramerate = 30
    }
    sender.parameters = p
  }

  /// Sender-side numbers for Metrics.
  func stats(_ done: @escaping ([String: Any]) -> Void) {
    guard let pc, let sender = videoSender else { return done([:]) }
    pc.statistics(for: sender) { report in
      var out: [String: Any] = [:]
      for s in report.statistics.values where s.type == "outbound-rtp" {
        for k in ["framesEncoded", "framesSent", "totalEncodeTime", "qualityLimitationReason", "encoderImplementation", "frameWidth", "frameHeight", "bytesSent", "framesPerSecond", "keyFramesEncoded", "pliCount", "nackCount", "powerEfficientEncoder"] {
          if let v = s.values[k] { out[k] = v }
        }
      }
      for s in report.statistics.values where s.type == "candidate-pair" {
        if (s.values["nominated"] as? NSNumber)?.boolValue == true, let rtt = s.values["currentRoundTripTime"] as? NSNumber {
          out["rttMs"] = rtt.doubleValue * 1000
        }
      }
      done(out)
    }
  }

  // MARK: RTCPeerConnectionDelegate
  func peerConnection(_ pc: RTCPeerConnection, didChange state: RTCSignalingState) {}
  func peerConnection(_ pc: RTCPeerConnection, didAdd stream: RTCMediaStream) {}
  func peerConnection(_ pc: RTCPeerConnection, didRemove stream: RTCMediaStream) {}
  func peerConnectionShouldNegotiate(_ pc: RTCPeerConnection) {}
  func peerConnection(_ pc: RTCPeerConnection, didChange newState: RTCIceConnectionState) {}
  func peerConnection(_ pc: RTCPeerConnection, didChange newState: RTCIceGatheringState) {
    if newState == .complete { gathered?() }
  }
  func peerConnection(_ pc: RTCPeerConnection, didChange newState: RTCPeerConnectionState) {
    let names: [RTCPeerConnectionState: String] = [.new: "new", .connecting: "connecting", .connected: "connected", .disconnected: "disconnected", .failed: "failed", .closed: "closed"]
    signaling.log("connection \(names[newState] ?? "?")")
  }
  func peerConnection(_ pc: RTCPeerConnection, didGenerate candidate: RTCIceCandidate) {}
  func peerConnection(_ pc: RTCPeerConnection, didRemove candidates: [RTCIceCandidate]) {}
  func peerConnection(_ pc: RTCPeerConnection, didOpen dataChannel: RTCDataChannel) {}
}
