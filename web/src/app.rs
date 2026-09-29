//! Prototype pages: the stream list and one stream's page, from the public catalog API.

use leptos::prelude::*;
use leptos_router::components::{Route, Router, Routes, A};
use leptos_router::hooks::{use_navigate, use_params_map};
use leptos_router::{path, NavigateOptions};

use crate::api;
use crate::domain::LiveStream;
use crate::webmcp;

#[component]
pub fn App() -> impl IntoView {
    view! {
        <Router>
            <Tools/>
            <header class="flex items-center justify-between px-4 py-3 bg-grassGreen shadow-buttonShadow">
                <A href="/">
                    <span class="font-hanaleiFill text-2xl text-chocoBrown">"CapyTube"</span>
                </A>
                <span class="font-dynapuff text-sm bg-custard rounded-full px-3 py-1">"Beta · WASM prototype"</span>
            </header>
            <main class="max-w-3xl mx-auto px-4 py-6">
                <Routes fallback=|| view! { <p>"Page not found."</p> }>
                    <Route path=path!("/") view=StreamList/>
                    <Route path=path!("/streams/:id") view=StreamPage/>
                </Routes>
            </main>
        </Router>
    }
}

/// Registers the WebMCP tools once, inside the router so a tool can navigate.
#[component]
fn Tools() -> impl IntoView {
    let navigate = use_navigate();
    leptos::task::spawn_local(async move {
        let count = webmcp::register_catalog_tools(move |id| {
            navigate(&format!("/streams/{id}"), NavigateOptions::default());
        })
        .await;
        leptos::logging::log!("webmcp: {count} tool(s) registered");
    });
}

fn access_badge(s: &LiveStream) -> impl IntoView {
    if s.is_public() {
        view! { <span class="text-xs rounded-full px-2 py-0.5 bg-avacadoCream text-darkGreen">"Free"</span> }.into_any()
    } else {
        // A private stream with no price is still private, never "0 coins".
        let label = match s.price_per_10_sec {
            Some(p) => format!("{p} coin / 10 s"),
            None => "Private".to_string(),
        };
        view! {
            <span class="text-xs rounded-full px-2 py-0.5 bg-persimmon text-chocoBrown">
                {label}
            </span>
        }
        .into_any()
    }
}

#[component]
fn StreamList() -> impl IntoView {
    let streams = LocalResource::new(|| api::list_streams(None));
    view! {
        <h1 class="font-hanaleiFill text-titleSizeSM mb-4">"Cameras"</h1>
        <Suspense fallback=|| view! { <p>"Loading streams…"</p> }>
            {move || streams.get().map(|r| match r {
                Err(e) => view! { <p class="text-tomatoRed">{format!("Could not load streams: {e}")}</p> }.into_any(),
                Ok(page) => view! {
                    <ul class="grid gap-4 sm:grid-cols-2" data-testid="stream-list">
                        {page.items.into_iter().map(|s| {
                            let href = format!("/streams/{}", s.id);
                            let live = s.is_live.unwrap_or(false);
                            view! {
                                <li class="bg-cream rounded-xl p-4 shadow-buttonShadow">
                                    <A href=href>
                                        <div class="flex items-center justify-between gap-2">
                                            <span class="font-dynapuff text-lg">{s.title.clone()}</span>
                                            {access_badge(&s)}
                                        </div>
                                        <p class="text-sm mt-1">
                                            {if live { "Live now" } else { "Resting. Showing the reel." }}
                                        </p>
                                    </A>
                                </li>
                            }
                        }).collect_view()}
                    </ul>
                }.into_any(),
            })}
        </Suspense>
    }
}

#[component]
fn StreamPage() -> impl IntoView {
    let params = use_params_map();
    let id = move || params.read().get("id").unwrap_or_default();
    let stream = LocalResource::new(move || {
        let id = id();
        async move { api::get_stream(&id).await }
    });
    view! {
        <A href="/"><span class="text-sm underline">"← All cameras"</span></A>
        <Suspense fallback=|| view! { <p>"Loading…"</p> }>
            {move || stream.get().map(|r| match r {
                Err(e) => view! { <p class="text-tomatoRed">{format!("Could not load the stream: {e}")}</p> }.into_any(),
                Ok(None) => view! { <p>"No such stream."</p> }.into_any(),
                Ok(Some(s)) => view! {
                    <h1 class="font-hanaleiFill text-titleSizeSM my-4">{s.title.clone()}</h1>
                    {access_badge(&s)}
                    <div class="mt-4 aspect-video rounded-xl bg-chocoBrown text-cream grid place-items-center p-4 text-center">
                        {if s.is_public() {
                            // The player (hls.js through a JS shim) is task W6 in the plan.
                            match s.reel_key() {
                                Some(reel) => format!("Player goes here. Nothing live, so it would show /media/{reel}."),
                                None => "Player goes here. Nothing live and no reel.".to_string(),
                            }
                        } else {
                            // Private: title and price only. Playback needs sign-in and payment,
                            // and is resolved by GET /stream/{id} with a token, never from the catalog.
                            "Sign in and pay to watch this camera.".to_string()
                        }}
                    </div>
                }.into_any(),
            })}
        </Suspense>
    }
}
