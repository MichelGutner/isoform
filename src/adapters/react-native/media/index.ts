import { Audio as SingleAudio } from './audio/Audio';
import { Pdf as SinglePdf } from './pdf/Pdf';
import { withPlaylist } from './shared/Playlist';
import { Video as SingleVideo } from './video/Video';

// each player also accepts an `items` list, shown as a carousel below it (see `shared/Playlist`)
export const Video = withPlaylist('Video', SingleVideo);
export const Audio = withPlaylist('Audio', SingleAudio);
export const Pdf = withPlaylist('Pdf', SinglePdf);
