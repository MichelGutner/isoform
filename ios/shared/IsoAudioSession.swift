import AVFoundation

/// Sessão de áudio do vídeo (o que decide se ele toca com a chave do modo silencioso ligada).
///
/// - Com som: categoria `.playback`. Toca mesmo no modo silencioso, como no Fotos
///   ou no YouTube; é o que o usuário espera de um vídeo que ele mandou tocar.
/// - Mudo (ex.: prévia em autoplay): `.ambient` com mixagem, para NÃO interromper a
///   música de outro app. Só troca a categoria padrão do iOS (`.soloAmbient`), nunca a
///   que o app (ou outro vídeo tocando com som) já escolheu.
/// - Ao terminar: libera a sessão e avisa os outros apps (a música volta a tocar).
enum IsoAudioSession {
  private static var session: AVAudioSession { .sharedInstance() }

  /// Chamado sempre que o vídeo começa ou volta a tocar, e quando o som é ligado.
  static func prepare(muted: Bool) {
    muted ? prepareMuted() : prepareWithSound()
  }

  /// Devolve o áudio aos outros apps quando o vídeo acaba ou sai da tela.
  static func release() {
    try? session.setActive(false, options: .notifyOthersOnDeactivation)
  }

  private static func prepareWithSound() {
    configure(.playback, mode: .moviePlayback, options: [])
  }

  private static func prepareMuted() {
    guard session.category == .soloAmbient else { return }
    configure(.ambient, mode: .default, options: [.mixWithOthers])
  }

  private static func configure(_ category: AVAudioSession.Category, mode: AVAudioSession.Mode, options: AVAudioSession.CategoryOptions) {
    do {
      let changed = session.category != category || session.mode != mode || session.categoryOptions != options
      if changed { try session.setCategory(category, mode: mode, options: options) }
      try session.setActive(true)
    } catch {
      NSLog("[isoform] AVAudioSession: %@", error.localizedDescription)
    }
  }
}
