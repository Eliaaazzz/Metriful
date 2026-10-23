Pod::Spec.new do |s|
  s.name           = 'MetrifulLidar'
  s.version        = '1.0.0'
  s.summary        = 'On-demand LiDAR depth measurement for food-portion scale'
  s.description    = 'Brief AVCaptureDepthDataOutput session on builtInLiDARDepthCamera; returns center distance + fx for img_w_cm.'
  s.author         = 'Metriful'
  s.homepage       = 'https://github.com/Eliaazzz/Metriful'
  s.platforms      = { :ios => '15.4' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
