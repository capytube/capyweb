//! Home: cameras, a public-room preview, the gang and a photo strip.

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
        let label = match s.price_per_minute() {
            Some(p) => format!("{p} play coins/min"),
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
    // The featured room's own capybara, never a stand-in. While the list loads, an empty slot of
    // the same size keeps its place, so the page does not jump when the photo comes. Without a
    // public room, or for a capybara with no bundled photo, there is no picture at all.
    let now_photo = move || match streams.get() {
        None => Some(None),
        Some(Ok(page)) => featured(&page.items).and_then(room_photo).map(Some),
        Some(Err(_)) => None,
    };
    view! {
        <PageHead
            title="Watch Magnus. Then pick his snack."
            eyebrow="Real capybaras · play coins only"
            lede="Tune in to the capy cams, react with the room, and vote on what gets served next."
        />
        <section aria-labelledby="cams-heading" class="mt-8">
            <h2 id="cams-heading">"Cameras"</h2>
            // Three card-sized places while the list loads, so nothing below jumps when it comes.
            <Suspense fallback=|| view! {
                <p class="sr-only" role="status">"Loading cameras…"</p>
                <ul class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
                    <li class="card cam-slot"></li><li class="card cam-slot"></li><li class="card cam-slot"></li>
                </ul>
            }>
                {move || streams.get().map(|r| match r {
                    Err(e) => view! { <p class="text-alertRed">{format!("Could not load cameras: {e}")}</p> }.into_any(),
                    Ok(page) if page.items.is_empty() => view! {
                        <p role="status">"No cameras are available right now."</p>
                    }.into_any(),
                    Ok(page) => view! {
                        <ul class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="stream-list">
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
                                            <div class="flex flex-wrap items-center justify-between gap-2">
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
        <section
            class="home-now card"
            class:home-now-text=move || now_photo().is_none()
            aria-labelledby="now-title"
        >
            {move || now_photo().map(|photo| match photo {
                Some(photo) => view! {
                    <img src=photo.src alt=photo.alt width=photo.width height=photo.height/>
                }.into_any(),
                None => view! { <div class="home-now-slot" aria-hidden="true"></div> }.into_any(),
            })}
            <div>
                <h2 id="now-title">"Now showing"</h2>
                <Suspense fallback=|| view! { <p role="status">"Loading the public room…"</p> }>
                    {move || streams.get().map(|r| match r {
                        Err(_) => view! { <p role="alert">"Could not load the public room. Please try again later."</p> }.into_any(),
                        Ok(page) => match featured(&page.items) {
                            Some(stream) => view! {
                                <h3>{stream.title.clone()}</h3>
                                {stream.is_recording().then(|| view! {
                                    <p class="recorded-pill" data-testid="recorded-label">"Recorded"</p>
                                })}
                                <p>"A little time with the capybaras."</p>
                                <A href=watch_href(stream) attr:class="btn">"Watch"</A>
                            }.into_any(),
                            None => view! { <p role="status">"No public room is available right now."</p> }.into_any(),
                        },
                    })}
                </Suspense>
            </div>
        </section>
        <VisitSteps/>
        <Gang/>
        <PhotoStrip/>
    }
}

/// The room "Now showing" features: the first public camera.
fn featured(items: &[LiveStream]) -> Option<&LiveStream> {
    items.iter().find(|s| s.is_public())
}

/// A room's picture: the photo of the capybara its Watch link opens.
fn room_photo(s: &LiveStream) -> Option<Photo> {
    s.capybara_ids.first().and_then(|c| capy_photo(c))
}

#[derive(Clone, Copy, Debug, PartialEq)]
struct Photo {
    src: &'static str,
    alt: &'static str,
    width: u32,
    height: u32,
}

fn capy_photo(id: &str) -> Option<Photo> {
    let (src, alt, height) = match id {
        "einstein" => (
            "/assets/home/einstein.webp",
            "Einstein standing on a bed",
            352,
        ),
        "elon" => (
            "/assets/home/elon.webp",
            "Mochi resting in someone’s lap",
            352,
        ),
        "magnus" => (
            "/assets/home/magnus.webp",
            "Magnus eating grass indoors",
            323,
        ),
        _ => return None,
    };
    Some(Photo {
        src,
        alt,
        width: 211,
        height,
    })
}

#[component]
fn HomePhoto(photo: Photo) -> impl IntoView {
    view! { <img src=photo.src alt=photo.alt width=photo.width height=photo.height loading="lazy"/> }
}

const STEPS: [(&str, &str); 3] = [
    ("Watch", "Meet the capybaras in the free rooms. For now every camera plays a recording of them."),
    ("Spend a coin", "Vote on the next snack or bid on the next climbing hold, with play coins. Play coins are not money."),
    ("Keep a pass", "Explore the membership idea: chalk bonus, a longer gym call. For now, the shop is just for browsing."),
];

const STRIP: [(Photo, &str); 3] = [
    (
        Photo {
            src: "/assets/home/gallery2.webp",
            alt: "A capybara being held",
            width: 458,
            height: 618,
        },
        "Lap cam",
    ),
    (
        Photo {
            src: "/assets/home/gallery3.webp",
            alt: "Three capybaras napping on a bed",
            width: 457,
            height: 618,
        },
        "Nap pile",
    ),
    (
        Photo {
            src: "/assets/home/gallery1.webp",
            alt: "Magnus in front of a colorful climbing wall",
            width: 457,
            height: 618,
        },
        "Gym cam",
    ),
];

#[component]
fn VisitSteps() -> impl IntoView {
    view! {
        <section class="home-band" aria-labelledby="how-title">
            <h2 id="how-title">"How a visit works"</h2>
            <ol class="home-steps">
                {STEPS.into_iter().enumerate().map(|(i, (title, copy))| view! {
                    <li class="card"><p class="home-step-no" aria-hidden="true">{i + 1}</p><h3>{title}</h3><p>{copy}</p></li>
                }).collect_view()}
            </ol>
        </section>
    }
}

#[component]
fn CapyCard(capy: crate::domain::Capybara) -> impl IntoView {
    let photo = capy_photo(&capy.id);
    let awake = capy
        .awake_from
        .zip(capy.awake_to)
        .map(|(from, to)| format!("Awake {from}–{to}"));
    let details = [
        ("Personality", capy.personality),
        ("Fun fact", capy.fun_fact),
        (
            "Favourite activities",
            capy.favorite_activities
                .filter(|a| !a.is_empty())
                .map(|a| a.join(", ")),
        ),
    ];
    view! {
        <li class="card home-capy">
            {photo.map(|photo| view! { <HomePhoto photo/> })}
            <h3><A href=format!("/stream/{}", capy.id)>{capy.name}</A></h3>
            {capy.bio.map(|bio| view! { <p>{bio}</p> })}
            <dl>{details.into_iter().filter_map(|(label, text)| text.map(|text| view! {
                <div><dt>{label}</dt><dd>{text}</dd></div>
            })).collect_view()}</dl>
            {awake.map(|awake| view! { <p class="home-awake">{awake}</p> })}
        </li>
    }
}

#[component]
fn Gang() -> impl IntoView {
    let capybaras = LocalResource::new(|| api::list_capybaras(api::Paging::default(), None));
    view! {
        <section class="home-cast" aria-labelledby="cast-title">
            <h2 id="cast-title">
                <img src="/assets/home/fruit.svg" alt="" width="42" height="42" loading="lazy"/>
                "The gang"
                <img src="/assets/home/flower.svg" alt="" width="42" height="42" loading="lazy"/>
            </h2>
            <Suspense fallback=|| view! { <p role="status">"Loading the gang…"</p> }>
                {move || capybaras.get().map(|r| match r {
                    Err(_) => view! { <p class="notice" role="alert">"Could not load the gang. Please try again later."</p> }.into_any(),
                    Ok(page) if page.items.is_empty() => view! { <p class="notice" role="status">"The gang will be here soon."</p> }.into_any(),
                    Ok(page) => view! {
                        <ul class="home-cast-grid" data-testid="gang-list">
                            {page.items.into_iter().map(|capy| view! { <CapyCard capy/> }).collect_view()}
                        </ul>
                    }.into_any(),
                })}
            </Suspense>
        </section>
    }
}

#[component]
fn PhotoStrip() -> impl IntoView {
    view! {
        <section class="home-film" aria-label="Photos">
            {STRIP.into_iter().map(|(photo, caption)| view! {
                <A href="/watch"><HomePhoto photo/><span>{caption}</span></A>
            }).collect_view()}
        </section>
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bundled_photos_match_known_ids_only() {
        for (id, height) in [("einstein", 352), ("elon", 352), ("magnus", 323)] {
            let photo = capy_photo(id).unwrap();
            assert_eq!(photo.src, format!("/assets/home/{id}.webp"));
            assert_eq!((photo.width, photo.height), (211, height));
            assert!(!photo.alt.is_empty());
        }
        for id in ["unknown", "", "Magnus", "../magnus"] {
            assert_eq!(capy_photo(id), None);
        }
    }

    fn cam(id: &str, access: &str, capys: &[&str]) -> LiveStream {
        serde_json::from_value(serde_json::json!({
            "id": id, "title": id, "access_type": access, "capybara_ids": capys,
        }))
        .unwrap()
    }

    #[test]
    fn now_showing_pictures_the_featured_rooms_own_capybara() {
        let items = [
            cam("wall-cam", "private", &["elon"]),
            cam("food-cam", "public", &["einstein"]),
            cam("main-cam", "public", &["magnus"]),
        ];
        let room = featured(&items).unwrap();
        assert_eq!(room.id, "food-cam");
        assert_eq!(room_photo(room), capy_photo("einstein"));
        assert_eq!(featured(&items[..1]).map(|s| s.id.as_str()), None);
        assert_eq!(room_photo(&cam("new-cam", "public", &["new-friend"])), None);
        assert_eq!(room_photo(&cam("empty-cam", "public", &[])), None);
    }
}
