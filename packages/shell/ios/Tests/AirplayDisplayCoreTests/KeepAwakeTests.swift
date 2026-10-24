import UIKit
import XCTest
@testable import AirplayDisplayCore

/// The OGS additions to the external display core: keep-awake while the phone draws the TV, and no
/// launcher token in a log line.
@MainActor
final class KeepAwakeTests: XCTestCase {
  private func controller(screens: @escaping () -> [UIScreen], awake: @escaping (Bool) -> Void) -> ExternalDisplayController {
    let c = ExternalDisplayController(center: NotificationCenter())
    c.screens = screens
    c.connectedScenes = { [] }
    c.isAppActive = { true }
    c.makeWindow = { _ in UIWindow(frame: .zero) }
    c.setIdleTimerDisabled = awake
    return c
  }

  func testAwakeOnlyWhileATvPageIsOnAConnectedDisplay() {
    let tv = FakeScreen(bounds: CGRect(x: 0, y: 0, width: 1920, height: 1080))
    var displays: [UIScreen] = [UIScreen.main]
    var calls: [Bool] = []
    let c = controller(screens: { displays }, awake: { calls.append($0) })
    let url = URL(string: "https://ogs-tv.pages.dev/?api=a&token=t")!

    c.start(url)
    XCTAssertEqual(calls, [], "a TV page with no display: the phone may sleep")

    displays = [UIScreen.main, tv]
    c.refresh()
    XCTAssertEqual(calls, [true], "display and TV page: stay awake")
    XCTAssertTrue(c.keepingAwake)

    c.refresh()
    XCTAssertEqual(calls, [true], "no repeat while nothing changes")

    c.stop()
    XCTAssertEqual(calls, [true, false], "back to the idle card: sleep is allowed again")

    c.start(url)
    XCTAssertEqual(calls, [true, false, true])
    displays = [UIScreen.main]
    c.refresh()
    XCTAssertEqual(calls, [true, false, true, false], "display gone: sleep is allowed again")
    XCTAssertFalse(c.keepingAwake)
  }

  func testAnIdleDisplayDoesNotKeepThePhoneAwake() {
    let tv = FakeScreen(bounds: CGRect(x: 0, y: 0, width: 1280, height: 720))
    var calls: [Bool] = []
    let c = controller(screens: { [UIScreen.main, tv] }, awake: { calls.append($0) })
    c.refresh()
    XCTAssertTrue(c.isConnected)
    XCTAssertEqual(calls, [])
  }

  func testLoggedUrlsKeepHostAndPathOnly() {
    XCTAssertEqual(TvViewController.safeUrl(URL(string: "https://ogs-tv.pages.dev/?api=x&token=eyJ.secret.sig")), "ogs-tv.pages.dev/")
    XCTAssertEqual(TvViewController.safeUrl(URL(string: "https://game.example/tv/room?k=1")), "game.example/tv/room")
    XCTAssertEqual(TvViewController.safeUrl(nil), "")
  }

  func testTvPageNeverOffersAirPlayMedia() {
    let vc = TvViewController()
    vc.loadViewIfNeeded()
    XCTAssertFalse(vc.webView.configuration.allowsAirPlayForMediaPlayback)
    XCTAssertFalse(vc.webView.configuration.allowsPictureInPictureMediaPlayback)
    XCTAssertEqual(vc.webView.configuration.mediaTypesRequiringUserActionForPlayback, [])
  }
}

@MainActor
final class AppNameTests: XCTestCase {
  func testTheTvSaysTheAppsName() {
    let vc = TvViewController()
    vc.appName = "OGS"
    vc.loadViewIfNeeded()
    XCTAssertEqual(vc.idleTitleText, "OGS")
    XCTAssertEqual(vc.noticeText, "Open OGS to keep the TV going")
    vc.appName = "Settlewood"
    XCTAssertEqual(vc.noticeText, "Open Settlewood to keep the TV going")
  }

  func testTheControllerPassesTheNameToItsTvWindow() {
    let tv = FakeScreen(bounds: CGRect(x: 0, y: 0, width: 1280, height: 720))
    let c = ExternalDisplayController(center: NotificationCenter())
    c.screens = { [UIScreen.main, tv] }
    c.connectedScenes = { [] }
    c.isAppActive = { true }
    c.makeWindow = { _ in UIWindow(frame: .zero) }
    c.appName = "OGS"
    c.refresh()
    let vc = c.window?.rootViewController as? TvViewController
    XCTAssertEqual(vc?.noticeText, "Open OGS to keep the TV going")
    c.appName = "Rocket Crew"
    XCTAssertEqual(vc?.idleTitleText, "Rocket Crew")
  }
}

@MainActor
final class TvModeTests: XCTestCase {
  func testASmallDisplayGetsItsLargestTvModeUpTo1080p() {
    let modes = [CGSize(width: 720, height: 480), CGSize(width: 1280, height: 720), CGSize(width: 1920, height: 1080), CGSize(width: 3840, height: 2160)]
    XCTAssertEqual(ExternalDisplayController.tvMode(current: CGSize(width: 720, height: 480), available: modes), CGSize(width: 1920, height: 1080))
  }

  func testATvAlreadyInATvModeKeepsIt() {
    let modes = [CGSize(width: 1920, height: 1080), CGSize(width: 3840, height: 2160)]
    XCTAssertNil(ExternalDisplayController.tvMode(current: CGSize(width: 3840, height: 2160), available: modes))
    XCTAssertNil(ExternalDisplayController.tvMode(current: CGSize(width: 1280, height: 720), available: modes))
  }

  func testNoBetterModeNoChange() {
    XCTAssertNil(ExternalDisplayController.tvMode(current: CGSize(width: 720, height: 480), available: [CGSize(width: 720, height: 480)]))
    XCTAssertNil(ExternalDisplayController.tvMode(current: nil, available: [CGSize(width: 1920, height: 1080)]))
  }
}

@MainActor
final class RouteDetectorTests: XCTestCase {
  /// The first build observed multipleRoutesDetected with Swift KVO, which crashes at once: detect
  /// must start, report, and stop without that.
  func testDetectStartsAndStopsWithoutCrashing() {
    let d = RouteDetector(log: NativeLog(), center: NotificationCenter())
    var seen: [Bool] = []
    d.onChange = { seen.append($0) }
    d.detect(seconds: 1)
    d.detect(seconds: 1)
    d.stop()
    XCTAssertFalse(d.available, "no AirPlay receiver in a test run")
    XCTAssertEqual(seen, [])
  }
}
