require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

# Módulos opcionais: decididos pelo `omnistyle.config.json` na raiz do app
# (ao lado do package.json), o mesmo arquivo que o app passa ao `configure`:
#   { "modules": { "video": true } }
# Módulo fora do arquivo (ou `false`) não é compilado. Sem o arquivo, tudo é
# compilado e só o `configure` decide em runtime. Depois de mudar: `pod install`.
#
# `ios/` do app → a raiz do app é a pasta de cima
config_file = File.join(Pod::Config.instance.installation_root.to_s, "..", "omnistyle.config.json")
omnistyle_config = File.exist?(config_file) ? JSON.parse(File.read(config_file)) : nil
# (lambda, não `def`: o CocoaPods avalia o podspec dentro do módulo `Pod`)
omnistyle_module = ->(name) { omnistyle_config.nil? || omnistyle_config.dig("modules", name) == true }

video = omnistyle_module.call("video")
Pod::UI.puts "[omnistyle] video: #{video ? 'on' : 'off'}"

Pod::Spec.new do |s|
  s.name         = "omnistyle"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = "omnistyle"
  s.platforms    = { :ios => "15.1" }
  s.source       = { :git => package["repository"]["url"], :tag => s.version.to_s }
  s.swift_version = "5.9"

  # vídeo ligado: AVPlayer (Swift) + casca Fabric; desligado: só uma casca vazia com o mesmo nome
  s.source_files = video ? "ios/video/**/*.{h,m,mm,swift}" : "ios/stubs/**/*.{h,m,mm}"
  s.frameworks   = video ? %w[AVFoundation AVKit] : []

  # Gera o header `omnistyle-Swift.h` importado pelo .mm do vídeo.
  s.pod_target_xcconfig = { "DEFINES_MODULE" => "YES" }

  # O iOS só lê o omnistyle.config.json no `pod install`. Se o arquivo mudar depois,
  # o build para com um aviso claro (em vez de compilar o vídeo errado em silêncio).
  s.script_phase = {
    :name => "[omnistyle] Check omnistyle.config.json",
    :execution_position => :before_compile,
    :always_out_of_date => "1",
    :script => <<~SH
      CONFIG="${PODS_ROOT}/../../omnistyle.config.json"
      ACTUAL=$(/usr/bin/ruby -rjson -e 'p = ARGV[0]; puts(File.exist?(p) ? JSON.parse(File.read(p)).dig("modules", "video") == true : true)' "$CONFIG")
      if [ "$ACTUAL" != "#{video}" ]; then
        echo "error: [omnistyle] omnistyle.config.json mudou (video: $ACTUAL), mas o pod install foi feito com video: #{video}. Rode: cd ios && pod install"
        exit 1
      fi
    SH
  }

  # React Native (New Architecture) + código gerado pelo Codegen (OmnistyleSpec).
  install_modules_dependencies(s)
end
