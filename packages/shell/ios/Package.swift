// swift-tools-version:5.9
// Only for the AirPlay display's XCTest run (packages/shell README "Tests"): its UIKit core without
// ExpoModulesCore. CocoaPods builds the module from OgsShell.podspec, which never reads this file.
import PackageDescription

let package = Package(
  name: "AirplayDisplayCore",
  platforms: [.iOS(.v16)],
  products: [.library(name: "AirplayDisplayCore", targets: ["AirplayDisplayCore"])],
  targets: [
    .target(
      name: "AirplayDisplayCore",
      path: "module/AirplayDisplay",
      exclude: ["OgsAirplayDisplayModule.swift"]
    ),
    .testTarget(name: "AirplayDisplayCoreTests", dependencies: ["AirplayDisplayCore"], path: "Tests/AirplayDisplayCoreTests"),
  ]
)
