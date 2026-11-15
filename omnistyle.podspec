require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "omnistyle"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = "omnistyle"
  s.platforms    = { :ios => "15.1" }
  s.source       = { :git => package["repository"]["url"], :tag => s.version.to_s }

  # Componente nativo de vídeo: casca Fabric em Objective-C++ + player em Swift (AVPlayer).
  s.source_files = "ios/**/*.{h,m,mm,swift}"
  s.swift_version = "5.9"
  s.frameworks   = "AVFoundation", "AVKit"

  # Gera o header `omnistyle-Swift.h` importado pelo .mm.
  s.pod_target_xcconfig = { "DEFINES_MODULE" => "YES" }

  # React Native (New Architecture) + código gerado pelo Codegen (OmnistyleSpec).
  install_modules_dependencies(s)
end
