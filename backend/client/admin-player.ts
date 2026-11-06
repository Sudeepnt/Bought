// Plays ads in the /admin review queue from their signed Mux stream.
for (const video of document.querySelectorAll<HTMLVideoElement>('video[data-stream]')) {
  const src = video.dataset.stream!;
  if (video.canPlayType('application/vnd.apple.mpegurl')) video.src = src;
  else {
    void import('hls.js/light').then(({ default: Hls }) => {
      const hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(video);
    });
  }
}
