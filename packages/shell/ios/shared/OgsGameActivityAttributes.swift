import ActivityKit
import Foundation

/// The controller phone's Live Activity: one game on the TV.
///
/// Compiled into both the app (the OgsLiveActivity module) and the widget extension, so ActivityKit
/// matches them by this type name. A push-to-start payload names it as `attributes-type`.
/// Mirrors `LiveActivityAttributesSchema` / `LiveActivityContentSchema` in
/// `@open-game-system/ogs-protocol` (live-activity.ts): the JS side sends exactly this JSON, and the
/// API's `liveactivity` pushes carry `ContentState` as `content-state`.
@available(iOS 16.1, *)
public struct OgsGameActivityAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    /// lobby, waiting, playing or ended.
    public var phase: String
    /// "Round 3 · Your turn", "In lobby", "Waiting for players".
    public var status: String
    public var yourTurn: Bool
    /// ms since epoch.
    public var updatedAt: Double

    public init(phase: String, status: String, yourTurn: Bool, updatedAt: Double) {
      self.phase = phase
      self.status = status
      self.yourTurn = yourTurn
      self.updatedAt = updatedAt
    }
  }

  public var appId: String
  public var gameName: String
  /// The code people type to join, when there is one.
  public var roomCode: String?
  /// `<scheme>://live-activity/<appId>`: a tap returns to the controller.
  public var deepLink: String
  /// The key art's file name in the shared app group container (the app wrote it).
  public var art: String?

  public init(appId: String, gameName: String, roomCode: String?, deepLink: String, art: String?) {
    self.appId = appId
    self.gameName = gameName
    self.roomCode = roomCode
    self.deepLink = deepLink
    self.art = art
  }
}

/// The app group both targets share (Info.plist `OGSAppGroup`, written by the config plugin).
public enum OgsLiveActivityShared {
  public static var appGroup: String? {
    Bundle.main.object(forInfoDictionaryKey: "OGSAppGroup") as? String
  }

  /// Where the app saves key art and the widget reads it; nil without the app group entitlement.
  public static func artURL(_ name: String) -> URL? {
    guard let group = appGroup,
      let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group)
    else { return nil }
    return container.appendingPathComponent("ogs-live-activity", isDirectory: true)
      .appendingPathComponent(name)
  }
}
