import ActivityKit
import ExpoModulesCore
import UIKit

/// ActivityKit for the shell's JS runtime (src/live-activity-native.ts parses everything this sends).
/// Attributes and content cross as JSON so the Codable types above are the only encoding: the same
/// one the API's `liveactivity` pushes use for `content-state`.
public class OgsLiveActivityModule: Module {
  private var watched = Set<String>()

  public func definition() -> ModuleDefinition {
    Name("OgsLiveActivity")

    Events("onPushToken", "onStateChange", "onPushToStartToken")

    OnCreate {
      self.observePushToStart()
    }

    /// iOS 16.2+ and Live Activities allowed for this app.
    Function("areActivitiesEnabled") { () -> Bool in
      guard #available(iOS 16.2, *) else { return false }
      return ActivityAuthorizationInfo().areActivitiesEnabled
    }

    AsyncFunction("startActivity") {
      (attributesJson: String, contentJson: String, staleAt: Double) async throws -> String in
      guard #available(iOS 16.2, *) else { throw LiveActivityUnsupportedException() }
      let attributes = try JSONDecoder().decode(
        OgsGameActivityAttributes.self, from: Data(attributesJson.utf8))
      let state = try Self.decodeState(contentJson)
      let content = ActivityContent(state: state, staleDate: Self.date(staleAt))
      // A relaunched app finds its game's activity still up: keep that one, never a second card.
      if let running = Activity<OgsGameActivityAttributes>.activities.first(where: {
        $0.attributes.appId == attributes.appId && $0.activityState == .active
      }) {
        await running.update(content)
        self.watch(running)
        return running.id
      }
      let activity: Activity<OgsGameActivityAttributes>
      do {
        activity = try Activity.request(attributes: attributes, content: content, pushType: .token)
      } catch {
        // No push entitlement (some simulator and dev builds): local updates still work.
        activity = try Activity.request(attributes: attributes, content: content, pushType: nil)
      }
      self.watch(activity)
      return activity.id
    }

    AsyncFunction("updateActivity") { (id: String, contentJson: String, staleAt: Double) async throws in
      guard #available(iOS 16.2, *), let activity = Self.activity(id) else { return }
      let state = try Self.decodeState(contentJson)
      await activity.update(ActivityContent(state: state, staleDate: Self.date(staleAt)))
    }

    AsyncFunction("endActivity") { (id: String, contentJson: String, dismissAt: Double) async throws in
      guard #available(iOS 16.2, *), let activity = Self.activity(id) else { return }
      let state = try Self.decodeState(contentJson)
      await activity.end(
        ActivityContent(state: state, staleDate: nil),
        dismissalPolicy: .after(Self.date(dismissAt)))
    }

    /// Downloads the key art, shrinks it to a small square PNG and saves it in the app group for the
    /// widget (which can't fetch). Answers the file name, or nil without an app group.
    AsyncFunction("prepareArt") { (url: String, name: String) async throws -> String? in
      guard let source = URL(string: url), source.scheme == "https",
        let target = OgsLiveActivityShared.artURL(name)
      else { return nil }
      let (data, _) = try await URLSession.shared.data(from: source)
      guard let image = UIImage(data: data), let png = Self.thumbnail(image, side: 120).pngData()
      else { return nil }
      try FileManager.default.createDirectory(
        at: target.deletingLastPathComponent(), withIntermediateDirectories: true)
      try png.write(to: target, options: .atomic)
      return name
    }
  }

  @available(iOS 16.2, *)
  private static func activity(_ id: String) -> Activity<OgsGameActivityAttributes>? {
    Activity<OgsGameActivityAttributes>.activities.first(where: { $0.id == id })
  }

  @available(iOS 16.1, *)
  private static func decodeState(_ json: String) throws -> OgsGameActivityAttributes.ContentState {
    try JSONDecoder().decode(OgsGameActivityAttributes.ContentState.self, from: Data(json.utf8))
  }

  private static func date(_ ms: Double) -> Date {
    Date(timeIntervalSince1970: ms / 1000)
  }

  private static func hex(_ data: Data) -> String {
    data.map { String(format: "%02x", $0) }.joined()
  }

  private static func thumbnail(_ image: UIImage, side: CGFloat) -> UIImage {
    let size = CGSize(width: side, height: side)
    let scale = max(side / image.size.width, side / image.size.height)
    let drawn = CGSize(width: image.size.width * scale, height: image.size.height * scale)
    let format = UIGraphicsImageRendererFormat()
    format.scale = 1
    return UIGraphicsImageRenderer(size: size, format: format).image { _ in
      image.draw(
        in: CGRect(
          x: (side - drawn.width) / 2, y: (side - drawn.height) / 2,
          width: drawn.width, height: drawn.height))
    }
  }

  /// Each activity's push token (remote updates) and state (the user dismissed it), once.
  @available(iOS 16.2, *)
  private func watch(_ activity: Activity<OgsGameActivityAttributes>) {
    guard !watched.contains(activity.id) else { return }
    watched.insert(activity.id)
    let id = activity.id
    Task { [weak self] in
      for await token in activity.pushTokenUpdates {
        self?.sendEvent("onPushToken", ["activityId": id, "token": Self.hex(token)])
      }
    }
    Task { [weak self] in
      for await state in activity.activityStateUpdates {
        self?.sendEvent("onStateChange", ["activityId": id, "state": "\(state)"])
      }
    }
  }

  /// iOS 17.2+: the token APNs can start an activity with (push-to-start).
  private func observePushToStart() {
    guard #available(iOS 17.2, *) else { return }
    Task { [weak self] in
      for await token in Activity<OgsGameActivityAttributes>.pushToStartTokenUpdates {
        self?.sendEvent("onPushToStartToken", ["token": Self.hex(token)])
      }
    }
  }
}

final class LiveActivityUnsupportedException: Exception {
  override var reason: String {
    "Live Activities need iOS 16.2 or later"
  }
}
