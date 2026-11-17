// The real players (`VideoElement`, `AudioElement`, `PdfElement`) are loaded on demand: see `LazyVideo`, `LazyAudio` and `LazyPdf`.
import { Audio as SingleAudio } from './audio/LazyAudio';
import { Pdf as SinglePdf } from './pdf/LazyPdf';
import { withPlaylist } from './shared/Playlist';
import { Video as SingleVideo } from './video/LazyVideo';

// each player also accepts an `items` list, shown as a carousel below it (see `shared/Playlist`)
export const Video = withPlaylist('Video', SingleVideo);
export const Audio = withPlaylist('Audio', SingleAudio);
export const Pdf = withPlaylist('Pdf', SinglePdf);
