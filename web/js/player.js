// Video shim for components/player.rs, which documents attach(). First-load code: keep it
// small. hls.js is imported on first need only, from web/vendor/hls (see web/README.md).

const HLS_URL = '/vendor/hls/1.7.3/hls.light.min.mjs';
const POS = 'capyweb:pos:';
// Wanting to play, visible, and no picture for this long is a failure too. A server that takes
// the request and never answers raises no error (hls.js retries for a minute or more), and a
// paid camera must not keep buying for a picture that does not come.
const STUCK_MS = 15000;
let hlsModule = null; // Promise of the Hls class, shared by every player

function loadHls() {
  hlsModule ??= import(HLS_URL).then(
    (m) => m.default,
    (e) => { hlsModule = null; throw e; },
  );
  return hlsModule;
}

// Storage can throw (private mode, blocked site data); a lost position is not an error.
function savePos(key, t) {
  try { sessionStorage.setItem(key, t.toFixed(1)); } catch { /* ignore */ }
}
function loadPos(key) {
  try { return Number(sessionStorage.getItem(key)) || 0; } catch { return 0; }
}

function nativeHls(video) {
  // Chrome also says "maybe" to HLS now; only WebKit (Safari, iOS) has the AirPlay picker.
  return !!video.canPlayType('application/vnd.apple.mpegurl')
    && (!window.MediaSource || 'webkitShowPlaybackTargetPicker' in video);
}

export function attach(video, src, live, resumeKey, onFatal, onPlaying) {
  const key = POS + resumeKey + ' ' + src;
  let hls = null;
  let gone = false;
  let failed = false;
  let wasPlaying = false;
  let timer = 0;
  let dog = 0;

  const fail = () => {
    if (failed || gone) return;
    failed = true;
    setTimeout(() => { if (!gone) onFatal(); }); // never re-enter Rust from inside its own call
  };
  // Armed from a play request or a stall until the picture moves; off while paused (the viewer's
  // choice, or autoplay refused: no play event then) or hidden.
  const rest = () => { clearTimeout(dog); dog = 0; };
  const watch = () => {
    rest();
    if (failed || gone || document.hidden || video.paused) return;
    dog = setTimeout(() => { if (!document.hidden && !video.paused) fail(); }, STUCK_MS);
  };
  const save = () => {
    if (!live && !failed && video.currentTime > 0) savePos(key, video.currentTime);
  };
  const toLiveEdge = () => {
    if (hls) {
      if (hls.liveSyncPosition != null) video.currentTime = hls.liveSyncPosition;
    } else if (video.seekable.length) {
      const end = video.seekable.end(video.seekable.length - 1);
      if (Number.isFinite(end)) video.currentTime = Math.max(0, end - 6);
    }
  };
  const restore = () => {
    const t = loadPos(key);
    if (t > 0 && (!Number.isFinite(video.duration) || t < video.duration - 1)) video.currentTime = t;
  };
  const onVisibility = () => {
    if (document.hidden) {
      rest();
      wasPlaying = !video.paused;
      video.pause();
      save();
      if (hls && live) hls.stopLoad(); // nobody is watching: stop fetching segments
    } else if (wasPlaying) {
      wasPlaying = false;
      if (live) {
        if (hls) hls.startLoad();
        toLiveEdge();
      }
      video.play().catch(() => {});
    } else if (!video.paused && video.readyState < 3) {
      watch(); // opened in a background tab, still waiting for its first picture
    }
  };

  video.muted = true;
  video.loop = !live; // a reel never ends on a dead frame
  video.autoplay = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  video.addEventListener('error', fail);
  const moving = () => { rest(); if (onPlaying) onPlaying(); };
  const WATCH = { play: watch, waiting: watch, playing: moving, pause: rest };
  for (const [ev, f] of Object.entries(WATCH)) video.addEventListener(ev, f);
  // An explicit play, so the watchdog starts from the request and not from the first data (the
  // autoplay attribute alone fires play only once data has come). Refused autoplay is not an error.
  const start = () => { if (video.autoplay) video.play().catch(() => {}); };
  document.addEventListener('visibilitychange', onVisibility);
  if (!live) {
    video.addEventListener('loadedmetadata', restore, { once: true });
    video.addEventListener('pause', save);
    addEventListener('pagehide', save);
    timer = setInterval(save, 4000);
  }

  if (!/\.m3u8$/i.test(src) || nativeHls(video)) {
    video.src = src;
    start();
  } else {
    loadHls().then((Hls) => {
      if (gone) return;
      if (!Hls.isSupported()) return fail();
      hls = new Hls({
        enableWorker: false, // no blob: worker, so the CSP needs no worker-src blob:
        liveSyncDurationCount: 3, // start three segments behind the newest
        liveMaxLatencyDurationCount: 10, // fell further behind than that: jump forward
        liveDurationInfinity: true, // controls show a live stream, not a fake length
        backBufferLength: 30,
        maxBufferLength: 20,
      });
      hls.on(Hls.Events.ERROR, (_event, data) => { if (data.fatal) fail(); });
      hls.loadSource(src);
      hls.attachMedia(video);
      start();
    }, fail);
  }

  return {
    destroy() {
      if (gone) return;
      save();
      gone = true;
      clearInterval(timer);
      rest();
      for (const [ev, f] of Object.entries(WATCH)) video.removeEventListener(ev, f);
      document.removeEventListener('visibilitychange', onVisibility);
      removeEventListener('pagehide', save);
      video.removeEventListener('error', fail);
      video.removeEventListener('loadedmetadata', restore);
      video.removeEventListener('pause', save);
      if (hls) hls.destroy();
      hls = null;
      video.removeAttribute('src');
      video.load(); // drop the connection a native source may still hold
    },
  };
}
