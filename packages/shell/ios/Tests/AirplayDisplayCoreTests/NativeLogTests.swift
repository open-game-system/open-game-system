import AVFoundation
import UIKit
import XCTest
@testable import AirplayDisplayCore

@MainActor
final class NativeLogTests: XCTestCase {
  func testEventsAreNumberedForwardedAndKeptInARing() {
    let log = NativeLog(capacity: 3)
    var forwarded: [String] = []
    log.sink = { forwarded.append($0.type) }
    for i in 1...5 { log.info("e\(i)", ["i": i]) }
    XCTAssertEqual(forwarded, ["e1", "e2", "e3", "e4", "e5"])
    XCTAssertEqual(log.ring.map(\.type), ["e3", "e4", "e5"])
    XCTAssertEqual(log.since(4).map(\.type), ["e5"])
    XCTAssertEqual(log.since(0).first?.seq, 3)
  }

  func testDataIsFlattenedToPrimitives() {
    let flat = NativeLog.flat(["b": true, "i": 3, "d": 1.5, "s": "x", "nan": Double.nan, "obj": [1, 2]])
    XCTAssertEqual(flat["b"] as? Bool, true)
    XCTAssertEqual(flat["i"] as? Int, 3)
    XCTAssertEqual(flat["d"] as? Double, 1.5)
    XCTAssertTrue(flat["nan"] is NSNull)
    XCTAssertTrue(flat["obj"] is String)
  }

  func testLevelsArePassedThrough() {
    let log = NativeLog()
    log.warn("w")
    log.error("e")
    XCTAssertEqual(log.ring.map(\.level), ["warn", "error"])
  }

  func testAudioOnlyAirPlayIsAnAirPlayOutputWithoutAnExternalDisplay() {
    XCTAssertTrue(AudioRouteMonitor.isAudioOnlyAirPlay(outputs: [.airPlay], hasExternalDisplay: false))
    XCTAssertFalse(AudioRouteMonitor.isAudioOnlyAirPlay(outputs: [.airPlay], hasExternalDisplay: true))
    XCTAssertFalse(AudioRouteMonitor.isAudioOnlyAirPlay(outputs: [.builtInSpeaker], hasExternalDisplay: false))
  }

  func testCheckReportsTheReceiverOnlyWhenSoundWentAlone() {
    let log = NativeLog()
    let m = AudioRouteMonitor(log: log, center: NotificationCenter())
    var said: [String] = []
    m.onAudioOnlyAirPlay = { said.append($0) }
    m.outputs = { [(type: .airPlay, name: "Living Room")] }
    m.hasExternalDisplay = { true }
    m.check()
    XCTAssertEqual(said, [])
    m.hasExternalDisplay = { false }
    m.check()
    XCTAssertEqual(said, ["Living Room"])
    XCTAssertEqual(log.ring.last?.type, "audio.airplay_audio_only")
  }
}
