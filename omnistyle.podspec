require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

# Módulos opcionais: decididos pelo `omnistyle.config.json` na raiz do app
# (ao lado do package.json), o mesmo arquivo que o app passa ao `configure`:
#   { "modules": { "video": true, "audio": { "enabled": true, "mediaSession": true }, "pdf": true } }
# (cada módulo aceita `true` ou `{ "enabled": true, ...opções }`)
# Módulo fora do arquivo (ou `false`) não é compilado. Sem o arquivo, tudo é
# compilado e só o `configure` decide em runtime. Depois de mudar: `pod install`.
#
# `ios/` do app → a raiz do app é a pasta de cima
config_file = File.join(Pod::Config.instance.installation_root.to_s, "..", "omnistyle.config.json")
omnistyle_config = File.exist?(config_file) ? JSON.parse(File.read(config_file)) : nil
# (lambda, não `def`: o CocoaPods avalia o podspec dentro do módulo `Pod`)
omnistyle_on = ->(setting) { setting == true || (setting.is_a?(Hash) && setting["enabled"] == true) }
omnistyle_module = ->(name) { omnistyle_config.nil? || omnistyle_on.call(omnistyle_config.dig("modules", name)) }

video = omnistyle_module.call("video")
audio = omnistyle_module.call("audio")
pdf = omnistyle_module.call("pdf")
sheet = omnistyle_module.call("sheet")
camera = omnistyle_module.call("camera")
# camera features: each one only with the module on and its option `true` (all on without the file)
camera_setting = omnistyle_config.nil? ? nil : omnistyle_config.dig("modules", "camera")
camera_feature = ->(name) { camera && (omnistyle_config.nil? || (camera_setting.is_a?(Hash) && camera_setting[name] == true)) }
camera_video = camera_feature.call("video")
camera_codes = camera_feature.call("codeScanner")
# controles na tela de bloqueio: só com `audio.mediaSession: true` explícito (nunca por padrão)
audio_setting = omnistyle_config.nil? ? nil : omnistyle_config.dig("modules", "audio")
media_session = audio && audio_setting.is_a?(Hash) && audio_setting["mediaSession"] == true
Pod::UI.puts "[omnistyle] video: #{video ? 'on' : 'off'}, audio: #{audio ? 'on' : 'off'}, mediaSession: #{media_session ? 'on' : 'off'}, pdf: #{pdf ? 'on' : 'off'}, sheet: #{sheet ? 'on' : 'off'}, camera: #{camera ? 'on' : 'off'} (video: #{camera_video ? 'on' : 'off'}, codeScanner: #{camera_codes ? 'on' : 'off'})"

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

  # módulo ligado: o player (Swift) + a casca Fabric; desligado: só uma casca vazia com o mesmo nome.
  # `ios/shared` (sessão de áudio) entra se qualquer um dos dois estiver ligado.
  sources = []
  sources << (video ? "ios/video/**/*.{h,m,mm,swift}" : "ios/stubs/video/**/*.{h,m,mm}")
  sources << (audio ? "ios/audio/**/*.{h,m,mm,swift}" : "ios/stubs/audio/**/*.{h,m,mm}")
  sources << (pdf ? "ios/pdf/**/*.{h,m,mm,swift}" : "ios/stubs/pdf/**/*.{h,m,mm}")
  # bottom sheet: SwiftUI `.sheet` hosting the React children
  sources << (sheet ? "ios/sheet/**/*.{h,m,mm,swift}" : "ios/stubs/sheet/**/*.{h,m,mm}")
  # camera: AVFoundation; video and the code scanner are compiled in only when on (Swift flags below)
  sources << (camera ? "ios/camera/**/*.{h,m,mm,swift}" : "ios/stubs/camera/**/*.{h,m,mm}")
  sources << "ios/shared/**/*.swift" if video || audio
  # o áudio sempre usa `OmniNowPlaying`: a versão real (tela de bloqueio) ou a vazia
  sources << (media_session ? "ios/mediaSession/**/*.swift" : "ios/mediaSessionOff/**/*.swift") if audio
  s.source_files = sources
  # PDF: PDFKit for the viewer, AVFoundation for reading aloud (AVSpeechSynthesizer)
  s.frameworks   = (video ? %w[AVFoundation AVKit] : []) | (audio ? %w[AVFoundation] : []) | (media_session ? %w[MediaPlayer] : []) | (pdf ? %w[PDFKit AVFoundation AVKit] : []) | (sheet ? %w[SwiftUI] : []) | (camera ? %w[AVFoundation ImageIO] : [])

  # Gera o header `omnistyle-Swift.h` importado pelo .mm do vídeo.
  # Camera features as Swift compilation conditions (`#if OMNI_CAMERA_VIDEO`…).
  camera_flags = [("OMNI_CAMERA_VIDEO" if camera_video), ("OMNI_CAMERA_CODES" if camera_codes)].compact
  s.pod_target_xcconfig = {
    "DEFINES_MODULE" => "YES",
    "SWIFT_ACTIVE_COMPILATION_CONDITIONS" => (["$(inherited)"] + camera_flags).join(" "),
  }

  # O iOS só lê o omnistyle.config.json no `pod install`. Se o arquivo mudar depois,
  # o build para com um aviso claro (em vez de compilar o vídeo errado em silêncio).
  s.script_phase = {
    :name => "[omnistyle] Check omnistyle.config.json",
    :execution_position => :before_compile,
    :always_out_of_date => "1",
    :script => <<~SH
      CONFIG="${PODS_ROOT}/../../omnistyle.config.json"
      ACTUAL=$(/usr/bin/ruby -rjson -e 'p = ARGV[0]; on = ->(v) { v == true || (v.is_a?(Hash) && v["enabled"] == true) }; m = File.exist?(p) ? (JSON.parse(File.read(p))["modules"] || {}) : nil; if m.nil? then puts "video:true,audio:true,mediaSession:false,pdf:true,sheet:true,camera:true,cameraVideo:true,cameraCodes:true" else a = m["audio"]; c = m["camera"]; f = ->(k) { (on.call(c) && c.is_a?(Hash) && c[k] == true).to_s }; puts "video:" + on.call(m["video"]).to_s + ",audio:" + on.call(a).to_s + ",mediaSession:" + (on.call(a) && a.is_a?(Hash) && a["mediaSession"] == true).to_s + ",pdf:" + on.call(m["pdf"]).to_s + ",sheet:" + on.call(m["sheet"]).to_s + ",camera:" + on.call(c).to_s + ",cameraVideo:" + f.call("video") + ",cameraCodes:" + f.call("codeScanner") end' "$CONFIG")
      EXPECTED="video:#{video},audio:#{audio},mediaSession:#{media_session},pdf:#{pdf},sheet:#{sheet},camera:#{camera},cameraVideo:#{camera_video},cameraCodes:#{camera_codes}"
      if [ "$ACTUAL" != "$EXPECTED" ]; then
        echo "error: [omnistyle] omnistyle.config.json mudou ($ACTUAL), mas o pod install foi feito com $EXPECTED. Rode: cd ios && pod install"
        exit 1
      fi

      # mediaSession: o iOS só deixa o áudio tocar com a tela bloqueada se o Info.plist do app
      # tiver `UIBackgroundModes` → `audio`. Um pod não consegue declarar isso, então o build
      # acrescenta a chave (idempotente; o mesmo que `scripts/setup-ios.js`).
      if [ "#{media_session}" = "true" ]; then
        IOS_DIR=$(cd "${PODS_ROOT}/.." && pwd)
        for PLIST in "$IOS_DIR"/*/Info.plist; do
          [ -f "$PLIST" ] || continue
          case "$PLIST" in */Pods/*|*/build/*) continue ;; esac
          MODES=$(/usr/bin/plutil -extract UIBackgroundModes json -o - "$PLIST" 2>/dev/null)
          case "$MODES" in
            *'"audio"'*) ;;
            "") /usr/bin/plutil -insert UIBackgroundModes -json '["audio"]' "$PLIST" && echo "note: [omnistyle] UIBackgroundModes audio adicionado em $PLIST" ;;
            *) /usr/bin/plutil -insert UIBackgroundModes.0 -string audio "$PLIST" && echo "note: [omnistyle] UIBackgroundModes audio adicionado em $PLIST" ;;
          esac
        done
      fi

      # camera: iOS closes the app on the first camera (or microphone) access without the
      # usage text in Info.plist. The build adds a default one only when it is missing;
      # set your own (it is the text of the system dialog) in Info.plist or app.json.
      add_usage() {
        KEY="$1"; TEXT="$2"
        IOS_DIR=$(cd "${PODS_ROOT}/.." && pwd)
        for PLIST in "$IOS_DIR"/*/Info.plist; do
          [ -f "$PLIST" ] || continue
          case "$PLIST" in */Pods/*|*/build/*) continue ;; esac
          if ! /usr/bin/plutil -extract "$KEY" raw -o - "$PLIST" >/dev/null 2>&1; then
            /usr/bin/plutil -insert "$KEY" -string "$TEXT" "$PLIST" && echo "note: [omnistyle] $KEY adicionado em $PLIST"
          fi
        done
      }
      if [ "#{camera}" = "true" ]; then add_usage NSCameraUsageDescription "This app uses the camera to take photos and scan codes."; fi
      if [ "#{camera_video}" = "true" ]; then add_usage NSMicrophoneUsageDescription "This app uses the microphone to record sound with videos."; fi
    SH
  }

  # React Native (New Architecture) + código gerado pelo Codegen (OmnistyleSpec).
  install_modules_dependencies(s)
end
