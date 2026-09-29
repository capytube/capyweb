//! `/watch`: one card per capybara, with a photo, a short line, and how many private
//! cameras that capybara has. Each card opens `/stream/<capyId>`.

use leptos::prelude::*;
use leptos_router::components::A;

use crate::api::{self, Paging};
use crate::components::chrome::PageHead;
use crate::domain::{Capybara, LiveStream};
use crate::pages::watch_room::clip;

/// Portrait stills from `demo/`, re-encoded as WebP (quality 88, about a fifth of the JPEG bytes;
/// capyweb-z14). Cards and posters always show them wider than their 211 px, so there is no
/// smaller size for a `srcset` to offer. Unknown ids get no image.
pub fn portrait(id: &str) -> Option<&'static str> {
    match id {
        "magnus" => Some("/assets/cast/magnus.webp"),
        "elon" => Some("/assets/cast/elon.webp"),
        "einstein" => Some("/assets/cast/einstein.webp"),
        _ => None,
    }
}

pub fn private_cameras(id: &str, streams: &[LiveStream]) -> usize {
    streams
        .iter()
        .filter(|s| !s.is_public() && s.capybara_ids.iter().any(|c| c == id))
        .count()
}

/// Every camera of this capybara plays a recording: the card says so (never "Live").
pub fn all_recorded(id: &str, streams: &[LiveStream]) -> bool {
    let mut cams = streams
        .iter()
        .filter(|s| s.capybara_ids.iter().any(|c| c == id))
        .peekable();
    cams.peek().is_some() && cams.all(LiveStream::is_recording)
}

pub fn private_label(n: usize) -> String {
    match n {
        0 => "No private cameras".to_string(),
        1 => "1 private camera".to_string(),
        n => {
            let mut s = n.to_string();
            s.push_str(" private cameras");
            s
        }
    }
}

fn blurb(c: &Capybara) -> String {
    let raw = c
        .bio
        .as_deref()
        .or(c.personality.as_deref())
        .unwrap_or("A capybara on camera.");
    clip(raw, 110)
}

#[component]
pub fn Watch() -> impl IntoView {
    let capys = LocalResource::new(|| api::list_capybaras(Paging::default(), None));
    let streams = LocalResource::new(|| api::list_streams(None));
    view! {
        <PageHead title="Watch" lede="Pick a capybara. Each card counts the private cameras."/>
        <section class="watch-page" aria-labelledby="cast-heading">
            <h2 id="cast-heading">"Capybaras"</h2>
            <Suspense fallback=|| view! { <p>"Loading capybaras…"</p> }>
                {move || {
                    let capys = capys.get()?;
                    let streams = streams.get()?;
                    Some(match (capys, streams) {
                        (Err(_), _) | (_, Err(_)) => {
                            view! { <p class="text-alertRed">"Could not load the capybaras."</p> }
                                .into_any()
                        }
                        (Ok(page), Ok(_)) if page.items.is_empty() => {
                            view! { <p class="notice">"No capybaras yet."</p> }.into_any()
                        }
                        (Ok(page), Ok(stream_page)) => {
                            let streams = stream_page.items;
                            view! {
                                <ul class="cast-grid" data-testid="capy-list">
                                    {page.items.into_iter().map(|c| {
                                        let n = private_cameras(&c.id, &streams);
                                        let recorded = all_recorded(&c.id, &streams);
                                        let href = {
                                            let mut h = String::from("/stream/");
                                            h.push_str(&c.id);
                                            h
                                        };
                                        let name = c.name.clone();
                                        view! {
                                            <li>
                                                <A href=href attr:class="card cast-card" attr:data-testid="capy-card">
                                                    {portrait(&c.id).map(|src| view! {
                                                        <img src=src alt=name.clone() width="640" height="480"/>
                                                    })}
                                                    <h3>{name.clone()}</h3>
                                                    {recorded.then(|| view! {
                                                        <p class="recorded-pill" data-testid="recorded-label">"Recorded"</p>
                                                    })}
                                                    <p>{blurb(&c)}</p>
                                                    <p class="cast-meta" data-testid="private-count">{private_label(n)}</p>
                                                </A>
                                            </li>
                                        }
                                    }).collect_view()}
                                </ul>
                            }
                            .into_any()
                        }
                    })
                }}
            </Suspense>
        </section>
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn cam(id: &str, capy: &str, public: bool) -> LiveStream {
        serde_json::from_value(serde_json::json!({
            "id": id,
            "title": id,
            "access_type": if public { "public" } else { "private" },
            "capybara_ids": [capy],
        }))
        .unwrap()
    }

    #[test]
    fn private_camera_counts() {
        let streams = vec![
            cam("main-cam", "magnus", true),
            cam("wall-cam", "elon", false),
            cam("food-cam", "einstein", true),
        ];
        assert_eq!(private_cameras("magnus", &streams), 0);
        assert_eq!(private_cameras("elon", &streams), 1);
        assert_eq!(private_cameras("einstein", &streams), 0);
        assert_eq!(private_label(0), "No private cameras");
        assert_eq!(private_label(1), "1 private camera");
        assert_eq!(private_label(2), "2 private cameras");
    }

    #[test]
    fn portraits_are_local_stills() {
        assert_eq!(portrait("magnus"), Some("/assets/cast/magnus.webp"));
        assert_eq!(portrait("nope"), None);
    }
}
