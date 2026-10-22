require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

# The shell's native module (OgsLiveActivity: ActivityKit for the controller's Live Activity).
# The widget extension's sources (widget/) are not part of this pod: the config plugin copies them,
# with shared/, into the app's own OgsLiveActivity target at prebuild.
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

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = 'module/**/*.swift', 'shared/**/*.swift'
end
