//! Watch room (`/stream/:capyId`): camera tabs, the player for a public camera, a locked
//! panel for a private one, and (public only) reactions plus chat.
//!
//! A private camera shows its title and price only. No media URL is built or requested for
//! it, and it has no chat, reactions or buttons. Chat text and display names are other
//! people's words: the panel in js/chat.js sets textContent only, and caps the lengths.

use std::time::Duration;

use js_sys::Promise;
use leptos::html;
use leptos::prelude::*;
use leptos_router::hooks::{use_location, use_navigate, use_params_map, use_query_map};
use leptos_router::NavigateOptions;
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;
use wasm_bindgen_futures::future_to_promise;

use crate::api;
use crate::auth::use_auth;
use crate::components::chrome::PageHead;
use crate::components::player::VideoPlayer;
use crate::domain::{ChatMessage, LiveStream};

const POSTER: &str = "/assets/posters/magnus-gym.webp";

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
    let src = api::live_src(&stream);
    let title = stream.title.clone();
    let viewers = stream.viewer_count;
    let panel_label = tab_id(&stream.id);
    let stream_id = stream.id.clone();
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
                <VideoPlayer src=Signal::stored(src) poster=POSTER label=title live=true
                    resume_key=stream.id.clone() fallback=reel/>
            </section>
            <aside class="card chat-panel" aria-label="Chat">
                <h2>"Chat"</h2>
                <div node_ref=root></div>
            </aside>
        </div>
    }
}

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

fn price_label(price: Option<u32>) -> String {
    match price {
        Some(1) => "1 coin per 10 seconds".to_string(),
        Some(p) => {
            let mut s = p.to_string();
            s.push_str(" coins per 10 seconds");
            s
        }
        None => "Price not set yet".to_string(),
    }
}

fn locked_camera(s: LiveStream) -> impl IntoView {
    let price = price_label(s.price_per_10_sec);
    view! {
        <section class="card watch-cam locked-cam" data-testid="locked-camera" role="tabpanel" id="cam-panel" aria-labelledby=tab_id(&s.id)>
            <p class="eyebrow">"Private camera"</p>
            <h2>{s.title}</h2>
            <p class="font-dynapuff">{price}</p>
            <p>"Watching a private camera needs an account and play coins. Both are on their way."</p>
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
                                locked_camera(chosen).into_any()
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
