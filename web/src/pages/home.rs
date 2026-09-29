//! Home. W1 has the hero and the camera list; W3 adds the reel, the cast and the gallery.

use leptos::prelude::*;
use leptos_router::components::A;

use crate::api;
use crate::components::chrome::PageHead;
use crate::domain::LiveStream;

pub fn access_badge(s: &LiveStream) -> impl IntoView {
    if s.is_public() {
        view! { <span class="text-xs rounded-full px-2 py-0.5 bg-avacadoCream text-leafGreen">"Free"</span> }.into_any()
    } else {
        // A private stream with no price is still private, never "0 coins".
        let label = match s.price_per_10_sec {
            Some(p) => format!("{p} coin / 10 s"),
            None => "Private".to_string(),
        };
        view! { <span class="text-xs rounded-full px-2 py-0.5 bg-persimmon text-chocoBrown">{label}</span> }.into_any()
    }
}

/// Where a camera card links: the watch room of the camera's first capybara.
pub fn watch_href(s: &LiveStream) -> String {
    match s.capybara_ids.first() {
        Some(capy) => format!("/stream/{capy}"),
        None => "/watch".to_string(),
    }
}

#[component]
pub fn Home() -> impl IntoView {
    let streams = LocalResource::new(|| api::list_streams(None));
    view! {
        <PageHead
            title="Watch Magnus. Then pick his snack."
            eyebrow="Real capybaras · play coins only"
            lede="Tune in to the capy cams, react with the room, and vote on what gets served next."
        />
        <section aria-labelledby="cams-heading" class="mt-8">
            <h2 id="cams-heading">"Cameras"</h2>
            <Suspense fallback=|| view! { <p>"Loading cameras…"</p> }>
                {move || streams.get().map(|r| match r {
                    Err(e) => view! { <p class="text-alertRed">{format!("Could not load cameras: {e}")}</p> }.into_any(),
                    Ok(page) => view! {
                        <ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="stream-list">
                            {page.items.into_iter().map(|s| {
                                let line = if s.is_recording() {
                                    "Recorded"
                                } else if s.is_live.unwrap_or(false) {
                                    "Live now"
                                } else {
                                    "Resting. Showing the reel."
                                };
                                view! {
                                    <li class="card">
                                        <A href=watch_href(&s) attr:class="block no-underline">
                                            <div class="flex items-center justify-between gap-2">
                                                <span class="font-dynapuff text-lg">{s.title.clone()}</span>
                                                {access_badge(&s)}
                                            </div>
                                            <p class="text-sm mt-1" data-testid="stream-state">{line}</p>
                                        </A>
                                    </li>
                                }
                            }).collect_view()}
                        </ul>
                    }.into_any(),
                })}
            </Suspense>
        </section>
    }
}
