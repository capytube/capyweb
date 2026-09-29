//! Play page (W5): pick a capybara, then vote or bid on its cards with play coins.
//!
//! - No user pool configured (`auth.ready()` is false): read-only cards, and no vote, bid or
//!   sign-in buttons.
//! - Signed out: the buttons show. A press keeps the action and signs in first
//!   (`sign_in_then`); back on this page, the same action's confirm step opens (`take_pending`).
//!   Nothing is charged without Confirm.
//! - Signed in: the confirm dialog shows what the action does, its cost priced from the
//!   interaction the server sent, and the balance before and after. Each confirmed action has one
//!   `Idempotency-Key`, made when its dialog opens and reused for its retries, so a double click
//!   or a retry never charges twice. After a charge the balance and the cards are reloaded.

use leptos::prelude::*;
use leptos::task::spawn_local;
use leptos_router::{
    hooks::{use_navigate, use_query_map},
    NavigateOptions,
};

use crate::{
    api::{self, ApiError, CodedError, Paging, VoteChoice},
    auth::{load_balance as balance, use_auth, Auth},
    components::{chrome::PageHead, modal::Modal},
    domain::{Capybara, Interaction, InteractionType, Page, VoteOption},
    oauth::PendingAction,
    state::{use_session, use_toasts, Session},
};

/// docs/DATA_MODEL.md section 6: `MAX_VOTES_PER_REQUEST`, `MAX_BID`, the custom request length.
const MAX_VOTES: u64 = 10;
const MAX_BID: u64 = 1_000_000;
const CUSTOM_MAX: usize = 60;

pub fn coin_label(count: u64) -> String {
    let mut label = count.to_string();
    label.push_str(if count == 1 {
        " play coin"
    } else {
        " play coins"
    });
    label
}

fn option_label(option: &VoteOption) -> String {
    let mut label = option.title.clone();
    if let Some(desc) = option.description.as_ref() {
        label.push_str(" - ");
        label.push_str(desc);
    }
    label
}

/// The lowest bid the server will take.
fn coin_min(current: Option<u64>) -> u64 {
    current.unwrap_or(0).saturating_add(1)
}

/// What the user asked for, before it is priced. Also what is kept across a sign-in.
#[derive(Clone, Debug, PartialEq)]
struct Draft {
    ixn: String,
    vote: bool,
    /// A vote's option id; empty for a custom snack request.
    option: String,
    custom: String,
    /// The number of votes, or the bid amount.
    count: u64,
}

impl Draft {
    fn encode(&self) -> String {
        serde_json::json!([self.ixn, self.option, self.custom, self.count]).to_string()
    }

    fn decode(vote: bool, data: &str) -> Option<Draft> {
        let v: serde_json::Value = serde_json::from_str(data).ok()?;
        Some(Draft {
            ixn: v[0].as_str()?.into(),
            vote,
            option: v[1].as_str()?.into(),
            custom: v[2].as_str()?.into(),
            count: v[3].as_u64()?,
        })
    }
}

/// The cost in play coins and one line saying what the action does, priced from the
/// interaction as the server sent it. `Err` is a message for the user.
fn price(ixn: &Interaction, d: &Draft) -> Result<(u64, String), String> {
    let mut what = String::new();
    let cost = if d.vote {
        let each = ixn.vote_cost.ok_or("This vote has no price yet.")?;
        if !(1..=MAX_VOTES).contains(&d.count) {
            return Err("Choose from 1 to 10 votes.".into());
        }
        let mut cost = each.saturating_mul(d.count);
        what.push_str(&d.count.to_string());
        what.push_str(if d.count == 1 {
            " vote for "
        } else {
            " votes for "
        });
        if d.option.is_empty() {
            let extra = ixn
                .custom_request_cost
                .ok_or("This vote takes no snack ideas.")?;
            let text = d.custom.trim();
            if text.is_empty() {
                return Err("Write your snack idea first.".into());
            }
            if text.chars().count() > CUSTOM_MAX {
                return Err("Keep your snack idea to 60 characters.".into());
            }
            cost = cost.saturating_add(extra);
            what.push_str("your snack idea \u{201c}");
            what.push_str(text);
            what.push('\u{201d}');
        } else {
            let option = ixn
                .options
                .iter()
                .flatten()
                .find(|o| o.id == d.option)
                .ok_or("Pick a snack first.")?;
            what.push_str(&option.title);
        }
        what.push_str(" in \u{201c}");
        cost
    } else {
        let min = coin_min(ixn.current_bid);
        if d.count < min {
            return Err("Bid at least ".to_string() + &coin_label(min) + ".");
        }
        if d.count > MAX_BID {
            return Err("One bid can be at most 1000000 play coins.".into());
        }
        what.push_str("Bid ");
        what.push_str(&coin_label(d.count));
        what.push_str(" on \u{201c}");
        d.count
    };
    what.push_str(&ixn.title);
    what.push_str("\u{201d}.");
    Ok((cost, what))
}

/// A refusal from the server, in one plain sentence. Nothing was charged for any of these.
fn refusal(e: &CodedError, cost: u64, coins: Option<u64>) -> String {
    let mut m = String::new();
    if e.is("insufficient_coins") {
        m.push_str("Not enough play coins: this costs ");
        m.push_str(&coin_label(cost));
        if let Some(c) = coins {
            m.push_str(" and you have ");
            m.push_str(&coin_label(c));
        }
        m.push('.');
    } else if e.is("interaction_closed") {
        m.push_str("This has closed.");
    } else if e.is("bid_too_low") {
        m.push_str("Someone bid higher.");
        // "a bid must be at least 22"
        if let Some(min) = e
            .error
            .message
            .rsplit(' ')
            .next()
            .and_then(|n| n.parse::<u64>().ok())
        {
            m.push_str(" The minimum is now ");
            m.push_str(&coin_label(min));
            m.push('.');
        }
    } else if e.is("conflict") {
        m.push_str("That changed while you were confirming. Close this and try again.");
    } else if e.error.status == 401 {
        m.push_str("Please sign in again.");
    } else {
        m.push_str("That did not go through.");
    }
    m.push_str(" Nothing was spent.");
    m
}

#[derive(Clone, Debug, Default, PartialEq)]
enum Step {
    #[default]
    Ready,
    Busy,
    Failed {
        message: String,
        retry: bool,
    },
}

/// The action in the confirm dialog, priced, with its idempotency key.
#[derive(Clone, Debug, PartialEq)]
struct Ask {
    draft: Draft,
    what: String,
    cost: u64,
    key: String,
}

/// Everything the confirm dialog and the thank-you lines need, in one signal (each signal type
/// costs code in the first-load bundle).
#[derive(Default)]
struct Dlg {
    ask: Option<Ask>,
    step: Step,
    /// After a success: the interaction's id and the thank-you line.
    thanks: Option<(String, String)>,
    /// Every action that has been sent and has no definite answer yet, with its key. Asking again
    /// for the same thing reuses its key, so an attempt that did arrive cannot be charged a second
    /// time. One entry per action: confirming another action in between must not drop this one.
    unsure: Vec<(Draft, String)>,
    /// The action kept across a sign-in, until its interaction has loaded.
    waiting: Option<Draft>,
}

type Interactions = LocalResource<Result<Page<Interaction>, ApiError>>;

/// The page's spending state: one confirm dialog for every card.
#[derive(Clone, Copy)]
struct Spend {
    open: RwSignal<bool>,
    dlg: RwSignal<Dlg>,
    reload: Interactions,
    session: Session,
}

impl Spend {
    /// A reactive line of text from the dialog state and the balance. One closure type for
    /// every such line keeps the bundle small.
    fn text(self, f: fn(&Dlg, Option<u64>) -> String) -> impl Fn() -> String + Copy {
        move || {
            let coins = self.session.coins.get();
            self.dlg.with(|d| f(d, coins))
        }
    }

    /// Open the confirm step for `draft`, or say why it cannot be done.
    fn ask(self, auth: Auth, ixn: &Interaction, draft: Draft) -> Result<(), String> {
        let (cost, what) = price(ixn, &draft)?;
        self.dlg.update(|d| {
            let key = d
                .unsure
                .iter()
                .find(|(u, _)| *u == draft)
                .map(|(_, k)| k.clone())
                .unwrap_or_else(crate::auth::random_key);
            d.ask = Some(Ask {
                draft,
                what,
                cost,
                key,
            });
            d.step = Step::Ready;
            d.thanks = None;
        });
        self.open.set(true);
        spawn_local(async move {
            balance(auth, self.session).await;
        });
        Ok(())
    }

    fn confirm(self, auth: Auth) {
        let Some(a) = self
            .dlg
            .with_untracked(|d| d.ask.clone().filter(|_| d.step != Step::Busy))
        else {
            return;
        };
        self.dlg.update(|d| {
            d.step = Step::Busy;
            if !d.unsure.iter().any(|(_, k)| *k == a.key) {
                d.unsure.push((a.draft.clone(), a.key.clone()));
            }
        });
        spawn_local(async move {
            let d = &a.draft;
            let result = if d.vote {
                let choice = if d.option.is_empty() {
                    VoteChoice::Custom(d.custom.trim())
                } else {
                    VoteChoice::Option(&d.option)
                };
                api::vote(auth, &d.ixn, choice, d.count, &a.key).await
            } else {
                api::bid(auth, &d.ixn, d.count, &a.key).await
            };
            // Another action may have opened meanwhile: leave its dialog alone. Asked again after
            // every await, never remembered across one.
            let key = a.key.clone();
            let current = move || {
                self.dlg
                    .with_untracked(|x| x.ask.as_ref().is_some_and(|x| x.key == key))
            };
            if matches!(&result, Err(e) if e.outcome_unknown()) {
                if current() {
                    self.dlg.update(|x| {
                        x.step = Step::Failed {
                            message:
                                "No answer from CapyTube. Try again: it will not charge you twice."
                                    .into(),
                            retry: true,
                        }
                    });
                }
                return;
            }
            self.reload.refetch();
            let coins = balance(auth, self.session).await;
            let done = result.is_ok();
            let current = current();
            self.dlg.update(|x| {
                // A definite answer for this key: forget it, and only it. Another action that is
                // still waiting for an answer keeps its own key.
                x.unsure.retain(|(_, k)| *k != a.key);
                match result {
                    Ok(charge) => {
                        let mut t = if d.vote {
                            "Thank you for your vote! "
                        } else {
                            "Thank you for your bid! "
                        }
                        .to_string();
                        t.push_str(&coin_label(charge.charged));
                        t.push_str(" spent.");
                        if let Some(c) = coins {
                            t.push_str(" You have ");
                            t.push_str(&coin_label(c));
                            t.push_str(" now.");
                        }
                        x.thanks = Some((d.ixn.clone(), t));
                    }
                    Err(e) if current => {
                        x.step = Step::Failed {
                            message: refusal(&e, a.cost, coins),
                            retry: false,
                        }
                    }
                    Err(_) => {}
                }
            });
            if done && current {
                self.open.set(false);
            }
        });
    }
}

/// A card's form: what the user has picked and typed so far.
struct Card {
    ixn: Interaction,
    pick: Option<String>,
    custom: String,
    count: String,
    err: String,
}

#[component]
fn InteractionCard(interaction: Interaction, spend: Spend) -> impl IntoView {
    let auth = use_auth();
    let is_vote = interaction.interaction_type == InteractionType::Vote;
    let id = interaction.id.clone();
    let title = interaction.title.clone();
    let description = interaction.description.clone().unwrap_or_default();
    let rules = interaction.rules.clone().unwrap_or_default();
    let current = interaction.current_bid;
    let mut lines = Vec::new();
    let mut options = Vec::new();
    if is_vote {
        lines.push(match interaction.vote_cost {
            Some(cost) => "Cost: ".to_string() + &coin_label(cost) + " per vote",
            None => "Cost: Price not set".into(),
        });
        options = interaction
            .options
            .iter()
            .flatten()
            .map(|o| (o.id.clone(), option_label(o)))
            .collect();
        if let Some(cost) = interaction.custom_request_cost {
            lines.push("Custom request: ".to_string() + &coin_label(cost));
            // An empty id stands for a custom request (option ids are never empty).
            options.push((String::new(), "Your own snack idea".into()));
        }
    } else {
        lines.push(match current {
            Some(value) => "Current top bid: ".to_string() + &coin_label(value),
            None => "Current top bid: No bids yet".into(),
        });
        if current.is_some() {
            lines.push("Minimum next bid: ".to_string() + &coin_label(coin_min(current)));
        }
    }
    let first = if is_vote {
        "1".to_string()
    } else {
        coin_min(current).to_string()
    };
    let card = RwSignal::new(Card {
        ixn: interaction,
        pick: None,
        custom: String::new(),
        count: first.clone(),
        err: String::new(),
    });

    let press = move |_| {
        let (i, d) = card.with_untracked(|c| {
            (
                c.ixn.clone(),
                Draft {
                    ixn: c.ixn.id.clone(),
                    vote: is_vote,
                    option: c.pick.clone().unwrap_or_default(),
                    custom: c.custom.clone(),
                    count: c.count.trim().parse().unwrap_or(0),
                },
            )
        });
        let r = if is_vote && card.with_untracked(|c| c.pick.is_none()) {
            Err("Pick a snack first.".into())
        } else if auth.signed_in() {
            spend.ask(auth, &i, d)
        } else {
            price(&i, &d).map(|_| {
                auth.sign_in_then(
                    &("/play?capy=".to_string() + &i.capybara_id),
                    PendingAction {
                        kind: if is_vote { "vote" } else { "bid" }.into(),
                        data: d.encode(),
                    },
                )
            })
        };
        card.update(|c| c.err = r.err().unwrap_or_default());
    };
    let ready = move || auth.ready();
    let name = id.clone();
    // The card's error names what to fix; the fields and the button point at it, so a screen
    // reader reads it again on the way back to them.
    let err_id = "err-".to_string() + &id;
    let (idea_err, count_err, button_err) = (err_id.clone(), err_id.clone(), err_id.clone());

    view! {
        <article class="card play-card" data-testid=if is_vote { "vote-card" } else { "bid-card" }>
            <h2>{title}</h2>
            <p>{description}</p>
            {lines.into_iter().map(|l| view! { <p class="play-cost">{l}</p> }).collect_view()}
            // The radios and inputs are always built and shown by CSS once a pool is configured
            // (`.pickable`, `.play-act[hidden]`): structural reactivity costs rebuild code. Only
            // the button is left out entirely until then.
            {(!options.is_empty()).then(|| view! {
                <ul class="play-options" class:pickable=ready aria-label="Vote options">
                    {options.into_iter().map(|(value, label)| {
                        let custom = value.is_empty();
                        view! {
                            <li>
                                <label>
                                    <input type="radio" name=name.clone()
                                        on:change=move |_| card.update_untracked(|c| c.pick = Some(value.clone()))/>
                                    <span>{label}</span>
                                </label>
                                {custom.then(|| view! {
                                    <input class="play-input play-idea" type="text" maxlength="60" aria-label="Your snack idea"
                                        aria-describedby=idea_err.clone()
                                        on:input=move |ev| card.update_untracked(|c| c.custom = event_target_value(&ev))/>
                                })}
                            </li>
                        }
                    }).collect_view()}
                </ul>
            })}
            <div class="play-act" hidden=move || !ready()>
                <label class="play-field">
                    {if is_vote { "Votes" } else { "Your bid" }}
                    <input class="play-input" type="number" inputmode="numeric" min="1"
                        max=if is_vote { MAX_VOTES } else { MAX_BID } value=first aria-describedby=count_err
                        on:input=move |ev| card.update_untracked(|c| c.count = event_target_value(&ev))/>
                </label>
                {move || ready().then(|| view! {
                    <button type="button" class="btn" data-testid=if is_vote { "vote" } else { "bid" }
                        aria-describedby=button_err.clone() on:click=press>{if is_vote { "Vote" } else { "Bid" }}</button>
                })}
            </div>
            <p class="play-hint">
                {move || if ready() && !auth.signed_in() { "You'll sign in first, then confirm." } else { "" }}
            </p>
            <p class="play-err" role="alert" id=err_id>{move || card.with(|c| c.err.clone())}</p>
            <p class="notice play-thanks" role="status" data-testid="thanks">
                {move || spend.dlg.with(|d| {
                    d.thanks.as_ref().filter(|(i, _)| *i == id).map(|(_, t)| t.clone()).unwrap_or_default()
                })}
            </p>
            <h3>"Rules"</h3>
            <ul class="play-rules">
                {rules.into_iter().map(|rule| view! { <li>{rule}</li> }).collect_view()}
            </ul>
        </article>
    }
}

/// The cost and the balance before and after, one per line (`white-space: pre-line`).
fn summary(a: &Ask, coins: Option<u64>) -> String {
    let mut s = "Cost: ".to_string() + &coin_label(a.cost);
    if let Some(b) = coins {
        s.push_str("\nYour balance: ");
        s.push_str(&coin_label(b));
        s.push_str("\nAfter: ");
        s.push_str(&match b.checked_sub(a.cost) {
            Some(left) => coin_label(left),
            None => "not enough play coins".into(),
        });
    }
    s
}

fn ask_line(d: &Dlg, coins: Option<u64>, f: fn(&Ask, Option<u64>) -> String) -> String {
    d.ask.as_ref().map(|a| f(a, coins)).unwrap_or_default()
}

/// Confirm shows once the balance is known and covers the cost, and not after a refusal.
fn can_confirm(d: &Dlg, coins: Option<u64>) -> bool {
    d.ask.as_ref().zip(coins).is_some_and(|(a, b)| b >= a.cost)
        && !matches!(d.step, Step::Failed { retry: false, .. })
}

/// The confirm dialog: what the action does, its cost, the balance before and after.
fn confirm_dialog(spend: Spend, auth: Auth) -> impl IntoView {
    let t = move |f| spend.text(f);
    view! {
        <Modal open=spend.open id="play-confirm" title="Check and confirm" close_label="Cancel"
            actions=Box::new(move || view! {
                // No Confirm button at all until a user pool is configured.
                {move || auth.ready().then(|| view! {
                    <button type="button" class="btn btn-small" data-testid="confirm"
                        hidden=move || !spend.dlg.with(|d| can_confirm(d, spend.session.coins.get()))
                        disabled=move || spend.dlg.with(|d| d.step == Step::Busy)
                        on:click=move |_| spend.confirm(auth)>
                        {t(|d, _| match d.step {
                            Step::Busy => "Sending…",
                            Step::Failed { .. } => "Try again",
                            Step::Ready => "Confirm",
                        }.into())}
                    </button>
                })}
            }.into_any())>
            <p data-testid="confirm-what">{t(|d, c| ask_line(d, c, |a, _| a.what.clone()))}</p>
            <p class="play-sum" data-testid="confirm-sum">{t(|d, c| ask_line(d, c, summary))}</p>
            <p class="play-hint" role="status" hidden=move || spend.session.coins.get().is_some()>
                {move || if spend.session.coins_failed.get() {
                    "Could not load your play coins. Check your connection and try again."
                } else {
                    "Loading your play coins…"
                }}
            </p>
            <button type="button" class="btn btn-small" data-testid="balance-retry"
                hidden=move || spend.session.coins.get().is_some() || !spend.session.coins_failed.get()
                on:click=move |_| {
                    spawn_local(async move { balance(auth, spend.session).await; });
                }>"Check again"</button>
            <p class="play-hint">{t(|d, c| ask_line(d, c, |a, _| if a.draft.vote {
                String::new()
            } else {
                "If someone outbids you, these play coins come back to you.".into()
            }))}</p>
            <p class="play-err" role="alert">{t(|d, _| match &d.step {
                Step::Failed { message, .. } => message.clone(),
                _ => String::new(),
            })}</p>
        </Modal>
    }
}

/// One comparator for both sorts, so the sort is compiled once.
fn by_name(a: &Capybara, b: &Capybara) -> std::cmp::Ordering {
    a.name.cmp(&b.name)
}

/// An assistant's vote or bid (WebMCP, feature `webmcp`). It takes the same path as an action
/// kept across a sign-in, so it opens this page's own confirm dialog, and how that dialog closes
/// is the answer. Nothing is spent without the person's Confirm.
#[cfg(feature = "webmcp")]
#[derive(Clone, Copy)]
struct Assistant {
    asks: crate::webmcp::Asks,
    /// The ask this page is handling, with its action.
    mine: RwSignal<Option<(u32, Draft)>>,
}

#[cfg(feature = "webmcp")]
impl Assistant {
    fn new(spend: Spend, wake: RwSignal<u32>) -> Option<Self> {
        use crate::webmcp::Want;
        let asks = crate::webmcp::use_asks()?;
        let query = use_query_map();
        let me = Assistant {
            asks,
            mine: RwSignal::new(None),
        };
        // A new ask for this page: into the waiting slot, where the confirm step opens from. Only
        // once the address shows its capybara: the tool's navigation lands a moment after it asks.
        Effect::new(move |_| {
            let here = query.with(|q| q.get("capy"));
            let Some((id, d)) = asks.take(|w| match w {
                Want::Vote { capybara, .. } | Want::Bid { capybara, .. }
                    if here.as_ref() != Some(capybara) =>
                {
                    None
                }
                Want::Vote {
                    interaction,
                    option,
                    idea,
                    votes,
                    ..
                } => Some(Draft {
                    ixn: interaction.clone(),
                    vote: true,
                    option: option.clone(),
                    custom: idea.clone(),
                    count: *votes,
                }),
                Want::Bid {
                    interaction,
                    amount,
                    ..
                } => Some(Draft {
                    ixn: interaction.clone(),
                    vote: false,
                    option: String::new(),
                    custom: String::new(),
                    count: *amount,
                }),
                _ => None,
            }) else {
                return;
            };
            me.drop("A newer request replaced this one. Nothing was spent.");
            me.mine.set(Some((id, d.clone())));
            spend.dlg.update_untracked(|x| x.waiting = Some(d));
            wake.update(|n| *n = n.wrapping_add(1));
        });
        // How the dialog closes is the answer.
        Effect::new(move |was: Option<bool>| {
            let open = spend.open.get();
            if was == Some(true) && !open {
                if let Some((id, d)) = me.mine.get_untracked() {
                    let r = spend.dlg.with_untracked(|x| {
                        let shown = x.ask.as_ref().is_some_and(|a| a.draft == d);
                        match (&x.thanks, &x.step) {
                            _ if !shown => Err("The person chose another action. Nothing was \
                                                spent for this request."
                                .to_string()),
                            (Some((ixn, t)), _) if *ixn == d.ixn => {
                                Ok(format!("The person pressed Confirm. {t}"))
                            }
                            (_, Step::Failed { message, .. }) => Err(message.clone()),
                            _ => Err("The person closed the confirm step without confirming. \
                                      Nothing was spent."
                                .to_string()),
                        }
                    });
                    me.mine.set(None);
                    asks.answer(id, r);
                }
            }
            open
        });
        // Withdrawn by the assistant: its dialog closes, unless Confirm is already on its way.
        Effect::new(move |_| {
            let Some((id, d)) = me.mine.get() else {
                return;
            };
            if asks.is_open(id) {
                return;
            }
            me.mine.set(None);
            spend.dlg.update_untracked(|x| {
                if x.waiting.as_ref() == Some(&d) {
                    x.waiting = None;
                }
            });
            let showing = spend.dlg.with_untracked(|x| {
                x.ask.as_ref().is_some_and(|a| a.draft == d) && x.step != Step::Busy
            });
            if showing {
                spend.open.set(false);
            }
        });
        on_cleanup(move || me.drop("The page was left before Confirm. Nothing was spent."));
        Some(me)
    }

    /// The ask's action cannot be done (priced wrongly, or no longer open).
    fn refused(self, d: &Draft, why: &str) {
        if self
            .mine
            .with_untracked(|m| m.as_ref().is_some_and(|(_, x)| x == d))
        {
            let mut why = why.to_string();
            why.push_str(" Nothing was spent.");
            self.drop(&why);
        }
    }

    fn drop(self, why: &str) {
        if let Some((id, _)) = self.mine.try_get_untracked().flatten() {
            let _ = self.mine.try_set(None);
            self.asks.answer(id, Err(why.to_string()));
        }
    }
}

#[component]
pub fn Play() -> impl IntoView {
    let auth = use_auth();
    let toasts = use_toasts();
    let query = use_query_map();
    let navigate = use_navigate();
    let capybaras = LocalResource::new(|| api::list_capybaras(Paging::default(), None));
    let selected_capy = Memo::new(move |_| {
        let query_capy = query.with(|q| q.get("capy").filter(|value| !value.is_empty()));
        let mut cast = capybaras.get().and_then(Result::ok)?.items;
        cast.sort_by(by_name);
        if let Some(capy) = query_capy {
            if cast.iter().any(|item| item.id == capy) {
                return Some(capy);
            }
        }
        cast.first().map(|capy| capy.id.clone())
    });
    let interactions: Interactions = LocalResource::new(move || {
        let capy = selected_capy.get();
        async move {
            if let Some(capy) = capy {
                api::list_interactions(&capy, None, Paging::default(), None).await
            } else {
                Ok(Page {
                    items: Vec::new(),
                    count: 0,
                    cursor: None,
                    truncated: false,
                    hint: None,
                })
            }
        }
    });
    // Back from signing in: the action that sent the user away, reopened at its confirm step
    // once its interaction has loaded.
    let waiting = [("vote", true), ("bid", false)]
        .into_iter()
        .find_map(|(kind, vote)| Draft::decode(vote, &auth.take_pending(kind)?));
    let spend = Spend {
        open: RwSignal::new(false),
        dlg: RwSignal::new(Dlg {
            waiting,
            ..Default::default()
        }),
        reload: interactions,
        session: use_session(),
    };
    // Rung when an action arrives after the page has loaded (an assistant's, WebMCP).
    let wake = RwSignal::new(0u32);
    #[cfg(feature = "webmcp")]
    let assistant = Assistant::new(spend, wake);
    Effect::new(move |_| {
        wake.track();
        let Some(Ok(page)) = interactions.get() else {
            return;
        };
        let Some(d) = spend.dlg.with_untracked(|x| x.waiting.clone()) else {
            return;
        };
        let found = page.items.iter().find(|i| i.id == d.ixn);
        let gone = page
            .items
            .first()
            .is_some_and(|i| Some(&i.capybara_id) == selected_capy.get_untracked().as_ref());
        if found.is_some() || gone {
            spend.dlg.update_untracked(|x| x.waiting = None);
        }
        let r = match found {
            Some(i) => spend.ask(auth, i, d.clone()),
            None if gone => Err("That vote or bid is no longer open.".into()),
            None => Ok(()),
        };
        if let Err(e) = r {
            #[cfg(feature = "webmcp")]
            if let Some(a) = assistant {
                a.refused(&d, &e);
            }
            toasts.show(e);
        }
    });

    view! {
        <PageHead
            title="Play"
            eyebrow="Play coins only"
            lede="Choose a capybara, then vote on snacks or bid with play coins."
        />
        <p class="notice" data-testid="play-soon" hidden=move || auth.ready()>"Voting and bidding open soon."</p>
        <Suspense fallback=|| view! { <p role="status">"Loading capybaras…"</p> }>
            {move || capybaras.get().map(|result| match result {
                Err(_) => view! { <p class="notice" role="alert">"Could not load capybaras right now."</p> }.into_any(),
                Ok(page) => {
                    let mut cast = page.items;
                    cast.sort_by(by_name);
                    view! {
                        <section aria-labelledby="play-capy-picker">
                            <h2 id="play-capy-picker">"Choose your capybara"</h2>
                            <div class="play-picker" role="group" aria-label="Choose a capybara">
                                {cast.into_iter().map(|capy| {
                                    let pressed_id = capy.id.clone();
                                    let nav_id = capy.id;
                                    let go = navigate.clone();
                                    view! {
                                        <button
                                            type="button"
                                            class="play-picker-btn"
                                            // A bool attribute renders as "" or nothing, which reads as
                                            // neither pressed nor not: aria-pressed needs the words. It
                                            // also styles the chosen one (play-profile.css).
                                            aria-pressed=move || if selected_capy.get().as_deref() == Some(pressed_id.as_str()) { "true" } else { "false" }
                                            on:click=move |_| {
                                                let next = "/play?capy=".to_string() + &nav_id;
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
                    // A keyed list builds each card once; it never rebuilds one in place, so no
                    // rebuild code is generated for the card's view.
                    let items = page.items;
                    view! {
                        <div class="play-stack" data-testid="play-grid">
                            <For each=move || items.clone() key=|i| i.id.clone() let:item>
                                <InteractionCard interaction=item spend=spend/>
                            </For>
                        </div>
                    }.into_any()
                }
            })}
        </Suspense>
        {confirm_dialog(spend, auth)}
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ixn(json: &str) -> Interaction {
        serde_json::from_str(json).unwrap()
    }

    fn vote_ixn() -> Interaction {
        ixn(
            r#"{"id":"v1","capybara_id":"magnus","interaction_type":"vote","title":"Pick a snack",
            "vote_cost":2,"custom_request_cost":5,"options":[{"id":"carrots","title":"Carrots"}]}"#,
        )
    }

    fn draft(option: &str, custom: &str, count: u64, vote: bool) -> Draft {
        Draft {
            ixn: "v1".into(),
            vote,
            option: option.into(),
            custom: custom.into(),
            count,
        }
    }

    #[test]
    fn votes_are_priced_from_the_interaction() {
        let i = vote_ixn();
        assert_eq!(
            price(&i, &draft("carrots", "", 3, true)).unwrap(),
            (
                6,
                "3 votes for Carrots in \u{201c}Pick a snack\u{201d}.".into()
            )
        );
        assert_eq!(price(&i, &draft("", " Mango ", 1, true)).unwrap().0, 7);
        assert!(price(&i, &draft("carrots", "", 0, true)).is_err());
        assert!(price(&i, &draft("carrots", "", 11, true)).is_err());
        assert!(price(&i, &draft("kale", "", 1, true)).is_err());
        assert!(price(&i, &draft("", "  ", 1, true)).is_err());
        assert!(price(&i, &draft("", &"x".repeat(61), 1, true)).is_err());
        let unpriced =
            ixn(r#"{"id":"v1","capybara_id":"m","interaction_type":"vote","title":"T"}"#);
        assert!(price(&unpriced, &draft("carrots", "", 1, true)).is_err());
    }

    #[test]
    fn bids_must_beat_the_current_bid() {
        let i = ixn(
            r#"{"id":"b1","capybara_id":"elon","interaction_type":"bid","title":"Hold","current_bid":20}"#,
        );
        assert_eq!(price(&i, &draft("", "", 21, false)).unwrap().0, 21);
        assert_eq!(
            price(&i, &draft("", "", 20, false)).unwrap_err(),
            "Bid at least 21 play coins."
        );
        assert!(price(&i, &draft("", "", MAX_BID + 1, false)).is_err());
    }

    #[test]
    fn drafts_survive_the_sign_in_round_trip() {
        let d = draft("", "Mango \"please\"", 2, true);
        let data = d.encode();
        assert!(!data.contains('\n'));
        assert_eq!(Draft::decode(true, &data), Some(d));
        assert_eq!(Draft::decode(false, "nonsense"), None);
    }

    #[test]
    fn refusals_are_plain() {
        let e = |code: &str, message: &str| CodedError {
            code: Some(code.into()),
            error: ApiError {
                status: 409,
                url: String::new(),
                message: message.into(),
                code: code.into(),
            },
        };
        assert_eq!(
            refusal(&e("insufficient_coins", "not enough coins"), 12, Some(5)),
            "Not enough play coins: this costs 12 play coins and you have 5 play coins. Nothing was spent."
        );
        assert_eq!(
            refusal(&e("bid_too_low", "a bid must be at least 22"), 21, None),
            "Someone bid higher. The minimum is now 22 play coins. Nothing was spent."
        );
        assert_eq!(
            refusal(
                &e("interaction_closed", "this interaction is closed"),
                1,
                None
            ),
            "This has closed. Nothing was spent."
        );
    }
}
