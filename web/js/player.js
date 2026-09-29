// Video shim for components/player.rs, which documents attach(). First-load code: keep it
// small. hls.js is imported on first need only, from web/vendor/hls (see web/README.md).

const HLS_URL = '/vendor/hls/1.7.3/hls.light.min.mjs';
const POS = 'capyweb:pos:';
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

export function attach(video, src, live, resumeKey, onFatal) {
  const key = POS + resumeKey + ' ' + src;
  let hls = null;
  let gone = false;
  let failed = false;
  let wasPlaying = false;
  let timer = 0;

  const fail = () => {
    if (failed || gone) return;
    failed = true;
    setTimeout(() => { if (!gone) onFatal(); }); // never re-enter Rust from inside its own call
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
    }
  };

  video.muted = true;
  video.loop = !live; // a reel never ends on a dead frame
  video.autoplay = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  video.addEventListener('error', fail);
  document.addEventListener('visibilitychange', onVisibility);
  if (!live) {
    video.addEventListener('loadedmetadata', restore, { once: true });
    video.addEventListener('pause', save);
    addEventListener('pagehide', save);
    timer = setInterval(save, 4000);
  }

  if (!/\.m3u8$/i.test(src) || nativeHls(video)) {
    video.src = src;
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
    }, fail);
  }

  return {
    destroy() {
      if (gone) return;
      save();
      gone = true;
      clearInterval(timer);
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
