import UIKit
import WebKit
import XCTest
@testable import AirplayDisplayCore

/// What the two WebViews learn from the app (docs/adrs/2026-10-23-airplay-display.md "Pages"): the TV
/// page gets the app's log ids before its scripts run; the phone page is told when the TV window comes
/// and goes (`ogs:tv`), so it can go quiet while the TV plays the sound. And the idle card is the app's.
@MainActor
final class PageBridgeTests: XCTestCase {
  func testThePhonePageScriptSetsTheGlobalsAndDispatchesOgsTv() {
    let js = PhonePages.script(connected: true, logContext: ["device": "a-1", "session": "app-2"])
    XCTAssertTrue(js.contains("window.__OGS_TV__ = true;"))
    XCTAssertTrue(js.contains("new CustomEvent('ogs:tv', { detail: { connected: true } })"))
    XCTAssertTrue(js.contains("window.__OGS_LOG__ = {"))
    XCTAssertTrue(js.contains("\"device\":\"a-1\""))
    XCTAssertTrue(js.contains("\"session\":\"app-2\""))

    let off = PhonePages.script(connected: false, logContext: [:])
    XCTAssertTrue(off.contains("window.__OGS_TV__ = false;"))
    XCTAssertTrue(off.contains("detail: { connected: false }"))
    XCTAssertFalse(off.contains("__OGS_LOG__"), "no log ids handed over: the page keeps its own")
  }

  func testTheTvPageGetsTheLogContextAtDocumentStart() {
    let vc = TvViewController()
    vc.logContext = ["device": "a-1", "session": "app-2"]
    vc.loadViewIfNeeded()
    let scripts = vc.webView.configuration.userContentController.userScripts
    XCTAssertEqual(scripts.count, 1)
    XCTAssertEqual(scripts.first?.injectionTime, .atDocumentStart)
    XCTAssertTrue(scripts.first?.source.contains("window.__OGS_LOG__ = {") ?? false)
    XCTAssertTrue(scripts.first?.source.contains("\"device\":\"a-1\"") ?? false)

    vc.logContext = ["device": "a-3"]
    let again = vc.webView.configuration.userContentController.userScripts
    XCTAssertEqual(again.count, 1, "a new context replaces the old one")
    XCTAssertTrue(again.first?.source.contains("\"device\":\"a-3\"") ?? false)
  }

  func testTheControllerHandsItsLogContextToTheTvWindow() {
    let tv = FakeScreen(bounds: CGRect(x: 0, y: 0, width: 1920, height: 1080))
    let c = ExternalDisplayController(center: NotificationCenter())
    c.screens = { [UIScreen.main, tv] }
    c.connectedScenes = { [] }
    c.isAppActive = { true }
    c.makeWindow = { _ in UIWindow(frame: .zero) }
    c.setIdleTimerDisabled = { _ in }
    c.logContext = ["device": "a-1"]
    c.refresh()
    let vc = c.window?.rootViewController as? TvViewController
    XCTAssertEqual(vc?.logContext, ["device": "a-1"])
    c.logContext = ["device": "a-2"]
    XCTAssertEqual(vc?.logContext, ["device": "a-2"])
  }

  func testTheIdleCardIsTheApps() {
    let vc = TvViewController()
    vc.loadViewIfNeeded()
    XCTAssertEqual(vc.idleLineText, "Pick a game on your phone to show it here.")
    vc.idleCard = IdleCard(line: "Open a table on your phone to show it here.", background: "#1f3d34")
    XCTAssertEqual(vc.idleLineText, "Open a table on your phone to show it here.")
    XCTAssertEqual(vc.view.backgroundColor, UIColor(red: 0x1f / 255, green: 0x3d / 255, blue: 0x34 / 255, alpha: 1))
  }

  func testIdleCardColoursParseOnlyHex() {
    XCTAssertNotNil(IdleCard.color("#1f3d34"))
    XCTAssertNotNil(IdleCard.color("1F3D34"))
    XCTAssertNil(IdleCard.color("green"))
    XCTAssertNil(IdleCard.color("#12345"))
    XCTAssertNil(IdleCard.color("#gg3d34"))
  }

  func testTheControllerHandsItsIdleCardToTheTvWindow() {
    let tv = FakeScreen(bounds: CGRect(x: 0, y: 0, width: 1920, height: 1080))
    let c = ExternalDisplayController(center: NotificationCenter())
    c.screens = { [UIScreen.main, tv] }
    c.connectedScenes = { [] }
    c.isAppActive = { true }
    c.makeWindow = { _ in UIWindow(frame: .zero) }
    c.setIdleTimerDisabled = { _ in }
    c.idleCard = IdleCard(line: "Open a table", background: nil)
    c.refresh()
    let vc = c.window?.rootViewController as? TvViewController
    XCTAssertEqual(vc?.idleLineText, "Open a table")
  }
}
