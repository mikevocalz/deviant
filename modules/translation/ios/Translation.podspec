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

  # Weak-link Apple's Translation framework (iOS 18.0+). Swift cannot self-import,
  # so `import Translation` inside this pod resolves to Apple's system framework.
  s.weak_framework = 'Translation'
end
