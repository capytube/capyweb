//! Play page (W5): capybara picker, vote and bid cards, and the gated confirm/thanks steps.

use leptos::prelude::*;

use crate::{
    api::{self, Paging},
    components::chrome::PageHead,
    domain::{Capybara, Interaction, InteractionType, VoteOption},
    state::use_session,
};

fn selected_from_query() -> Option<String> {
    let search = web_sys::window()?.location().search().ok()?;
    let query = search.strip_prefix('?').unwrap_or(&search);
    for pair in query.split('&') {
        let mut parts = pair.splitn(2, '=');
        if parts.next() == Some("capy") {
            let value = parts.next().unwrap_or_default();
            if !value.is_empty() {
                return Some(value.to_string());
            }
        }
    }
    None
}

fn set_capy_query(id: &str) {
    let Some(window) = web_sys::window() else {
        return;
    };
    let Some(history) = window.history().ok() else {
        return;
    };
    let _ = history.replace_state_with_url(
        &wasm_bindgen::JsValue::NULL,
        "",
        Some(&format!("/play?capy={id}")),
    );
}

fn option_label(option: &VoteOption) -> String {
    option
        .description
        .as_ref()
        .map(|desc| format!("{} - {}", option.title, desc))
        .unwrap_or_else(|| option.title.clone())
}

#[component]
fn CostConfirmPreview(cost: u64, action: &'static str) -> impl IntoView {
    view! {
        <section class="card play-preview" aria-label="Cost confirmation preview">
            <h2>"Cost confirmation (preview)"</h2>
            <p>{format!("Before this {action} can run, you'll confirm a cost of {cost} play coin(s).")}</p>
        </section>
    }
}

#[component]
fn ThanksPreview(action: &'static str) -> impl IntoView {
    view! {
        <section class="card play-preview" aria-label="Thanks step preview">
            <h2>"Thanks step (preview)"</h2>
            <p>{format!("After a successful {action}, this page shows a thank-you state.")}</p>
        </section>
    }
}

#[component]
fn VoteCard(interaction: Interaction) -> impl IntoView {
    let vote_cost = interaction.vote_cost.unwrap_or(0);
    let custom_cost = interaction.custom_request_cost.unwrap_or(0);
    view! {
        <article class="card play-card" data-testid="vote-card">
            <h2>{interaction.title.clone()}</h2>
            <p>{interaction.description.clone().unwrap_or_default()}</p>
            <p class="play-cost">{format!("Cost: {vote_cost} coin(s) per vote")}</p>
            <p class="play-cost">{format!("Custom request cost: {custom_cost} coin(s)")}</p>
            <ul class="play-options" aria-label="Vote options">
                {interaction.options.unwrap_or_default().into_iter().map(|option| view! {
                    <li>
                        <p>{option_label(&option)}</p>
                        <p class="play-muted">"Current votes: 0 (fixtures do not carry tallies yet)"</p>
                    </li>
                }).collect_view()}
            </ul>
            <h3>"Rules"</h3>
            <ul class="play-rules">
                {interaction.rules.unwrap_or_default().into_iter().map(|rule| view! { <li>{rule}</li> }).collect_view()}
            </ul>
        </article>
    }
}

#[component]
fn BidCard(interaction: Interaction) -> impl IntoView {
    let current = interaction.current_bid.unwrap_or(0);
    let minimum = current.saturating_add(1);
    view! {
        <article class="card play-card" data-testid="bid-card">
            <h2>{interaction.title.clone()}</h2>
            <p>{interaction.description.clone().unwrap_or_default()}</p>
            <p class="play-cost">{format!("Current top bid: {current} coin(s)")}</p>
            <p class="play-cost">{format!("Minimum next bid: {minimum} coin(s)")}</p>
            <h3>"Rules"</h3>
            <ul class="play-rules">
                {interaction.rules.unwrap_or_default().into_iter().map(|rule| view! { <li>{rule}</li> }).collect_view()}
            </ul>
        </article>
    }
}

#[component]
pub fn Play() -> impl IntoView {
    let session = use_session();
    let capybaras = LocalResource::new(|| api::list_capybaras(Paging::default(), None));
    let selected_capy = RwSignal::new(selected_from_query());
    let interactions = LocalResource::new(move || {
        let capy = selected_capy.get().unwrap_or_default();
        async move {
            if capy.is_empty() {
                Ok(crate::domain::Page {
                    items: Vec::new(),
                    count: 0,
                    cursor: None,
                    truncated: false,
                    hint: None,
                })
            } else {
                api::list_interactions(&capy, None, Paging::default(), None).await
            }
        }
    });

    let choose = move |id: String| {
        selected_capy.set(Some(id.clone()));
        set_capy_query(&id);
    };

    view! {
        <PageHead
            title="Play"
            eyebrow="Play coins only"
            lede="Choose a capybara, review open votes and bids, and see the coin cost before confirmation."
        />
        <p class="notice" data-testid="play-soon">"Voting and bidding open soon. The cards below are read-only until write routes are live."</p>
        <Suspense fallback=|| view! { <p role="status">"Loading capybaras…"</p> }>
            {move || capybaras.get().map(|result| match result {
                Err(_) => view! { <p class="notice" role="alert">"Could not load capybaras right now."</p> }.into_any(),
                Ok(page) => {
                    let mut cast = page.items;
                    cast.sort_by(|a: &Capybara, b: &Capybara| a.name.cmp(&b.name));
                    if let Some(current) = selected_capy.get() {
                        if !cast.iter().any(|c| c.id == current) {
                            if let Some(first) = cast.first() {
                                choose(first.id.clone());
                            }
                        }
                    } else if let Some(first) = cast.first() {
                        choose(first.id.clone());
                    }
                    view! {
                        <section aria-labelledby="play-capy-picker">
                            <h2 id="play-capy-picker">"Choose your capybara"</h2>
                            <div class="play-picker" role="listbox" aria-label="Choose a capybara">
                                {cast.into_iter().map(|capy| {
                                    let capy_id = capy.id.clone();
                                    let selected_id = capy.id;
                                    let capy_name = capy.name.clone();
                                    let active_id = selected_id.clone();
                                    let aria_id = selected_id.clone();
                                    view! {
                                        <button
                                            type="button"
                                            class="play-picker-btn"
                                            class:active=move || selected_capy.get().as_deref() == Some(active_id.as_str())
                                            aria-selected=move || selected_capy.get().as_deref() == Some(aria_id.as_str())
                                            on:click=move |_| choose(capy_id.clone())
                                        >
                                            {capy_name}
                                        </button>
                                    }
                                }).collect_view()}
                            </div>
                        </section>
                    }.into_any()
                }
            })}
        </Suspense>
        <Suspense fallback=|| view! { <p role="status">"Loading interactions…"</p> }>
            {move || interactions.get().map(|result| match result {
                Err(_) => view! { <p class="notice" role="alert">"Could not load interactions right now."</p> }.into_any(),
                Ok(page) if page.items.is_empty() => view! {
                    <p class="notice" role="status">"No open vote or bid cards for this capybara yet."</p>
                }.into_any(),
                Ok(page) => {
                    let (votes, bids): (Vec<_>, Vec<_>) = page.items
                        .into_iter()
                        .partition(|item| item.interaction_type == InteractionType::Vote);
                    view! {
                        <div class="play-grid" data-testid="play-grid">
                            <section aria-labelledby="play-votes">
                                <h2 id="play-votes">"Vote cards"</h2>
                                <div class="play-stack">
                                    {votes.into_iter().map(|item| view! { <VoteCard interaction=item/> }).collect_view()}
                                </div>
                            </section>
                            <section aria-labelledby="play-bids">
                                <h2 id="play-bids">"Bid cards"</h2>
                                <div class="play-stack">
                                    {bids.into_iter().map(|item| view! { <BidCard interaction=item/> }).collect_view()}
                                </div>
                            </section>
                        </div>
                    }.into_any()
                }
            })}
        </Suspense>
        <Show when=move || session.writes_enabled.get()>
            <CostConfirmPreview cost=5 action="vote"/>
            <CostConfirmPreview cost=21 action="bid"/>
            <ThanksPreview action="vote or bid"/>
        </Show>
    }
}
