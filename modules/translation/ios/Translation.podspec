require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'Translation'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = { :type => 'MIT' }
  s.author         = 'DVNT'
  s.homepage       = 'https://github.com/dvnt'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"

  # Override Swift module name so `import Translation` inside this pod's files
  # resolves to Apple's system Translation framework, not this pod's module.
  s.module_name = 'DVNTTranslation'

  # Weak-link the Translation framework (iOS 17.4+) so the app still
  # launches on older OS versions — the #available check gates usage.
  s.weak_framework = 'Translation'
end
