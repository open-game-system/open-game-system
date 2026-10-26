import AudioToolbox
import Foundation
import WebRTC

/// libwebrtc's audio device, replaced: no microphone, no speaker. Its "recording" is the TV page's
/// Web Audio, posted from the page as 16-bit mono PCM (AudioTapScript), resampled to 48 kHz and fed to
/// the call in 10 ms frames from one dedicated thread (as RTCAudioDeviceDelegate requires). Playout
/// is a no-op: the phone never plays the TV's sound.
final class PCMAudioDevice: NSObject, RTCAudioDevice {
  private let rate = 48_000.0
  private let frame = 480 // 10 ms
  private var delegate: RTCAudioDeviceDelegate?
  private var ring: [Int16] = []
  private let lock = NSLock()
  private var thread: Thread?
  private var running = false
  private(set) var underruns = 0
  private(set) var received = 0

  /// From the page: 16-bit mono PCM at the page's AudioContext rate.
  func push(pcm16 data: Data, sampleRate: Double) {
    let samples: [Int16] = data.withUnsafeBytes { Array($0.bindMemory(to: Int16.self)) }
    let resampled = sampleRate == rate ? samples : Self.resample(samples, from: sampleRate, to: rate)
    lock.lock()
    ring.append(contentsOf: resampled)
    received += resampled.count
    // Keep at most 200 ms: a late burst must not turn into delay.
    if ring.count > Int(rate * 0.2) { ring.removeFirst(ring.count - Int(rate * 0.06)) }
    lock.unlock()
  }

  static func resample(_ s: [Int16], from: Double, to: Double) -> [Int16] {
    let n = Int(Double(s.count) * to / from)
    guard n > 0, s.count > 1 else { return [] }
    var out = [Int16](repeating: 0, count: n)
    for i in 0..<n {
      let x = Double(i) * from / to
      let j = min(Int(x), s.count - 2)
      let f = x - Double(j)
      out[i] = Int16(Double(s[j]) * (1 - f) + Double(s[j + 1]) * f)
    }
    return out
  }

  // MARK: RTCAudioDevice
  var deviceInputSampleRate: Double { rate }
  var inputIOBufferDuration: TimeInterval { 0.01 }
  var inputNumberOfChannels: Int { 1 }
  var inputLatency: TimeInterval { 0 }
  var deviceOutputSampleRate: Double { rate }
  var outputIOBufferDuration: TimeInterval { 0.01 }
  var outputNumberOfChannels: Int { 1 }
  var outputLatency: TimeInterval { 0 }
  private(set) var isInitialized = false
  private(set) var isPlayoutInitialized = false
  private(set) var isPlaying = false
  private(set) var isRecordingInitialized = false
  private(set) var isRecording = false

  func initialize(with delegate: RTCAudioDeviceDelegate) -> Bool {
    self.delegate = delegate
    isInitialized = true
    return true
  }
  func terminateDevice() -> Bool {
    _ = stopRecording()
    isInitialized = false
    return true
  }
  func initializePlayout() -> Bool { isPlayoutInitialized = true; return true }
  func startPlayout() -> Bool { isPlaying = true; return true }
  func stopPlayout() -> Bool { isPlaying = false; return true }
  func initializeRecording() -> Bool { isRecordingInitialized = true; return true }

  func startRecording() -> Bool {
    if running { return true }
    running = true
    isRecording = true
    let t = Thread { [weak self] in self?.loop() }
    t.qualityOfService = .userInteractive
    t.name = "pcm-audio"
    thread = t
    t.start()
    return true
  }

  func stopRecording() -> Bool {
    running = false
    isRecording = false
    return true
  }

  /// Every 10 ms (paced on the wall clock, not the sleep): 480 samples into the call.
  private func loop() {
    var buffer = [Int16](repeating: 0, count: frame)
    var next = CACurrentMediaTime()
    var sampleTime = 0.0
    while running {
      lock.lock()
      if ring.count >= frame {
        buffer.withUnsafeMutableBufferPointer { b in
          for i in 0..<frame { b[i] = ring[i] }
        }
        ring.removeFirst(frame)
      } else {
        for i in 0..<frame { buffer[i] = 0 }
        underruns += 1
      }
      lock.unlock()
      buffer.withUnsafeMutableBytes { raw in
        var abl = AudioBufferList(mNumberBuffers: 1, mBuffers: AudioBuffer(mNumberChannels: 1, mDataByteSize: UInt32(frame * 2), mData: raw.baseAddress))
        var flags = AudioUnitRenderActionFlags()
        var ts = AudioTimeStamp()
        ts.mSampleTime = sampleTime
        ts.mFlags = .sampleTimeValid
        _ = delegate?.deliverRecordedData(&flags, &ts, 1, UInt32(frame), &abl, nil, nil)
      }
      sampleTime += Double(frame)
      next += 0.01
      let wait = next - CACurrentMediaTime()
      if wait > 0 { Thread.sleep(forTimeInterval: wait) } else if wait < -0.1 { next = CACurrentMediaTime() }
    }
  }
}
