/** Public media used by the Video, Audio and Pdf pages (all work on web, iOS and Android). */

/** Test videos. */
export const VIDEOS = {
  /** MDN, CC0. MP4 (H.264). */
  flower: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
  /** Big Buck Bunny (Blender Foundation), 10 s excerpt in 720p. MP4 (H.264). */
  bunny: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4',
  /** Apple's test stream. HLS: plays on iOS, Android and Safari (Chrome may not). */
  hls: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8',
  sintel: 'https://archive.org/download/TearsOfSteel_124/Content/tears_of_steel_720p.mp4'
};

/** A placeholder image from Picsum (the same seed always gives the same picture). */
export const picture = (seed: string, width: number, height: number) => `https://picsum.photos/seed/${seed}/${width}/${height}`;

/** PDFs served with CORS, so they open on the web too. */
export const PDFS = {
  /** pdf.js paper (Mozilla): 14 pages of text, with links and an outline. */
  paper: 'https://raw.githubusercontent.com/mozilla/pdf.js/master/web/compressed.tracemonkey-pldi-09.pdf',
  review: 'https://raw.githubusercontent.com/mozilla/pdf.js/master/test/pdfs/TAMReview.pdf',
  hello: 'https://raw.githubusercontent.com/mozilla/pdf.js/master/examples/learning/helloworld.pdf',
};

/** One song of the SoundHelix examples (free test music). */
export const song = (n: number) => `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${n}.mp3`;

/** The lists the pages pass as `items`. */
export const LISTS = {
  videos: [
    { src: VIDEOS.bunny, title: 'Big Buck Bunny', poster: picture('iso-v1', 640, 360) },
    { src: VIDEOS.flower, title: 'Flower', poster: picture('iso-v2', 640, 360) },
    { src: VIDEOS.hls, title: 'Apple bipbop (HLS)', poster: picture('iso-v3', 640, 360) },
    { src: VIDEOS.bunny, title: 'Big Buck Bunny again', poster: picture('iso-v4', 640, 360) },
    { src: VIDEOS.sintel, title: 'Sintel' }
  ],
  audios: [1, 2, 3, 8].map((n) => ({
    src: song(n),
    title: `Song ${n}`,
    artist: 'SoundHelix',
    artwork: picture(`iso-a${n}`, 600, 600),
  })),
  pdfs: [
    { src: PDFS.paper, title: 'pdf.js paper', thumbnail: picture('iso-p1', 300, 400) },
    { src: PDFS.review, title: 'Review article', thumbnail: picture('iso-p2', 300, 400) },
    { src: PDFS.hello, title: 'Hello world' },
  ],
};
