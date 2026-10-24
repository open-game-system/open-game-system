require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

# The shell's native modules (module/): OgsAirplayDisplay, the AirPlay / external-display TV window.
# Package.swift and Tests/ are only for the XCTest run (README "Tests"); they are not part of this pod.
Pod::Spec.new do |s|
  s.name           = 'OgsShell'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = package['license']
  s.author         = 'Open Game System'
  s.homepage       = 'https://github.com/open-game-system/open-game-system'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/open-game-system/open-game-system.git' }
  s.static_framework = true
  s.frameworks     = 'UIKit', 'WebKit', 'AVFoundation', 'AVKit', 'MediaPlayer'

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = 'module/**/*.swift', 'shared/**/*.swift'
end
