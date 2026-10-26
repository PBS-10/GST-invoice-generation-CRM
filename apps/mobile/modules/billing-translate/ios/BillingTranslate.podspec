require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'BillingTranslate'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = 'MIT'
  s.author         = 'GST Invoice'
  s.homepage       = 'https://github.com/local/billing-translate'
  s.platforms      = {
    :ios => '15.1',
  }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/local/billing-translate.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'GoogleMLKit/Translate', '8.0.0'

  s.source_files = '**/*.{h,m,swift}'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
