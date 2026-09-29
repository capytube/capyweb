//! Watch room, first cut (W6): the player for this capybara's first public camera and a locked
//! panel for each private one. W4 builds the full room here: camera tabs, reactions, chat.
//!
//! A private camera shows its title and price only. No media URL is built or requested for it,
//! and it has no buttons until sign-in, payment and the playback route exist.

use leptos::prelude::*;
use leptos_router::hooks::use_params_map;

use crate::api;
use crate::components::chrome::PageHead;
use crate::components::player::VideoPlayer;
use crate::domain::LiveStream;

const POSTER: &str = "/assets/posters/magnus-gym.webp";

fn public_camera(s: LiveStream) -> impl IntoView {
    let reel = s
        .reel_key()
        .and_then(|k| api::media_src(&format!("media/{k}")));
    let src = api::live_src(&s);
    view! {
        <section class="card watch-cam">
            <h2>{s.title.clone()}</h2>
            <VideoPlayer src=Signal::stored(src) poster=POSTER label=s.title live=true
                resume_key=s.id fallback=reel/>
        </section>
    }
}

fn locked_camera(s: LiveStream) -> impl IntoView {
    let price = match s.price_per_10_sec {
        Some(1) => "1 coin per 10 seconds".to_string(),
        Some(p) => format!("{p} coins per 10 seconds"),
        None => "Price not set yet".to_string(),
    };
    view! {
        <section class="card watch-cam locked-cam" data-testid="locked-camera">
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
    let streams = LocalResource::new(|| api::list_streams(None));
    view! {
        <PageHead title="Watch room"/>
        <Suspense fallback=|| view! { <p>"Loading cameras…"</p> }>
            {move || streams.get().map(|r| match r {
                Err(e) => view! { <p class="text-alertRed">{format!("Could not load cameras: {e}")}</p> }.into_any(),
                Ok(page) => {
                    let capy = params.with(|p| p.get("capyId").unwrap_or_default());
                    let (public, private): (Vec<_>, Vec<_>) = page.items.into_iter()
                        .filter(|s| s.capybara_ids.contains(&capy))
                        .partition(LiveStream::is_public);
                    if public.is_empty() && private.is_empty() {
                        return view! { <p class="notice">"No camera watches this capybara yet."</p> }.into_any();
                    }
                    view! {
                        <div class="watch-cams">
                            {public.into_iter().next().map(public_camera)}
                            {private.into_iter().map(locked_camera).collect_view()}
                        </div>
                    }.into_any()
                }
            })}
        </Suspense>
    }
}
