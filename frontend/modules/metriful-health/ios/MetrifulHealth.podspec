Pod::Spec.new do |s|
  s.name = 'MetrifulHealth'
  s.version = '1.0.0'
  s.summary = 'Read-only Apple Health summaries for Metriful'
  s.description = 'User-initiated daily activity, sleep and body mass queries.'
  s.author = 'Metriful'
  s.homepage = 'https://github.com/Eliaaazzz/Metriful'
  s.platforms = { :ios => '15.4' }
  s.source = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'HealthKit'
  s.swift_version = '5.0'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.{h,m,mm,swift}'
end
