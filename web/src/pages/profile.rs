//! Profile page (W8). Signed out: the pitch, and sign-in once a user pool is configured.
//! Signed in: the display name (`PUT /me`), the play-coin balance, and the ledger
//! (`GET /me/transactions`, newest first, "Load more" for older pages).

use leptos::prelude::*;
use leptos::task::spawn_local;

use crate::{
    api::{self, LedgerEntry},
    auth::use_auth,
    pages::play::coin_label,
    state::use_session,
};

/// One route for both states. The heading and the signed-out pitch are always built and only
/// their text or `hidden` changes, which costs less code than switching between two views.
#[component]
pub fn Profile() -> impl IntoView {
    let auth = use_auth();
    crate::set_document_title(&crate::routes::title_for("Profile"));
    let signed_in = move || auth.signed_in();
    view! {
        <header class="mb-6">
            <p class="eyebrow">{move || if signed_in() { "Signed in" } else { "Signed out" }}</p>
            <h1>"Profile"</h1>
            <p class="lede">
                {move || if signed_in() {
                    "Your name, play-coin balance and ledger."
                } else {
                    "Your name, play-coin balance and ledger, in one place once you sign in."
                }}
            </p>
        </header>
        <section class="profile-pitch" aria-labelledby="profile-perks" hidden=signed_in>
            <h2 id="profile-perks">"What you'll do with your profile"</h2>
            <ul class="play-rules">
                <li>"See your display name."</li>
                <li>"Check your play-coin balance."</li>
                <li>"Review your vote and bid ledger."</li>
            </ul>
        </section>
        // Only once a user pool is configured (config.json).
        <div data-slot="sign-in">
            {move || (auth.ready() && !signed_in()).then(|| view! {
                <button type="button" class="btn" data-testid="profile-sign-in"
                    on:click=move |_| auth.sign_in("/profile")>"Sign in"</button>
            })}
        </div>
        {move || signed_in().then(signed_in_view)}
    }
}

/// What a ledger entry was for, in words.
fn entry_label(kind: &str) -> &'static str {
    match kind {
        "signup_grant" => "Welcome grant",
        "vote" => "Snack vote",
        "bid" => "Bid",
        "bid_raise" => "Bid raised",
        "bid_refund" => "Bid returned (outbid)",
        "chat" => "Chat message",
        "reaction" => "Reaction",
        _ => "Other",
    }
}

fn entry_amount(amount: i64) -> String {
    let sign = if amount < 0 { "-" } else { "+" };
    sign.to_string() + &coin_label(amount.unsigned_abs())
}

/// One ledger line: what it was for, the play coins in or out, and the date.
fn entry_line(e: &LedgerEntry) -> String {
    let mut line = entry_label(&e.kind).to_string();
    line.push_str(": ");
    line.push_str(&entry_amount(e.amount));
    line.push_str(", ");
    line.push_str(e.created_at.get(..10).unwrap_or_default());
    line
}

/// A server refusal of a display name, in plain words (the rules are in DATA_MODEL section 6).
fn name_error(message: &str) -> &'static str {
    if message.contains("reserved") {
        "That name is reserved. Please pick another."
    } else {
        "Use 2 to 32 letters or digits, with single spaces, dots, dashes, underscores or apostrophes between them."
    }
}

/// Everything the signed-in view shows, in one signal (each signal type costs code).
#[derive(Default)]
struct Prof {
    /// The name the server has.
    saved: Option<String>,
    /// What is in the field now. The field shows exactly this, so what Save sends is what is on
    /// screen.
    typed: String,
    /// The user has typed in the field: the account loading late must not replace their text.
    touched: bool,
    note: &'static str,
    entries: Vec<LedgerEntry>,
    cursor: Option<String>,
    status: &'static str,
}

const LOADING: &str = "Loading your ledger…";

/// The signed-in sections. Built when the user is signed in, which also loads the account and
/// the first page of the ledger.
fn signed_in_view() -> impl IntoView {
    let auth = use_auth();
    let coins = use_session().coins;
    let p = RwSignal::new(Prof {
        status: LOADING,
        ..Default::default()
    });
    let t = move |f: fn(&Prof) -> String| move || p.with(f);

    spawn_local(async move {
        if let Ok(Some(me)) = api::get_me(auth).await {
            coins.set(me.balance);
            p.update(|s| {
                if !s.touched {
                    s.typed = me.display_name.clone().unwrap_or_default();
                }
                s.saved = me.display_name;
            });
        }
    });
    let load = move || {
        let from = p
            .try_update(|s| {
                s.status = LOADING;
                s.cursor.clone()
            })
            .flatten();
        spawn_local(async move {
            let page = api::list_transactions(auth, from.as_deref()).await;
            p.update(|s| match page {
                Ok(page) => {
                    s.entries.extend(page.items);
                    s.cursor = page.cursor;
                    s.status = "";
                }
                Err(_) => s.status = "Could not load your ledger right now.",
            });
        });
    };
    load();

    let save = move |ev: leptos::ev::SubmitEvent| {
        ev.prevent_default();
        let value = p.with_untracked(|s| s.typed.trim().to_string());
        if !(2..=32).contains(&value.chars().count()) {
            p.update(|s| s.note = "Use 2 to 32 characters.");
            return;
        }
        p.update(|s| s.note = "Saving…");
        spawn_local(async move {
            let r = api::put_me(auth, &value).await;
            if let Ok(me) = &r {
                if me.balance.is_some() {
                    coins.set(me.balance);
                }
            }
            p.update(|s| match r {
                Ok(me) => {
                    s.saved = me.display_name;
                    s.note = "Saved.";
                }
                Err(e) if e.error.status == 400 => s.note = name_error(&e.error.message),
                Err(_) => s.note = "Could not save right now. Please try again.",
            });
        });
    };

    view! {
        <section class="card profile-block" aria-labelledby="profile-name">
            <h2 id="profile-name">"Display name"</h2>
            <p>{t(|s| match &s.saved {
                Some(n) => "Others see you as ".to_string() + n + ".",
                None => "Pick a name others will see.".into(),
            })}</p>
            <form class="play-act" on:submit=save>
                <label class="play-field">
                    "Name"
                    <input class="play-input" type="text" maxlength="32" autocomplete="nickname"
                        data-testid="name-input" aria-describedby="name-note"
                        prop:value=t(|s| s.typed.clone())
                        on:input=move |ev| p.update_untracked(|s| {
                            s.typed = event_target_value(&ev);
                            s.touched = true;
                        })/>
                </label>
                <button type="submit" class="btn">"Save"</button>
            </form>
            // The field points here, so "Use 2 to 32 characters." is read with the field too.
            <p class="play-hint" role="status" id="name-note" data-testid="name-note">{t(|s| s.note.into())}</p>
        </section>
        <section class="card profile-block" aria-labelledby="profile-coins">
            <h2 id="profile-coins">"Play coins"</h2>
            <p class="profile-balance" data-testid="balance">
                {move || coins.get().map_or_else(|| "…".into(), coin_label)}
            </p>
            <p class="play-hint">"Play coins are for votes and bids here. They are not money."</p>
        </section>
        <section class="card profile-block" aria-labelledby="profile-ledger">
            <h2 id="profile-ledger">"Ledger"</h2>
            <ul class="ledger" data-testid="ledger">
                {move || p.with(|s| s.entries.iter().map(|e| view! { <li>{entry_line(e)}</li> }).collect_view())}
            </ul>
            <p role="status">{t(|s| s.status.into())}</p>
            <button type="button" class="btn btn-ghost btn-small" data-testid="load-more"
                hidden=move || p.with(|s| s.cursor.is_none() || !s.status.is_empty())
                on:click=move |_| {
                    // One page at a time, whatever the clicking.
                    if p.with_untracked(|s| s.status.is_empty()) {
                        load()
                    }
                }>"Load more"</button>
        </section>
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ledger_lines_read_plainly() {
        assert_eq!(entry_label("signup_grant"), "Welcome grant");
        assert_eq!(entry_label("something_new"), "Other");
        assert_eq!(entry_amount(50), "+50 play coins");
        assert_eq!(entry_amount(-1), "-1 play coin");
        assert!(name_error("that display_name is reserved").contains("reserved"));
    }
}
