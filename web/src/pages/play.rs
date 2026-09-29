//! Play page: capybara picker plus read-only vote and bid cards.

use leptos::prelude::*;
use leptos_router::{
    hooks::{use_navigate, use_query_map},
    NavigateOptions,
};

use crate::{
    api::{self, Paging},
    components::chrome::PageHead,
    domain::{Capybara, Interaction, InteractionType, VoteOption},
};

fn coin_label(count: u64) -> String {
    if count == 1 {
        "1 play coin".into()
    } else {
        let mut label = count.to_string();
        label.push_str(" play coins");
        label
    }
}

fn option_label(option: &VoteOption) -> String {
    let mut label = option.title.clone();
    if let Some(desc) = option.description.as_ref() {
        label.push_str(" - ");
        label.push_str(desc);
    }
    label
}

#[component]
fn InteractionCard(interaction: Interaction) -> impl IntoView {
    let is_vote = interaction.interaction_type == InteractionType::Vote;
    let rules = interaction.rules.unwrap_or_default();
    view! {
        <article class="card play-card" data-testid=if is_vote { "vote-card" } else { "bid-card" }>
            <h2>{interaction.title.clone()}</h2>
            <p>{interaction.description.clone().unwrap_or_default()}</p>
            {if is_vote {
                let vote_cost = interaction.vote_cost;
                let custom_cost = interaction.custom_request_cost;
                let options = interaction.options.unwrap_or_default();
                view! {
                    <p class="play-cost">
                        {match vote_cost {
                            Some(cost) => {
                                let mut label = "Cost: ".to_string();
                                label.push_str(&coin_label(cost));
                                label.push_str(" per vote");
                                label
                            }
                            None => "Cost: Price not set".to_string(),
                        }}
                    </p>
                    {custom_cost.map(|cost| view! {
                        <p class="play-cost">
                            {
                                let mut label = "Custom request: ".to_string();
                                label.push_str(&coin_label(cost));
                                label
                            }
                        </p>
                    })}
                    <ul class="play-options" aria-label="Vote options">
                        {options.into_iter().map(|option| view! {
                            <li><p>{option_label(&option)}</p></li>
                        }).collect_view()}
                    </ul>
                }.into_any()
            } else {
                let current = interaction.current_bid;
                view! {
                    <p class="play-cost">
                        {match current {
                            Some(value) => {
                                let mut label = "Current top bid: ".to_string();
                                label.push_str(&coin_label(value));
                                label
                            }
                            None => "Current top bid: No bids yet".to_string(),
                        }}
                    </p>
                    {current.map(|value| view! {
                        <p class="play-cost">
                            {
                                let mut label = "Minimum next bid: ".to_string();
                                label.push_str(&coin_label(value.saturating_add(1)));
                                label
                            }
                        </p>
                    })}
                }.into_any()
            }}
            <h3>"Rules"</h3>
            <ul class="play-rules">
                {rules.into_iter().map(|rule| view! { <li>{rule}</li> }).collect_view()}
            </ul>
        </article>
    }
}

#[component]
pub fn Play() -> impl IntoView {
    let query = use_query_map();
    let navigate = use_navigate();
    let capybaras = LocalResource::new(|| api::list_capybaras(Paging::default(), None));
    let selected_capy = Memo::new(move |_| {
        let query_capy = query.with(|q| q.get("capy").filter(|value| !value.is_empty()));
        let mut cast = capybaras.get().and_then(Result::ok)?.items;
        cast.sort_by(|a: &Capybara, b: &Capybara| a.name.cmp(&b.name));
        if let Some(capy) = query_capy {
            if cast.iter().any(|item| item.id == capy) {
                return Some(capy);
            }
        }
        cast.first().map(|capy| capy.id.clone())
    });
    let interactions = LocalResource::new(move || {
        let capy = selected_capy.get();
        async move {
            if let Some(capy) = capy {
                api::list_interactions(&capy, None, Paging::default(), None).await
            } else {
                Ok(crate::domain::Page {
                    items: Vec::new(),
                    count: 0,
                    cursor: None,
                    truncated: false,
                    hint: None,
                })
            }
        }
    });

    view! {
        <PageHead
            title="Play"
            eyebrow="Play coins only"
            lede="Choose a capybara and review open vote and bid cards."
        />
        <p class="notice" data-testid="play-soon">"Voting and bidding open soon."</p>
        <Suspense fallback=|| view! { <p role="status">"Loading capybaras…"</p> }>
            {move || capybaras.get().map(|result| match result {
                Err(_) => view! { <p class="notice" role="alert">"Could not load capybaras right now."</p> }.into_any(),
                Ok(page) => {
                    let mut cast = page.items;
                    cast.sort_by(|a: &Capybara, b: &Capybara| a.name.cmp(&b.name));
                    view! {
                        <section aria-labelledby="play-capy-picker">
                            <h2 id="play-capy-picker">"Choose your capybara"</h2>
                            <div class="play-picker" role="group" aria-label="Choose a capybara">
                                {cast.into_iter().map(|capy| {
                                    let active_id = capy.id.clone();
                                    let pressed_id = capy.id.clone();
                                    let nav_id = capy.id;
                                    let go = navigate.clone();
                                    view! {
                                        <button
                                            type="button"
                                            class="play-picker-btn"
                                            class:active=move || selected_capy.get().as_deref() == Some(active_id.as_str())
                                            aria-pressed=move || selected_capy.get().as_deref() == Some(pressed_id.as_str())
                                            on:click=move |_| {
                                                let mut next = "/play?capy=".to_string();
                                                next.push_str(&nav_id);
                                                go(&next, NavigateOptions { replace: true, ..Default::default() })
                                            }
                                        >
                                            {capy.name.clone()}
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
                    view! {
                        <div class="play-stack" data-testid="play-grid">
                            {page.items.into_iter().map(|item| view! { <InteractionCard interaction=item/> }).collect_view()}
                        </div>
                    }.into_any()
                }
            })}
        </Suspense>
    }
}
