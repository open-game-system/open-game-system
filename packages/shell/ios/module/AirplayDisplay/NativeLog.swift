import Foundation
import os

/// One native event for the client log (docs/agents/client-log.md): forwarded to JS (module event `onLog`),
/// kept in a ring so JS can read what happened before it was listening, and written to os_log
/// (subsystem: the app's bundle id, category `airplay`;
/// `log stream --predicate 'subsystem == "org.opengame.app" AND category == "airplay"'`).
struct NativeLogEvent {
  let seq: Int
  let at: Double
  let type: String
  let level: String
  let data: [String: Any]

  var payload: [String: Any] { ["seq": seq, "at": at, "type": type, "level": level, "data": data] }
}

/// Main thread only. Values in `data` are strings, numbers, booleans or NSNull: flat, like the web log.
final class NativeLog {
  static let shared = NativeLog()

  var sink: ((NativeLogEvent) -> Void)?
  private(set) var ring: [NativeLogEvent] = []
  private var seq = 0
  private let capacity: Int
  private let logger = Logger(subsystem: Bundle.main.bundleIdentifier ?? "org.opengame.shell", category: "airplay")
  var now: () -> Double = { Date().timeIntervalSince1970 * 1000 }

  init(capacity: Int = 300) {
    self.capacity = capacity
  }

  func info(_ type: String, _ data: [String: Any] = [:]) { emit(type, "info", data) }
  func warn(_ type: String, _ data: [String: Any] = [:]) { emit(type, "warn", data) }
  func error(_ type: String, _ data: [String: Any] = [:]) { emit(type, "error", data) }

  func emit(_ type: String, _ level: String, _ data: [String: Any]) {
    seq += 1
    let event = NativeLogEvent(seq: seq, at: now(), type: type, level: level, data: Self.flat(data))
    ring.append(event)
    if ring.count > capacity { ring.removeFirst(ring.count - capacity) }
    let text = Self.describe(event.data)
    switch level {
    case "error": logger.error("\(type, privacy: .public) \(text, privacy: .public)")
    case "warn": logger.warning("\(type, privacy: .public) \(text, privacy: .public)")
    default: logger.info("\(type, privacy: .public) \(text, privacy: .public)")
    }
    sink?(event)
  }

  /// Events after `seq` (all of them for 0).
  func since(_ after: Int) -> [NativeLogEvent] { ring.filter { $0.seq > after } }

  /// Keeps only flat values; anything else becomes its description.
  static func flat(_ data: [String: Any]) -> [String: Any] {
    var out: [String: Any] = [:]
    for (k, v) in data {
      switch v {
      case let b as Bool: out[k] = b
      case let i as Int: out[k] = i
      case let d as Double: out[k] = d.isFinite ? d : NSNull()
      case let f as CGFloat: out[k] = Double(f)
      case let s as String: out[k] = String(s.prefix(500))
      case is NSNull: out[k] = NSNull()
      default: out[k] = String(String(describing: v).prefix(500))
      }
    }
    return out
  }

  static func describe(_ data: [String: Any]) -> String {
    data.keys.sorted().map { "\($0)=\(data[$0].map { String(describing: $0) } ?? "")" }.joined(separator: " ")
  }
}
