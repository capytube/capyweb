//! Shop: the read-only pass list and pass details (W7). Passes are the backend's `/nfts`
//! records; there is no buying, offering or claiming until the write API exists (plan Q1).

use leptos::prelude::*;
use leptos_router::{components::A, hooks::use_params_map};

use crate::{
    api::{self, CatalogQuery, Paging},
    components::chrome::PageHead,
    domain::{Pass, Rarity},
};

#[derive(Clone, Copy)]
enum Sort {
    PriceLow,
    PriceHigh,
    Name,
}

/// ASCII case folding, not `to_lowercase`: Unicode case tables cost ~4 KB brotli in the .wasm,
/// pass names and labels are our own English, and Thai (most visitors) has no letter case.
fn matching_passes(passes: &[Pass], search: &str, sort: Sort) -> Vec<Pass> {
    let search = search.trim().to_ascii_lowercase();
    let mut matches: Vec<_> = passes
        .iter()
        .filter(|p| {
            p.name.to_ascii_lowercase().contains(&search)
                || p.labels
                    .iter()
                    .flatten()
                    .any(|label| label.to_ascii_lowercase().contains(&search))
        })
        .cloned()
        .collect();
    matches.sort_by(|a, b| {
        // Missing prices stay last, rather than implying that a pass is free.
        let price = |reverse| match (a.price, b.price) {
            (Some(a), Some(b)) => {
                if reverse {
                    b.cmp(&a)
                } else {
                    a.cmp(&b)
                }
            }
            (None, Some(_)) => std::cmp::Ordering::Greater,
            (Some(_), None) => std::cmp::Ordering::Less,
            _ => std::cmp::Ordering::Equal,
        };
        match sort {
            Sort::PriceLow => price(false),
            Sort::PriceHigh => price(true),
            Sort::Name => a
                .name
                .to_ascii_lowercase()
                .cmp(&b.name.to_ascii_lowercase()),
        }
        .then_with(|| b.for_sale().cmp(&a.for_sale()))
        .then_with(|| a.id.cmp(&b.id))
    });
    matches
}

fn rarity_label(rarity: Option<Rarity>) -> Option<&'static str> {
    match rarity? {
        Rarity::Common => Some("Common"),
        Rarity::Rare => Some("Rare"),
        Rarity::Epic => Some("Epic"),
        Rarity::Legendary => Some("Legendary"),
        Rarity::UltraRare => Some("Ultra rare"),
        Rarity::Unknown => None,
    }
}

fn coins(price: Option<u64>) -> String {
    match price {
        Some(1) => "1 coin".into(),
        Some(n) => format!("{n} coins"),
        None => "Price unavailable".into(),
    }
}

fn pass_image(pass: &Pass) -> impl IntoView {
    pass.image_url.as_deref().and_then(api::media_src).map(|src| view! {
        <img class="pass-image" src=src alt=pass.name.clone() width="480" height="320" loading="lazy"/>
    })
}

fn pass_meta(pass: &Pass) -> impl IntoView {
    view! {
        {rarity_label(pass.rarity).map(|label| view! { <span class="eyebrow">{label}</span> })}
        <p class="pass-price">{coins(pass.price)}</p>
        <p>{if pass.for_sale() { "For sale" } else { "Not for sale" }}</p>
        <ul class="pass-labels">{pass.labels.iter().flatten().map(|label| view! { <li>{label.clone()}</li> }).collect_view()}</ul>
    }
}

#[component]
pub fn Shop() -> impl IntoView {
    let passes = LocalResource::new(|| api::list_passes(CatalogQuery::All { limit: None }, None));
    let search = RwSignal::new(String::new());
    let sort = RwSignal::new(Sort::PriceLow);
    view! {
        <PageHead title="Passes" eyebrow="The capy club" lede="Membership cards from the shop. Claiming with play coins is coming soon."/>
        <div class="shop-controls">
            <label for="pass-search">"Search by name or label"
                <input id="pass-search" type="search" placeholder="Try cafe or chalk" prop:value=move || search.get()
                    on:input=move |ev| search.set(event_target_value(&ev))/>
            </label>
            <label for="pass-sort">"Sort passes"
                <select id="pass-sort" on:change=move |ev| sort.set(match event_target_value(&ev).as_str() {
                    "high" => Sort::PriceHigh, "name" => Sort::Name, _ => Sort::PriceLow,
                })>
                    <option value="low">"Price: low to high"</option>
                    <option value="high">"Price: high to low"</option>
                    <option value="name">"Name"</option>
                </select>
            </label>
        </div>
        <Suspense fallback=|| view! { <p role="status">"Loading passes…"</p> }>
            {move || passes.get().map(|result| match result {
                Err(_) => view! { <p class="notice" role="alert">"Could not load passes. Please try again later."</p> }.into_any(),
                Ok(page) => {
                    let items = matching_passes(&page.items, &search.get(), sort.get());
                    if items.is_empty() {
                        view! { <p class="notice" role="status">"No passes match your search."</p> }.into_any()
                    } else {
                        view! {
                            <ul class="shop-grid" data-testid="pass-list">
                                {items.into_iter().map(|pass| view! {
                                    <li class="card shop-card">
                                        <A href=format!("/shop/{}", pass.id) attr:class="pass-link">
                                            {pass_image(&pass)}
                                            <h2>{pass.name.clone()}</h2>
                                            {pass_meta(&pass)}
                                        </A>
                                    </li>
                                }).collect_view()}
                            </ul>
                        }.into_any()
                    }
                }
            })}
        </Suspense>
    }
}

#[component]
fn MissingPass() -> impl IntoView {
    view! { <PageHead title="Pass not found" lede="This pass is not in the collection."/> }
}

#[component]
pub fn PassDetails() -> impl IntoView {
    let params = use_params_map();
    let pass = LocalResource::new(move || {
        let id = params.get().get("id").unwrap_or_default();
        async move { api::get_pass(&id, None).await }
    });
    view! {
        <p class="mb-6"><A href="/shop">"← Back to passes"</A></p>
        <Suspense fallback=|| view! { <p role="status">"Loading pass…"</p> }>
            {move || pass.get().map(|result| match result {
                Ok(Some(pass)) => view! { <DetailContent pass=pass/> }.into_any(),
                Ok(None) => view! { <MissingPass/> }.into_any(),
                Err(e) if e.status == 400 => view! { <MissingPass/> }.into_any(),
                Err(_) => view! { <PageHead title="Pass unavailable" lede="Could not load this pass. Please try again later."/> }.into_any(),
            })}
        </Suspense>
    }
}

fn date(value: Option<String>) -> impl IntoView {
    value
        .map(|value| {
            let label = value
                .replace('T', " ")
                .replace(".000Z", " UTC")
                .replace('Z', " UTC");
            view! { <time datetime=value>{label}</time> }
        })
        .map(IntoView::into_view)
}

#[component]
fn DetailContent(pass: Pass) -> impl IntoView {
    let offer_id = pass.id.clone();
    let activity_id = pass.id.clone();
    let offers = LocalResource::new(move || {
        let id = offer_id.clone();
        async move { api::list_offers(&id, Paging::default(), None).await }
    });
    let activity = LocalResource::new(move || {
        let id = activity_id.clone();
        async move { api::list_activity(&id, Paging::default(), None).await }
    });
    view! {
        <PageHead title=pass.name.clone() eyebrow="The capy club"/>
        <div class="pass-detail">
            <section class="card" aria-label="Pass details">
                {pass_image(&pass)}
                <div class="mt-4">{pass_meta(&pass)}</div>
                <h2 class="mt-6">"Properties"</h2>
                <dl class="pass-properties">{pass.properties.unwrap_or_default().into_iter().map(|p| view! {
                    <div><dt>{p.key}</dt><dd>{p.value}</dd></div>
                }).collect_view()}</dl>
            </section>
            <div class="pass-history">
                <section class="card" aria-labelledby="offers-heading">
                    <h2 id="offers-heading">"Offers"</h2>
                    <Suspense fallback=|| view! { <p>"Loading offers…"</p> }>
                        {move || offers.get().map(|r| match r {
                            Err(_) => view! { <p role="alert">"Could not load offers."</p> }.into_any(),
                            Ok(page) if page.items.is_empty() => view! { <p>"No offers yet"</p> }.into_any(),
                            Ok(page) => view! {
                                <div class="pass-table-scroll" tabindex="0" role="region" aria-label="Offers table">
                                    <table aria-labelledby="offers-heading" data-testid="offers-table">
                                        <thead><tr><th scope="col">"Price"</th><th scope="col">"Expiry date"</th></tr></thead>
                                        <tbody>{page.items.into_iter().map(|o| view! {
                                            <tr><td>{coins(Some(o.price))}</td><td>{if o.expires_at.is_some() { date(o.expires_at).into_any() } else { "Not specified".into_any() }}</td></tr>
                                        }).collect_view()}</tbody>
                                    </table>
                                </div>
                            }.into_any(),
                        })}
                    </Suspense>
                </section>
                <section class="card" aria-labelledby="activity-heading">
                    <h2 id="activity-heading">"Activity"</h2>
                    <Suspense fallback=|| view! { <p>"Loading activity…"</p> }>
                        {move || activity.get().map(|r| match r {
                            Err(_) => view! { <p role="alert">"Could not load activity."</p> }.into_any(),
                            Ok(page) if page.items.is_empty() => view! { <p>"No activity yet"</p> }.into_any(),
                            Ok(page) => view! {
                                <div class="pass-table-scroll" tabindex="0" role="region" aria-label="Activity table">
                                    <table aria-labelledby="activity-heading" data-testid="activity-table">
                                        <thead><tr><th scope="col">"Event"</th><th scope="col">"Price"</th><th scope="col">"Date"</th></tr></thead>
                                        <tbody>{page.items.into_iter().map(|a| view! {
                                            <tr><td>{a.event}</td><td>{coins(a.price)}</td><td>{date(Some(a.timestamp))}</td></tr>
                                        }).collect_view()}</tbody>
                                    </table>
                                </div>
                            }.into_any(),
                        })}
                    </Suspense>
                </section>
            </div>
        </div>
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::Page;

    fn fixtures() -> Vec<Pass> {
        serde_json::from_str::<Page<Pass>>(include_str!("../../fixtures/nfts.json"))
            .unwrap()
            .items
    }

    #[test]
    fn search_names_and_labels_case_insensitively() {
        let passes = fixtures();
        assert_eq!(
            matching_passes(&passes, " CAFE ", Sort::Name)[0].id,
            "capy-5687"
        );
        assert_eq!(matching_passes(&passes, "#1234", Sort::Name).len(), 1);
        assert_eq!(matching_passes(&passes, "", Sort::Name).len(), 3);
        assert!(matching_passes(&passes, "absent", Sort::Name).is_empty());
    }

    #[test]
    fn sorts_prices_and_names_without_losing_filter() {
        let passes = fixtures();
        assert_eq!(
            matching_passes(&passes, "", Sort::PriceLow)[0].price,
            Some(3)
        );
        assert_eq!(
            matching_passes(&passes, "", Sort::PriceHigh)[0].price,
            Some(6)
        );
        assert_eq!(
            matching_passes(&passes, "", Sort::Name)[0].name,
            "Capy #1234"
        );
        assert_eq!(matching_passes(&passes, "chalk", Sort::PriceHigh).len(), 1);
        let mut tied = passes;
        for p in &mut tied {
            p.price = Some(5);
            p.name = "Same".into();
        }
        tied[0].is_for_sale = Some(0);
        for sort in [Sort::PriceLow, Sort::PriceHigh, Sort::Name] {
            assert!(matching_passes(&tied, "", sort)[0].for_sale());
        }
        tied[1].price = None;
        for sort in [Sort::PriceLow, Sort::PriceHigh] {
            assert_eq!(matching_passes(&tied, "", sort).last().unwrap().price, None);
        }
    }

    #[test]
    fn readable_rarity_and_missing_prices() {
        assert_eq!(rarity_label(Some(Rarity::UltraRare)), Some("Ultra rare"));
        assert_eq!(rarity_label(Some(Rarity::Unknown)), None);
        assert_eq!(rarity_label(None), None);
        assert_eq!(coins(None), "Price unavailable");
    }
}
