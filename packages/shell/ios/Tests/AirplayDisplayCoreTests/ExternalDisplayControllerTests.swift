import UIKit
import XCTest
@testable import AirplayDisplayCore

/// Smoke tests for the external display core. A real second UIScreen can't be made in a test, so the
/// connected path is covered on the Simulator's external display (packages/shell/scripts/airplay-sim.sh).
@MainActor
final class ExternalDisplayControllerTests: XCTestCase {
  func testNoExternalDisplayMeansNotConnected() {
    let c = ExternalDisplayController(center: NotificationCenter())
    c.screens = { [UIScreen.main] }
    c.connectedScenes = { [] }
    c.startObserving()
    XCTAssertFalse(c.isConnected)
    XCTAssertNil(c.findExternalHost())
    XCTAssertNil(c.window)
  }

  func testStartKeepsTheTvUrlForWhenADisplayConnects() {
    let c = ExternalDisplayController(center: NotificationCenter())
    c.screens = { [UIScreen.main] }
    c.connectedScenes = { [] }
    let url = URL(string: "https://ogs-tv.pages.dev/?api=https%3A%2F%2Fapi.example&token=t")!
    c.start(url)
    XCTAssertEqual(c.tvUrl, url)
    c.stop()
    XCTAssertNil(c.tvUrl)
  }

  func testNoChangeEventWithoutADisplay() {
    let c = ExternalDisplayController(center: NotificationCenter())
    c.screens = { [UIScreen.main] }
    c.connectedScenes = { [] }
    var events = 0
    c.onChange = { _, _ in events += 1 }
    c.refresh()
    c.refresh()
    XCTAssertEqual(events, 0)
  }

  func testOnlyExternalDisplaySceneRolesCount() {
    XCTAssertTrue(ExternalDisplayController.isExternalRole(.windowExternalDisplayNonInteractive))
    XCTAssertTrue(ExternalDisplayController.isExternalRole(UISceneSession.Role(rawValue: "UIWindowSceneSessionRoleExternalDisplay")))
    XCTAssertFalse(ExternalDisplayController.isExternalRole(.windowApplication))
  }

  func testDisplayNameFallsBackToTV() {
    // No AirPlay route in a test run.
    XCTAssertEqual(ExternalDisplayController.displayName(), "TV")
  }

  func testTvViewIdleCardPageAndAwayNotice() {
    let vc = TvViewController()
    vc.loadViewIfNeeded()
    XCTAssertTrue(vc.isIdle, "nothing cast yet: the idle card, never a mirror of the phone")
    vc.load(URL(string: "https://ogs-tv.pages.dev/?api=https%3A%2F%2Fapi.example&token=t")!)
    XCTAssertFalse(vc.isIdle)
    XCTAssertEqual(vc.loadedUrl?.absoluteString, "https://ogs-tv.pages.dev/?api=https%3A%2F%2Fapi.example&token=t")
    vc.setAwayNotice(true)
    XCTAssertTrue(vc.isShowingNotice)
    vc.showIdle()
    XCTAssertTrue(vc.isIdle)
    XCTAssertNil(vc.loadedUrl)
  }

  /// A TV that changes mode mid-session (an AirPlay receiver switching resolution, or the Simulator's
  /// external display going 720×480 → 1080p) must not leave the TV page in a corner of the screen.
  func testTvWindowFollowsTheDisplayWhenItsModeChanges() {
    let center = NotificationCenter()
    let tv = FakeScreen(bounds: CGRect(x: 0, y: 0, width: 720, height: 480))
    let c = ExternalDisplayController(center: center)
    c.screens = { [UIScreen.main, tv] }
    c.isAppActive = { true }
    c.makeWindow = { _ in UIWindow(frame: .zero) }  // UIKit won't put a window on a fake screen
    c.startObserving()
    XCTAssertEqual(c.window?.frame, CGRect(x: 0, y: 0, width: 720, height: 480))

    tv.fakeBounds = CGRect(x: 0, y: 0, width: 1920, height: 1080)
    center.post(name: UIScreen.modeDidChangeNotification, object: tv)
    XCTAssertEqual(c.window?.frame, CGRect(x: 0, y: 0, width: 1920, height: 1080))
    c.window?.layoutIfNeeded()
    let tvView = c.window?.rootViewController?.view
    XCTAssertEqual(tvView?.frame.size, CGSize(width: 1920, height: 1080), "the TV page fills the display")
    c.stopObserving()
  }

  func testRefreshResyncsTheTvWindowWithTheSameDisplay() {
    let tv = FakeScreen(bounds: CGRect(x: 0, y: 0, width: 720, height: 480))
    let c = ExternalDisplayController(center: NotificationCenter())
    c.screens = { [UIScreen.main, tv] }
    c.isAppActive = { true }
    c.makeWindow = { _ in UIWindow(frame: .zero) }  // UIKit won't put a window on a fake screen
    var events = 0
    c.onChange = { _, _ in events += 1 }
    c.refresh()
    tv.fakeBounds = CGRect(x: 0, y: 0, width: 1280, height: 720)
    c.refresh()
    XCTAssertEqual(c.window?.frame, CGRect(x: 0, y: 0, width: 1280, height: 720))
    XCTAssertEqual(events, 1, "a resize is not a reconnect")
  }
}

/// An external screen whose mode the test can change.
final class FakeScreen: UIScreen {
  var fakeBounds: CGRect
  init(bounds: CGRect) {
    fakeBounds = bounds
    super.init()
  }
  override var bounds: CGRect { fakeBounds }
}
