//! Watch room (`/stream/:capyId`): camera tabs, the player for a public camera, the paid panel
//! for a private one, and (public only) reactions plus chat.
//!
//! A paid camera shows its title and price. The browser never builds a media URL for it: a
//! signed-in viewer buys time through the playback route, and plays only the playlist that route
//! answers with, and only if it is this camera's own (`api::paid_src`). It has no chat or
//! reactions. Chat text and display names are other people's words: the panel in js/chat.js
//! sets textContent only, and caps the lengths.
//!
//! Every camera plays CapyTube's recording for now (docs/VIDEO_DESIGN.md section 8), so every
//! camera says "Recorded", never "Live".

use std::time::Duration;

use js_sys::Promise;
use leptos::html;
use leptos::prelude::*;
use leptos::task::spawn_local;
use leptos_router::hooks::{use_location, use_navigate, use_params_map, use_query_map};
use leptos_router::NavigateOptions;
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;
use wasm_bindgen_futures::future_to_promise;

use crate::api::{self, CodedError};
use crate::auth::{use_auth, Auth};
use crate::components::chrome::PageHead;
use crate::components::player::VideoPlayer;
use crate::domain::{ChatMessage, LiveStream};
use crate::pages::watch::portrait;
use crate::state::{use_session, Session};

const POSTER: &str = "/assets/posters/magnus-gym.webp";

/// The camera's own capybara as its poster, so Einstein's food cam does not show Magnus.
fn poster(stream: &LiveStream) -> &'static str {
    stream
        .capybara_ids
        .first()
        .and_then(|c| portrait(c))
        .unwrap_or(POSTER)
}

pub fn pick_camera(cams: &[LiveStream], cam: &str) -> Option<usize> {
    if !cam.is_empty() {
        if let Some(i) = cams.iter().position(|s| s.id == cam) {
            return Some(i);
        }
    }
    cams.iter()
        .position(LiveStream::is_public)
        .or_else(|| (!cams.is_empty()).then_some(0))
}

pub fn cam_href(capy: &str, id: &str) -> String {
    let mut u = String::from("/stream/");
    u.push_str(capy);
    u.push('?');
    u.push_str("cam=");
    u.push_str(id);
    u
}

pub fn step(len: usize, index: usize, dir: i32) -> usize {
    if len == 0 {
        return 0;
    }
    let n = len as i32;
    (index as i32 + dir).rem_euclid(n) as usize
}

/// Cap a string on Unicode scalar values. Chat is untrusted, so the view never shows more
/// than the API allows.
pub fn clip(s: &str, max: usize) -> String {
    let mut out = String::new();
    for (i, ch) in s.chars().enumerate() {
        if i == max {
            break;
        }
        out.push(ch);
    }
    out
}

/// Insert `fresh` (newest first) at the front. Returns the lines that were not already shown,
/// newest first, so a poll of the same page announces nothing.
pub fn merge_newest(existing: &mut Vec<ChatMessage>, fresh: &[ChatMessage]) -> Vec<ChatMessage> {
    let mut added = Vec::new();
    for msg in fresh.iter().rev() {
        if existing.iter().any(|e| e.id == msg.id) {
            continue;
        }
        added.push(msg.clone());
    }
    for msg in added.iter().rev() {
        existing.insert(0, msg.clone());
    }
    added.reverse();
    added
}

pub fn append_earlier(existing: &mut Vec<ChatMessage>, older: &[ChatMessage]) {
    for msg in older {
        if !existing.iter().any(|e| e.id == msg.id) {
            existing.push(msg.clone());
        }
    }
}

fn watching(n: u32) -> String {
    let mut s = n.to_string();
    s.push_str(" watching");
    s
}

fn focus_tab(id: &str) {
    let Some(doc) = web_sys::window().and_then(|w| w.document()) else {
        return;
    };
    let Some(el) = doc.get_element_by_id(id) else {
        return;
    };
    let Ok(el) = el.dyn_into::<web_sys::HtmlElement>() else {
        return;
    };
    let _ = el.focus();
}

fn tab_id(stream_id: &str) -> String {
    let mut s = String::from("tab-");
    s.push_str(stream_id);
    s
}

#[wasm_bindgen(module = "/js/chat.js")]
extern "C" {
    type ChatHandle;

    #[wasm_bindgen(js_name = attach)]
    fn attach_chat(
        root: &web_sys::HtmlElement,
        stream_id: &str,
        base: &str,
        exchange: &JsValue,
        sign_in: &JsValue,
    ) -> ChatHandle;

    #[wasm_bindgen(method)]
    fn destroy(this: &ChatHandle);

    #[wasm_bindgen(method, js_name = setAuth)]
    fn set_auth(this: &ChatHandle, signed: bool, ready: bool);
}

struct ChatHooks {
    handle: ChatHandle,
    _exchange: Closure<dyn FnMut(u32, String) -> Promise>,
    _sign: Closure<dyn FnMut()>,
}

fn pack(status: u16, code: &str, body: &str) -> String {
    let mut s = status.to_string();
    s.push('\n');
    s.push_str(code);
    s.push('\n');
    s.push_str(body);
    s
}

#[component]
fn PublicCam(stream: LiveStream) -> impl IntoView {
    let reel = stream.reel_key().and_then(|k| {
        let mut key = String::from("media/");
        key.push_str(k);
        api::media_src(&key)
    });
    let (src, live) = api::camera_src(&stream).map_or((None, false), |(s, l)| (Some(s), l));
    let recorded = stream.is_recording();
    let poster = poster(&stream);
    let title = stream.title.clone();
    // A viewer count means "watching now": nothing for a recording.
    let viewers = stream.viewer_count.filter(|_| !stream.is_recording());
    let panel_label = tab_id(&stream.id);
    let stream_id = stream.id.clone();
    let bar_stream = stream.id.clone();
    let auth = use_auth();
    let loc = use_location();
    let root = NodeRef::<html::Div>::new();
    let slot = StoredValue::new_local(None::<ChatHooks>);
    let stop = move || {
        if let Some(hooks) = slot.try_update_value(Option::take).flatten() {
            hooks.handle.destroy();
        }
    };
    Effect::new(move |_| {
        let signed = auth.signed_in();
        let ready = auth.ready();
        let mut attached = false;
        slot.try_update_value(|s| {
            if let Some(hooks) = s {
                hooks.handle.set_auth(signed, ready);
                attached = true;
            }
        });
        if attached {
            return;
        }
        let Some(el) = root.get() else {
            return;
        };
        let el: &web_sys::HtmlElement = el.unchecked_ref();
        let id = stream_id.clone();
        let exchange =
            Closure::<dyn FnMut(u32, String) -> Promise>::new(move |kind: u32, payload: String| {
                let id = id.clone();
                future_to_promise(async move {
                    let packed = if kind == 1 {
                        match api::post_chat_json(auth, &id, &payload, None).await {
                            Ok(body) => pack(201, "", &body),
                            Err(e) => pack(e.status, &e.code, ""),
                        }
                    } else {
                        match api::post_reaction_json(auth, &id, &payload, None).await {
                            Ok(body) => pack(200, "", &body),
                            Err(e) => pack(e.status, &e.code, ""),
                        }
                    };
                    Ok(JsValue::from_str(&packed))
                })
            });
        let sign = Closure::<dyn FnMut()>::new(move || {
            let mut to = loc.pathname.get_untracked();
            to.push_str(&loc.search.get_untracked());
            auth.sign_in(&to);
        });
        let handle = attach_chat(
            el,
            &stream_id,
            api::base_url(),
            exchange.as_ref(),
            sign.as_ref(),
        );
        handle.set_auth(signed, ready);
        slot.set_value(Some(ChatHooks {
            handle,
            _exchange: exchange,
            _sign: sign,
        }));
    });
    on_cleanup(stop);

    view! {
        <div class="watch-grid" role="tabpanel" id="cam-panel" aria-labelledby=panel_label>
            <section class="card watch-cam">
                <h2>{title.clone()}</h2>
                {viewers.map(|n| view! { <p data-testid="viewer-count">{watching(n)}</p> })}
                <VideoPlayer src=Signal::stored(src) poster=poster label=title live=live
                    recorded=recorded resume_key=stream.id.clone() fallback=reel/>
            </section>
            <aside class="card chat-panel" aria-label="Chat">
                <h2>"Chat"</h2>
                {agent_bar(bar_stream)}
                <div node_ref=root></div>
            </aside>
        </div>
    }
}

/// An assistant's message or reaction for this camera, waiting for the person's Post (WebMCP
/// builds only; `webmcp::chat_asks`).
#[cfg(feature = "webmcp")]
fn agent_bar(stream: String) -> impl IntoView {
    crate::webmcp::chat_asks(stream)
}

#[cfg(not(feature = "webmcp"))]
fn agent_bar(_stream: String) -> impl IntoView {}

fn open_cam(nav: &impl Fn(&str, NavigateOptions), ids: &[String], capy: &str, index: usize) {
    let Some(id) = ids.get(index) else {
        return;
    };
    nav(
        &cam_href(capy, id),
        NavigateOptions {
            replace: true,
            ..Default::default()
        },
    );
    let focus = tab_id(id);
    set_timeout(move || focus_tab(&focus), Duration::from_millis(0));
}

fn coins(n: u64) -> String {
    let mut s = n.to_string();
    s.push_str(if n == 1 { " play coin" } else { " play coins" });
    s
}

fn price_label(per_minute: Option<u32>) -> String {
    match per_minute {
        Some(p) => coins(p.into()) + " a minute",
        None => "Price not set yet".to_string(),
    }
}

/// Where a paid camera is. `Watching` carries the checked source and a count that moves on when
/// the player must start again (after a long hidden spell, when the old cookies may be gone).
#[derive(Clone, PartialEq)]
enum Paid {
    Idle,
    Confirm,
    Busy,
    Watching(String, u32),
}

async fn sleep_s(secs: u32) {
    let wait = Promise::new(&mut |done, _| {
        if let Some(w) = web_sys::window() {
            let _ = w.set_timeout_with_callback_and_timeout_and_arguments_0(
                &done,
                (secs.min(600) * 1000) as i32,
            );
        }
    });
    let _ = wasm_bindgen_futures::JsFuture::from(wait).await;
}

fn page_hidden() -> bool {
    web_sys::window()
        .and_then(|w| w.document())
        .is_some_and(|d| d.hidden())
}

/// The balance from `GET /me` into the header's coin count.
async fn refresh_coins(auth: Auth, session: Session) -> Option<u64> {
    let c = api::get_me(auth).await.ok().flatten()?.balance;
    session.coins.set(c);
    c
}

fn refusal(e: &CodedError, per_minute: u32, have: Option<u64>) -> String {
    if e.is("insufficient_coins") {
        let mut s = String::from("Not enough play coins: a minute costs ");
        s.push_str(&coins(per_minute.into()));
        if let Some(h) = have {
            s.push_str(" and you have ");
            s.push_str(&coins(h));
        }
        s.push_str(". Nothing more was spent.");
        return s;
    }
    if e.outcome_unknown() {
        return "No answer from CapyTube. Nothing more will be charged. Try again in a moment."
            .into();
    }
    if e.is("not_ready") {
        return "Paid cameras are not open right now. Nothing was spent.".into();
    }
    "This camera cannot be watched right now. Nothing was spent.".into()
}

/// One viewing: buy, play, and buy the next minute when the server says so, while the tab is
/// visible and the picture is moving (`moving`, set by the player: not before it first plays, nor
/// while it is stalled for want of data; the viewer's pause keeps it, as a paused tab does). It
/// ends when `gen` moves on (Stop, leaving the camera), on a refusal, or when the picture will not
/// play even after one fresh start (`broken`, set by the player). Each purchase has its own
/// Idempotency-Key, reused only to ask again after a lost answer.
#[allow(clippy::too_many_arguments)]
async fn watch_loop(
    auth: Auth,
    session: Session,
    id: String,
    my: u32,
    gen: StoredValue<u32>,
    state: RwSignal<Paid>,
    note: RwSignal<String>,
    broken: RwSignal<bool>,
    moving: RwSignal<bool>,
    per_minute: u32,
) {
    let current = move || gen.try_get_value() == Some(my);
    let mut first = true;
    let mut epoch = 0;
    let mut restarted = false;
    'buy: loop {
        let key = crate::auth::random_key();
        let mut answer = api::buy_playback(auth, &id, &key).await;
        for wait in [2, 4] {
            if !current() || !matches!(&answer, Err(e) if e.outcome_unknown()) {
                break;
            }
            sleep_s(wait).await;
            answer = api::buy_playback(auth, &id, &key).await;
        }
        if !current() {
            return;
        }
        let pass = match answer {
            Ok(p) => p,
            Err(e) => {
                let have = if e.is("insufficient_coins") {
                    refresh_coins(auth, session).await
                } else {
                    session.coins.get_untracked()
                };
                if !current() {
                    return;
                }
                note.set(refusal(&e, per_minute, have));
                if !first {
                    // The minute already paid for still plays; the server renews 20 s early.
                    sleep_s(20).await;
                    if !current() {
                        return;
                    }
                }
                state.set(Paid::Idle);
                return;
            }
        };
        if pass.charged > 0 {
            refresh_coins(auth, session).await;
        }
        let Some(src) = api::paid_src(&id, &pass.src) else {
            note.set(
                "That answer did not look right, so nothing plays. Nothing more will be charged."
                    .into(),
            );
            state.set(Paid::Idle);
            return;
        };
        if !current() {
            return;
        }
        if state.with_untracked(|s| *s != Paid::Watching(src.clone(), epoch)) {
            broken.set(false);
            moving.set(false);
            state.set(Paid::Watching(src.clone(), epoch));
        }
        first = false;
        // Wait for the next minute a second at a time, so a picture that will not play is noticed
        // at once instead of being paid for again. Once it is due, buy it only while the tab is
        // visible and the picture is moving. A picture that never comes, or stalls and does not
        // come back, is failed by the player after 15 s of visible time with no media arriving;
        // one that waits for a tap on play (autoplay refused) costs nothing more until it gets one.
        let (mut waited, mut away) = (0, 0);
        loop {
            while current() && !broken.get_untracked() {
                if waited >= pass.renew_after_s {
                    if page_hidden() {
                        away += 1;
                    } else if moving.get_untracked() {
                        break;
                    }
                }
                sleep_s(1).await;
                waited += 1;
            }
            if !current() {
                return;
            }
            if !broken.get_untracked() {
                break;
            }
            if restarted {
                note.set("The recording would not play, so nothing more will be charged.".into());
                state.set(Paid::Idle);
                return;
            }
            // Once, a fresh player. The cookies last 30 s past the paid time, and the renewal
            // point is 20 s before it (backend/src/playback.ts GRACE_SECONDS and
            // RENEW_BEFORE_END_SECONDS), so they end 50 s after the renewal point. While 20 s or
            // more of them are left the fresh player uses them and nothing is bought: a hang costs
            // the first minute and no more. Later, it buys fresh cookies (charged only when under
            // 30 s are paid).
            restarted = true;
            epoch += 1;
            if waited + 20 > pass.renew_after_s + 50 {
                continue 'buy;
            }
            broken.set(false);
            moving.set(false);
            state.set(Paid::Watching(src.clone(), epoch));
        }
        // It played since the last fresh start, so a later failure gets a fresh start of its own.
        restarted = false;
        // Hidden for a long spell after the minute was due: the cookies may have run out, so start
        // the player again once the next minute is paid.
        if away >= 40 {
            epoch += 1;
        }
    }
}

/// A paid camera (W6): title, price and "Recorded" for everyone. A signed-in viewer confirms,
/// then watches while the playback route takes the price each minute (backend/src/playback.ts).
/// Signed out, with sign-in available, it offers sign-in; without sign-in it offers nothing.
#[component]
fn PaidCam(stream: LiveStream) -> impl IntoView {
    let auth = use_auth();
    let session = use_session();
    let loc = use_location();
    let id = StoredValue::new(stream.id.clone());
    let title = stream.title.clone();
    let recorded = stream.is_recording();
    let poster = poster(&stream);
    let per_minute = stream.price_per_minute();
    let sellable = per_minute.is_some() && (recorded || stream.is_live == Some(true));
    let state = RwSignal::new(Paid::Idle);
    let note = RwSignal::new(String::new());
    let broken = RwSignal::new(false);
    let moving = RwSignal::new(false);
    let stop_button = NodeRef::<html::Button>::new();
    // Start unmounts the button that had focus: hand it to Stop, unless the viewer has moved on.
    Effect::new(move |_| {
        let Some(button) = stop_button.get() else {
            return;
        };
        let lost = web_sys::window()
            .and_then(|w| w.document())
            .and_then(|d| d.active_element())
            .is_none_or(|a| a.tag_name() == "BODY");
        if lost {
            let _ = button.focus();
        }
    });
    let gen = StoredValue::new(0u32);
    on_cleanup(move || gen.update_value(|g| *g += 1));

    let confirm = move |_| {
        note.set(String::new());
        state.set(Paid::Confirm);
        spawn_local(async move {
            refresh_coins(auth, session).await;
        });
    };
    let start = move |_| {
        // Two activations in one tick (assistive tech, scripts) must not start two viewings.
        if matches!(state.get_untracked(), Paid::Busy | Paid::Watching(..)) {
            return;
        }
        let Some(p) = per_minute else { return };
        let my = gen.get_value() + 1;
        gen.set_value(my);
        note.set(String::new());
        state.set(Paid::Busy);
        spawn_local(watch_loop(
            auth,
            session,
            id.get_value(),
            my,
            gen,
            state,
            note,
            broken,
            moving,
            p,
        ));
    };
    let stop = move |_| {
        gen.update_value(|g| *g += 1);
        state.set(Paid::Idle);
        note.set("Stopped. Nothing more will be charged.".into());
    };
    let sign_in = move |_| {
        let mut to = loc.pathname.get_untracked();
        to.push_str(&loc.search.get_untracked());
        auth.sign_in(&to);
    };
    let ask = move || {
        let mut s = String::from("You pay ");
        s.push_str(&price_label(per_minute));
        s.push_str(": the first minute now, then each minute while you watch.");
        if let Some(c) = session.coins.get() {
            s.push_str(" You have ");
            s.push_str(&coins(c));
            s.push('.');
        }
        s
    };
    let eyebrow = if recorded {
        "Paid camera · Recorded"
    } else {
        "Paid camera"
    };

    view! {
        <section class="card watch-cam locked-cam" data-testid="locked-camera" role="tabpanel" id="cam-panel"
            aria-labelledby=tab_id(&stream.id)>
            <p class="eyebrow">{eyebrow}</p>
            <h2>{title.clone()}</h2>
            <p class="font-dynapuff" data-testid="paid-price">{price_label(per_minute)}</p>
            {move || match state.get() {
                Paid::Watching(src, _) => view! {
                    <VideoPlayer src=Signal::stored(Some(src)) poster=poster label=title.clone()
                        recorded=recorded resume_key=id.get_value()
                        on_offline=move |_| broken.set(true) on_moving=move |m| moving.set(m)/>
                    // A paused, visible tab still pays (docs/VIDEO_DESIGN.md section 8), so say so
                    // (review rv-1790696475-7422).
                    <p data-testid="paid-meter">"Taken each minute while you watch. Nothing is taken while the tab is hidden. Pausing does not stop the charge: press Stop watching to end it."</p>
                    <button type="button" class="btn btn-ghost" data-testid="paid-stop" node_ref=stop_button
                        on:click=stop>
                        "Stop watching"</button>
                }.into_any(),
                Paid::Confirm => view! {
                    <div class="paid-confirm" data-testid="paid-confirm">
                        <p>{ask}</p>
                        <button type="button" class="btn" data-testid="paid-start" on:click=start>
                            "Start watching"</button>
                        <button type="button" class="btn btn-ghost" on:click=move |_| state.set(Paid::Idle)>
                            "Cancel"</button>
                    </div>
                }.into_any(),
                Paid::Busy => view! { <p role="status">"Starting…"</p> }.into_any(),
                Paid::Idle if !sellable => view! {
                    <p>"This camera cannot be watched right now."</p>
                }.into_any(),
                Paid::Idle if auth.signed_in() => view! {
                    <button type="button" class="btn" data-testid="paid-watch" on:click=confirm>
                        "Watch"</button>
                }.into_any(),
                Paid::Idle if auth.ready() => view! {
                    <button type="button" class="btn" data-testid="paid-sign-in" on:click=sign_in>
                        "Sign in to watch"</button>
                }.into_any(),
                Paid::Idle => view! {
                    <p>"Watching a paid camera needs an account and play coins."</p>
                }.into_any(),
            }}
            <p class="paid-note" role="status" data-testid="paid-note">{move || note.get()}</p>
        </section>
    }
}

#[component]
pub fn WatchRoom() -> impl IntoView {
    let params = use_params_map();
    let query = use_query_map();
    let navigate = use_navigate();
    let streams = LocalResource::new(|| api::list_streams(None));
    view! {
        <PageHead title="Watch room"/>
        <Suspense fallback=|| view! { <p>"Loading cameras…"</p> }>
            {move || streams.get().map(|r| match r {
                Err(_) => view! { <p class="text-alertRed">"Could not load cameras."</p> }.into_any(),
                Ok(page) => {
                    let capy = params.with(|p| p.get("capyId").unwrap_or_default());
                    let cam = query.with(|q| q.get("cam").unwrap_or_default());
                    let cams: Vec<LiveStream> = page.items.into_iter()
                        .filter(|s| s.capybara_ids.iter().any(|id| id == &capy))
                        .collect();
                    if cams.is_empty() {
                        crate::noindex_while_shown(); // nothing to show: not a page to index
                        return view! { <p class="notice">"No camera watches this capybara yet."</p> }.into_any();
                    }
                    let selected = pick_camera(&cams, &cam).unwrap_or(0);
                    let ids: Vec<String> = cams.iter().map(|s| s.id.clone()).collect();
                    let nav = navigate.clone();
                    let on_keys = {
                        let nav = nav.clone();
                        let ids = ids.clone();
                        let capy = capy.clone();
                        move |ev: web_sys::KeyboardEvent| {
                            let dir = match ev.key().as_str() {
                                "ArrowRight" | "ArrowDown" => 1,
                                "ArrowLeft" | "ArrowUp" => -1,
                                _ => return,
                            };
                            ev.prevent_default();
                            open_cam(&nav, &ids, &capy, step(ids.len(), selected, dir));
                        }
                    };
                    let chosen = cams[selected].clone();
                    let public = chosen.is_public();
                    view! {
                        <div class="watch-room">
                            <div class="cam-tabs" role="tablist" aria-label="Cameras" data-testid="cam-tabs"
                                on:keydown=on_keys>
                                {cams.iter().enumerate().map(|(i, s)| {
                                    let on = i == selected;
                                    let nav = nav.clone();
                                    let ids = ids.clone();
                                    let capy = capy.clone();
                                    let tid = tab_id(&s.id);
                                    view! {
                                        <button type="button" role="tab" id=tid.clone()
                                            data-testid="cam-tab" data-cam=s.id.clone()
                                            aria-selected=if on { "true" } else { "false" }
                                            aria-controls="cam-panel"
                                            tabindex=if on { "0" } else { "-1" }
                                            on:click=move |_| open_cam(&nav, &ids, &capy, i)>
                                            {s.title.clone()}
                                        </button>
                                    }
                                }).collect_view()}
                            </div>
                            {if public {
                                // This closure re-runs when `?cam=` changes, which drops the
                                // previous camera (and its poll) and mounts the next one.
                                view! { <PublicCam stream=chosen /> }.into_any()
                            } else {
                                view! { <PaidCam stream=chosen /> }.into_any()
                            }}
                        </div>
                    }.into_any()
                }
            })}
        </Suspense>
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn cam(id: &str, public: bool) -> LiveStream {
        serde_json::from_value(serde_json::json!({
            "id": id,
            "title": id,
            "access_type": if public { "public" } else { "private" },
        }))
        .unwrap()
    }

    fn msg(id: &str, text: &str) -> ChatMessage {
        ChatMessage {
            id: id.into(),
            stream_id: "main-cam".into(),
            display_name: Some("Nok".into()),
            text: text.into(),
            created_at: String::new(),
        }
    }

    #[test]
    fn camera_fallback_prefers_the_first_public() {
        let cams = vec![cam("wall", false), cam("main", true), cam("food", true)];
        assert_eq!(pick_camera(&cams, ""), Some(1));
        assert_eq!(pick_camera(&cams, "nope"), Some(1));
        assert_eq!(pick_camera(&cams, "wall"), Some(0));
        assert_eq!(pick_camera(&cams, "food"), Some(2));
        assert_eq!(pick_camera(&[cam("wall", false)], "nope"), Some(0));
        assert_eq!(pick_camera(&[], "main"), None);
    }

    #[test]
    fn tabs_wrap() {
        assert_eq!(step(3, 0, -1), 2);
        assert_eq!(step(3, 2, 1), 0);
        assert_eq!(step(0, 0, 1), 0);
    }

    #[test]
    fn chat_merge_is_newest_first_and_idempotent() {
        let mut lines = vec![msg("b", "second"), msg("a", "first")];
        let added = merge_newest(&mut lines, &[msg("c", "third"), msg("b", "second")]);
        assert_eq!(added.len(), 1);
        assert_eq!(added[0].id, "c");
        assert_eq!(
            lines.iter().map(|m| m.id.as_str()).collect::<Vec<_>>(),
            ["c", "b", "a"]
        );
        assert!(merge_newest(&mut lines, &[msg("c", "third")]).is_empty());
        append_earlier(&mut lines, &[msg("a", "first"), msg("z", "older")]);
        assert_eq!(lines.last().unwrap().id, "z");
    }

    #[test]
    fn clip_stops_at_scalar_values() {
        assert_eq!(clip("hello", 5), "hello");
        assert_eq!(clip("hello", 2), "he");
        assert_eq!(clip("<img src=x onerror=alert(1)>", 4), "<img");
    }

    #[test]
    fn href_carries_the_camera() {
        assert_eq!(
            cam_href("magnus", "main-cam"),
            "/stream/magnus?cam=main-cam"
        );
    }
}
