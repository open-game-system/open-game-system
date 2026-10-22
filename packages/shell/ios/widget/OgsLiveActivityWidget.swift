import ActivityKit
import SwiftUI
import WidgetKit

/// The widget extension the shell's config plugin adds (target OgsLiveActivity). Copied into
/// ios/OgsLiveActivity at prebuild, with ../shared/OgsGameActivityAttributes.swift. The extension's
/// deployment target is iOS 16.2 (the plugin sets it); the app's stays what it was.
@main
struct OgsLiveActivityBundle: WidgetBundle {
  var body: some Widget {
    OgsGameLiveActivity()
  }
}

@available(iOS 16.2, *)
struct OgsGameLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: OgsGameActivityAttributes.self) { context in
      LockScreenView(attributes: context.attributes, state: context.state, stale: context.isStale)
        .activityBackgroundTint(Palette.background)
        .activitySystemActionForegroundColor(Palette.text)
        .widgetURL(URL(string: context.attributes.deepLink))
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          GameArt(attributes: context.attributes, side: 52)
            .padding(.leading, 4)
        }
        DynamicIslandExpandedRegion(.trailing) {
          RoomCode(code: context.attributes.roomCode)
            .padding(.trailing, 4)
        }
        DynamicIslandExpandedRegion(.center) {
          VStack(alignment: .leading, spacing: 2) {
            Text(context.attributes.gameName)
              .font(.headline)
              .foregroundStyle(Palette.text)
              .lineLimit(1)
            StatusLine(state: context.state)
          }
          .frame(maxWidth: .infinity, alignment: .leading)
        }
        DynamicIslandExpandedRegion(.bottom) {
          Text(context.state.phase == "ended" ? "Thanks for playing" : "Tap to return to your controller")
            .font(.caption)
            .foregroundStyle(Palette.muted)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.leading, 4)
        }
      } compactLeading: {
        GameArt(attributes: context.attributes, side: 24)
      } compactTrailing: {
        Text(compactStatus(context.state))
          .font(.caption2.weight(.semibold))
          .foregroundStyle(context.state.yourTurn ? Palette.accent : Palette.text)
          .lineLimit(1)
          .frame(maxWidth: 64)
      } minimal: {
        GameArt(attributes: context.attributes, side: 22)
      }
      .widgetURL(URL(string: context.attributes.deepLink))
      .keylineTint(Palette.accent)
    }
  }
}

/// The few words the compact island has room for.
@available(iOS 16.1, *)
func compactStatus(_ state: OgsGameActivityAttributes.ContentState) -> String {
  if state.yourTurn { return "Your turn" }
  switch state.phase {
  case "lobby": return "Lobby"
  case "waiting": return "Waiting"
  case "ended": return "Done"
  default: return "On TV"
  }
}

enum Palette {
  static let background = Color(red: 0.07, green: 0.08, blue: 0.13)
  static let text = Color.white
  static let muted = Color.white.opacity(0.62)
  static let accent = Color(red: 1.0, green: 0.76, blue: 0.29)
  static let tile = LinearGradient(
    colors: [Color(red: 0.25, green: 0.33, blue: 0.85), Color(red: 0.55, green: 0.29, blue: 0.80)],
    startPoint: .topLeading, endPoint: .bottomTrailing)
}

@available(iOS 16.2, *)
struct LockScreenView: View {
  let attributes: OgsGameActivityAttributes
  let state: OgsGameActivityAttributes.ContentState
  let stale: Bool

  var body: some View {
    HStack(alignment: .center, spacing: 14) {
      GameArt(attributes: attributes, side: 64)
      VStack(alignment: .leading, spacing: 3) {
        Text(state.phase == "ended" ? "Recently played" : "Playing on your TV")
          .font(.caption2.weight(.semibold))
          .textCase(.uppercase)
          .foregroundStyle(Palette.muted)
        Text(attributes.gameName)
          .font(.title3.weight(.bold))
          .foregroundStyle(Palette.text)
          .lineLimit(1)
        StatusLine(state: state)
        Text(stale ? "Tap to check on your game" : "Tap to return to your controller")
          .font(.caption)
          .foregroundStyle(Palette.muted)
          .lineLimit(1)
      }
      Spacer(minLength: 0)
      RoomCode(code: attributes.roomCode)
    }
    .padding(16)
  }
}

@available(iOS 16.1, *)
struct StatusLine: View {
  let state: OgsGameActivityAttributes.ContentState

  var body: some View {
    Text(state.status)
      .font(.subheadline.weight(state.yourTurn ? .bold : .regular))
      .foregroundStyle(state.yourTurn ? Palette.accent : Palette.text)
      .lineLimit(1)
  }
}

struct RoomCode: View {
  let code: String?

  var body: some View {
    if let code, !code.isEmpty {
      VStack(alignment: .trailing, spacing: 2) {
        Text("Code")
          .font(.caption2.weight(.semibold))
          .textCase(.uppercase)
          .foregroundStyle(Palette.muted)
        Text(code)
          .font(.system(.title3, design: .monospaced).weight(.bold))
          .foregroundStyle(Palette.text)
          .lineLimit(1)
          .minimumScaleFactor(0.6)
      }
    }
  }
}

/// The key art the app saved in the app group, else a tile with the game's initials.
@available(iOS 16.1, *)
struct GameArt: View {
  let attributes: OgsGameActivityAttributes
  let side: CGFloat

  var body: some View {
    Group {
      if let image = loadArt() {
        Image(uiImage: image).resizable().scaledToFill()
      } else {
        ZStack {
          Rectangle().fill(Palette.tile)
          Text(initials(attributes.gameName))
            .font(.system(size: side * 0.4, weight: .heavy, design: .rounded))
            .foregroundStyle(Color.white)
        }
      }
    }
    .frame(width: side, height: side)
    .clipShape(RoundedRectangle(cornerRadius: side * 0.22, style: .continuous))
  }

  private func loadArt() -> UIImage? {
    guard let name = attributes.art, let url = OgsLiveActivityShared.artURL(name) else { return nil }
    return UIImage(contentsOfFile: url.path)
  }
}

func initials(_ name: String) -> String {
  let words = name.split(separator: " ").prefix(2)
  let letters = words.compactMap { $0.first }.map { String($0).uppercased() }
  return letters.isEmpty ? "?" : letters.joined()
}
