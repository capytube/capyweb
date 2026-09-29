//! The video player (W6): one `<video>` for a public live camera (HLS) or a recorded reel (MP4).
//!
//! The media work is in js/player.js: native playback, hls.js loaded only when needed, pause
//! while the tab is hidden, the jump to the live edge on return, and the resume position of a
//! non-live source. This component owns which source plays and the player's lifetime: a fatal
//! error moves to the fallback reel, then to the offline state, and unmounting destroys the
//! player (listeners, timers, the hls.js instance). Design: docs/VIDEO_DESIGN.md.
//!
//! It never decides that a camera may be watched: callers pass a source only for a public camera
//! (`api::live_src`). A private camera gets no source until the playback route exists.

use leptos::{html, prelude::*};
use wasm_bindgen::prelude::*;

// `attach(video, src, live, resumeKey, onFatal)` in js/player.js:
// - an .mp4 plays natively; an .m3u8 plays natively in WebKit (Safari, every iOS browser) and
//   through hls.js elsewhere. Chrome now answers canPlayType "maybe" for HLS too, so that answer
//   alone no longer means Safari: the shim also looks for WebKit's AirPlay picker.
// - `live`: jump to the live edge when the tab comes back; stop fetching while it is hidden.
// - `resumeKey`: a non-live source saves its position in sessionStorage under this key and the
//   source, every few seconds and on pause, hide and destroy, and restores it on the next attach.
// - `onFatal()`: called once, asynchronously (never inside a call from Rust), when the source
//   cannot play. `destroy()` removes every listener and timer and frees the hls.js instance.
#[wasm_bindgen(module = "/js/player.js")]
extern "C" {
    type Handle;

    #[wasm_bindgen(js_name = attach)]
    fn attach_js(
        video: &web_sys::HtmlVideoElement,
        src: &str,
        live: bool,
        resume_key: &str,
        on_fatal: &JsValue,
    ) -> Handle;

    #[wasm_bindgen(method)]
    fn destroy(this: &Handle);
}

/// The source to play and whether it is live: the main source until it fails, then the fallback
/// (a recording, never live), then nothing. No main source means offline, fallback or not.
pub fn choose(
    src: Option<&str>,
    fallback: Option<&str>,
    live: bool,
    failed: &[String],
) -> Option<(String, bool)> {
    let ok = |s: &str| !failed.iter().any(|f| f == s);
    let src = src?;
    if ok(src) {
        return Some((src.to_owned(), live));
    }
    fallback.filter(|f| ok(f)).map(|f| (f.to_owned(), false))
}

#[component]
pub fn VideoPlayer(
    /// `None` shows the poster and an offline message.
    #[prop(into)]
    src: Signal<Option<String>>,
    #[prop(into)] poster: String,
    /// Accessible name of the video.
    #[prop(into)]
    label: String,
    #[prop(optional)] live: bool,
    /// Stable key (a camera id) under which a non-live source keeps its position.
    #[prop(into)]
    resume_key: String,
    /// Played when the source fails. Never live.
    #[prop(optional_no_strip)]
    fallback: Option<String>,
) -> impl IntoView {
    let failed = RwSignal::new(Vec::<String>::new());
    let current = Memo::new(move |_| {
        failed.with(|f| src.with(|s| choose(s.as_deref(), fallback.as_deref(), live, f)))
    });
    let playing = Memo::new(move |_| current.with(Option::is_some));
    let video = NodeRef::<html::Video>::new();
    let handle = StoredValue::new_local(None::<(Handle, Closure<dyn FnMut()>)>);
    let stop = move || {
        if let Some((h, _on_fatal)) = handle.try_update_value(Option::take).flatten() {
            h.destroy();
        }
    };

    Effect::new(move |_| {
        let cur = current.get();
        let el = video.get();
        stop();
        if let (Some((src, live)), Some(el)) = (cur, el) {
            let bad = src.clone();
            let on_fatal =
                Closure::<dyn FnMut()>::new(move || failed.update(|f| f.push(bad.clone())));
            let h = attach_js(&el, &src, live, &resume_key, on_fatal.as_ref());
            handle.set_value(Some((h, on_fatal)));
        }
    });
    on_cleanup(stop);

    let state = move || match current.get() {
        Some((_, true)) => "live",
        Some(_) => "reel",
        None => "offline",
    };
    view! {
        <div class="player" data-testid="player" data-state=state>
            {move || if playing.get() {
                view! {
                    <video node_ref=video controls playsinline muted preload="metadata"
                        poster=poster.clone() aria-label=label.clone()></video>
                }.into_any()
            } else {
                view! {
                    <div class="player-offline">
                        <img src=poster.clone() alt=""/>
                        <p>"This camera is offline right now. Check back soon."</p>
                    </div>
                }.into_any()
            }}
            <p class="player-note">{move || match state() {
                "live" => "Live",
                "reel" => "Recorded reel: the camera is resting",
                _ => "",
            }}</p>
        </div>
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn main_source_then_fallback_then_nothing() {
        let (src, reel) = (Some("/live/a/index.m3u8"), Some("/media/r.mp4"));
        assert_eq!(
            choose(src, reel, true, &[]),
            Some(("/live/a/index.m3u8".into(), true))
        );
        let failed = vec!["/live/a/index.m3u8".to_string()];
        assert_eq!(
            choose(src, reel, true, &failed),
            Some(("/media/r.mp4".into(), false))
        );
        let both = vec![failed[0].clone(), "/media/r.mp4".into()];
        assert_eq!(choose(src, reel, true, &both), None);
        assert_eq!(choose(src, None, true, &failed), None);
    }

    #[test]
    fn no_source_is_offline_even_with_a_reel() {
        assert_eq!(choose(None, Some("/media/r.mp4"), true, &[]), None);
    }
}
