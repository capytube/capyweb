//! Tools that spend play coins or post as the person. None of them acts by itself: each hands its
//! action to the page that owns it (an `Ask`), which shows its own confirm step, and the tool's
//! promise settles only with the person's answer there: done after their click, or refused when
//! they cancel, leave, or the assistant withdraws the call. Nothing is sent without the click.
//!
//! - `cast_vote`, `place_bid`: the Play page's confirm dialog (cost, balance before and after),
//!   through the same path as an action kept across sign-in.
//! - `send_chat`, `react`: a request bar above the chat that shows exactly what would be posted.
//!   Reactions are not rate-limited per user, so they get the confirm too (hm-auue condition 4).
//!
//! No tool buys paid-camera time, and there is no `claim_pass`: the shop has no claiming route,
//! and no tool offers what the page does not (capyweb-manager, hm-auue).

use js_sys::{Function, Promise, Reflect};
use leptos::prelude::*;
use leptos::task::spawn_local;
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;

use super::{str_arg, text_result, Ctx, Hint, Tool};
use crate::api;

/// What an assistant asked for.
#[derive(Clone)]
pub enum Want {
    /// `option` is empty for a snack idea of the person's own (`idea`).
    Vote {
        capybara: String,
        interaction: String,
        option: String,
        idea: String,
        votes: u64,
    },
    Bid {
        capybara: String,
        interaction: String,
        amount: u64,
    },
    Chat {
        stream: String,
        text: String,
    },
    React {
        stream: String,
        reaction: String,
    },
}

/// Asks waiting for the person, provided by the app shell. The page that owns an ask takes it and
/// answers it once; a later answer to the same ask is ignored.
#[derive(Clone, Copy)]
pub struct Asks {
    /// The newest ask, until its page takes it.
    new: RwSignal<Option<(u32, Want)>>,
    /// Asks not answered yet. An ask leaves when it is answered or withdrawn.
    open: RwSignal<Vec<u32>>,
    settle: StoredValue<Vec<(u32, Function, Function)>, LocalStorage>,
    next: StoredValue<u32>,
}

impl Default for Asks {
    fn default() -> Self {
        Asks {
            new: RwSignal::new(None),
            open: RwSignal::new(Vec::new()),
            settle: StoredValue::new_local(Vec::new()),
            next: StoredValue::new(0),
        }
    }
}

impl Asks {
    /// Hand `want` to its page. The promise settles with the person's answer. Aborting the
    /// call's `signal` withdraws the ask.
    fn ask(self, want: Want, signal: Option<web_sys::AbortSignal>) -> Promise {
        self.next.update_value(|n| *n += 1);
        let id = self.next.get_value();
        let promise = Promise::new(&mut |resolve, reject| {
            self.settle.update_value(|v| v.push((id, resolve, reject)));
        });
        // One ask at a time: one that no page took yet is replaced.
        if let Some((old, _)) = self.new.get_untracked() {
            self.answer(
                old,
                Err("A newer request replaced this one. Nothing was sent.".into()),
            );
        }
        self.open.update(|v| v.push(id));
        self.new.set(Some((id, want)));
        if let Some(signal) = signal {
            let withdraw = Closure::once_into_js(move || {
                self.answer(
                    id,
                    Err("The assistant withdrew the request. Nothing was sent.".into()),
                )
            });
            let _ = signal.add_event_listener_with_callback("abort", withdraw.unchecked_ref());
        }
        promise
    }

    /// Take the newest ask if this page owns it (`owns` returns what the page needs from it).
    /// Reactive: an Effect that calls this runs again when a new ask comes.
    pub fn take<T>(self, owns: impl Fn(&Want) -> Option<T>) -> Option<(u32, T)> {
        let mine = self
            .new
            .with(|n| n.as_ref().and_then(|(id, w)| owns(w).map(|t| (*id, t))))?;
        self.new.set(None);
        Some(mine)
    }

    /// Whether the ask is still waiting for an answer. Reactive.
    pub fn is_open(self, id: u32) -> bool {
        self.open.with(|v| v.contains(&id))
    }

    /// The person's answer, or why there is none.
    pub fn answer(self, id: u32, r: Result<String, String>) {
        let Some((_, resolve, reject)) = self
            .settle
            .try_update_value(|v| v.iter().position(|s| s.0 == id).map(|i| v.remove(i)))
            .flatten()
        else {
            return;
        };
        self.open.update(|v| v.retain(|i| *i != id));
        let _ = match r {
            Ok(text) => resolve.call1(&JsValue::NULL, &text_result(text)),
            Err(why) => reject.call1(&JsValue::NULL, &JsValue::from_str(&why)),
        };
    }
}

pub fn use_asks() -> Option<Asks> {
    use_context::<Asks>()
}

/// An input schema, written as JSON text: smaller in the wasm than building it with `json!`.
fn schema(text: &str) -> serde_json::Value {
    serde_json::from_str(text).unwrap_or_default()
}

/// Close any other dialog the person has open, so the page's own confirm step (or the chat bar) is
/// the one thing asking: two modal dialogs at once confuse, and an open modal leaves the page behind
/// it inert (review rv-1790688216-35710). Nothing spends on close. Play's own confirm dialog stays:
/// an assistant's ask takes it over in place.
fn close_other_dialogs() {
    let Some(doc) = web_sys::window().and_then(|w| w.document()) else {
        return;
    };
    let Ok(open) = doc.query_selector_all("dialog[open]:not(#play-confirm)") else {
        return;
    };
    for i in 0..open.length() {
        if let Some(d) = open
            .item(i)
            .and_then(|n| n.dyn_into::<web_sys::HtmlDialogElement>().ok())
        {
            d.close();
        }
    }
}

/// A whole number argument within `range`.
fn count_arg(input: &JsValue, key: &str, range: std::ops::RangeInclusive<u64>) -> Option<u64> {
    let n = Reflect::get(input, &key.into()).ok()?.as_f64()?;
    let n = (n.fract() == 0.0 && n >= 0.0 && n <= u32::MAX as f64).then_some(n as u64)?;
    range.contains(&n).then_some(n)
}

fn id_arg(input: &JsValue, key: &str) -> Result<String, String> {
    let id = str_arg(input, key).unwrap_or_default();
    api::validate_id(&id).map_err(|_| format!("{key}: not a valid id"))?;
    Ok(id)
}

fn refuse(why: String) -> Promise {
    Promise::reject(&JsValue::from_str(&why))
}

/// A spending tool's description, with what the person sees and must do.
macro_rules! spends {
    ($what:literal) => {
        concat!(
            $what,
            " The site shows its own confirm step with the cost, and the person must press \
             Confirm there. The call finishes with the result after that click, or fails if \
             they cancel. Nothing is spent without their click."
        )
    };
}

/// Registered while the person is signed in.
pub(super) fn tools(ctx: Ctx) -> Vec<Tool> {
    let Some(asks) = use_asks() else {
        return Vec::new();
    };
    let (c1, c2, c3) = (ctx.clone(), ctx.clone(), ctx.clone());
    vec![
        Tool {
            name: "cast_vote",
            title: "Vote on a capybara's snack",
            description: spends!(
                "Vote with play coins on an open snack vote (ids from get_interactions): an \
                 option, or the person's own snack idea (at most 60 characters). 1 to 10 votes."
            ),
            schema: schema(
                r#"{"type":"object","properties":{
                "capybara":{"type":"string","description":"The capybara's id"},
                "interaction":{"type":"string","description":"The vote's id"},
                "option":{"type":"string","description":"An option's id; leave out for an idea"},
                "idea":{"type":"string","maxLength":60,"description":"A snack idea instead of an option"},
                "votes":{"type":"integer","minimum":1,"maximum":10}},
                "required":["capybara","interaction","votes"]}"#,
            ),
            hint: Hint::Consequential,
            run: Box::new(move |input, signal| {
                let want = (|| {
                    let capybara = id_arg(&input, "capybara")?;
                    let interaction = id_arg(&input, "interaction")?;
                    let votes = count_arg(&input, "votes", 1..=10).ok_or("votes: 1 to 10")?;
                    let idea = str_arg(&input, "idea").unwrap_or_default();
                    let option = match str_arg(&input, "option") {
                        Some(_) if !idea.is_empty() => Err("give an option or an idea, not both")?,
                        Some(_) => id_arg(&input, "option")?,
                        None if idea.trim().is_empty() => Err("give an option or an idea")?,
                        None if idea.trim().chars().count() > 60 => {
                            Err("idea: at most 60 characters")?
                        }
                        None => String::new(),
                    };
                    Ok::<_, String>(Want::Vote {
                        capybara,
                        interaction,
                        option,
                        idea,
                        votes,
                    })
                })();
                match want {
                    Ok(want) => {
                        close_other_dialogs();
                        c1.go(&play_path(&want), "Play");
                        asks.ask(want, signal)
                    }
                    Err(why) => refuse(why),
                }
            }),
        },
        Tool {
            name: "place_bid",
            title: "Bid on a capybara's climbing hold",
            description: spends!(
                "Bid play coins on an open bid (ids from get_interactions). The amount is the \
                 whole bid, in play coins."
            ),
            schema: schema(
                r#"{"type":"object","properties":{
                "capybara":{"type":"string","description":"The capybara's id"},
                "interaction":{"type":"string","description":"The bid's id"},
                "amount":{"type":"integer","minimum":1,"maximum":1000000}},
                "required":["capybara","interaction","amount"]}"#,
            ),
            hint: Hint::Consequential,
            run: Box::new(move |input, signal| {
                let want = (|| {
                    let capybara = id_arg(&input, "capybara")?;
                    let interaction = id_arg(&input, "interaction")?;
                    let amount =
                        count_arg(&input, "amount", 1..=1_000_000).ok_or("amount: 1 to 1000000")?;
                    Ok::<_, String>(Want::Bid {
                        capybara,
                        interaction,
                        amount,
                    })
                })();
                match want {
                    Ok(want) => {
                        close_other_dialogs();
                        c2.go(&play_path(&want), "Play");
                        asks.ask(want, signal)
                    }
                    Err(why) => refuse(why),
                }
            }),
        },
        post_tool(
            c3.clone(),
            asks,
            "send_chat",
            "Post in a camera's chat",
            "Post a chat message as the person, on a public camera (ids from list_streams): 1 to \
             280 characters. The site shows the exact text above the chat, and the person must \
             press Post there. The call finishes after that click, or fails if they cancel.",
            r#"{"type":"object","properties":{
            "stream":{"type":"string","description":"A public camera's id"},
            "text":{"type":"string","maxLength":280,"description":"The message"}},
            "required":["stream","text"]}"#,
            "text",
        ),
        post_tool(
            c3,
            asks,
            "react",
            "React on a camera",
            "Send a reaction as the person, on a public camera (ids from list_streams). The site \
             shows it above the chat, and the person must press Post there. The call finishes \
             after that click, or fails if they cancel.",
            r#"{"type":"object","properties":{
            "stream":{"type":"string","description":"A public camera's id"},
            "reaction":{"type":"string","enum":["capylove","capylike","capywow","capyangry","capyfire"]}},
            "required":["stream","reaction"]}"#,
            "reaction",
        ),
    ]
}

/// The Play page for a vote's or bid's capybara. Play takes the ask only once its address shows
/// that capybara: the router applies a navigation a moment after `go`.
fn play_path(want: &Want) -> String {
    match want {
        Want::Vote { capybara, .. } | Want::Bid { capybara, .. } => {
            format!("/play?capy={capybara}")
        }
        _ => "/play".into(),
    }
}

/// `send_chat` or `react`: the stream's watch room, then its request bar.
#[allow(clippy::too_many_arguments)]
fn post_tool(
    ctx: Ctx,
    asks: Asks,
    name: &'static str,
    title: &'static str,
    description: &'static str,
    input: &'static str,
    key: &'static str,
) -> Tool {
    Tool {
        name,
        title,
        description,
        schema: schema(input),
        hint: Hint::Consequential,
        run: Box::new(move |input, signal| {
            let stream = match id_arg(&input, "stream") {
                Ok(s) => s,
                Err(why) => return refuse(why),
            };
            let value = str_arg(&input, key).unwrap_or_default();
            let want = if key == "text" {
                if api::check_chat_text(&value).is_err() {
                    return refuse("text: 1 to 280 characters".into());
                }
                Want::Chat {
                    stream: stream.clone(),
                    text: value,
                }
            } else {
                if !api::known_reaction(&value) {
                    return refuse("reaction: not one of the five".into());
                }
                Want::React {
                    stream: stream.clone(),
                    reaction: value,
                }
            };
            let ctx = ctx.clone();
            let (promise, done) = deferred();
            spawn_local(async move {
                // Chat is only on public cameras; its watch room is its capybara's.
                let room = match api::get_stream(&stream, None).await {
                    Ok(Some(s)) if s.is_public() => s.capybara_ids.first().cloned(),
                    _ => None,
                };
                let Some(capy) = room else {
                    done(Err("stream: not a public camera".into()));
                    return;
                };
                close_other_dialogs();
                ctx.go(
                    &crate::pages::watch_room::cam_href(&capy, &stream),
                    "the watch room",
                );
                let asked = asks.ask(want, signal);
                let r = wasm_bindgen_futures::JsFuture::from(asked).await;
                done(r.map_err(|e| e.as_string().unwrap_or_default()));
            });
            promise
        }),
    }
}

/// A promise and the function that settles it (with a tool result, or a refusal).
fn deferred() -> (Promise, impl FnOnce(Result<JsValue, String>)) {
    let mut settle = None;
    let promise = Promise::new(&mut |resolve, reject| settle = Some((resolve, reject)));
    let (resolve, reject) = settle.expect("Promise::new runs its executor at once");
    (promise, move |r: Result<JsValue, String>| {
        let _ = match r {
            Ok(v) => resolve.call1(&JsValue::NULL, &v),
            Err(why) => reject.call1(&JsValue::NULL, &JsValue::from_str(&why)),
        };
    })
}

/// The request bar above a camera's chat: an assistant's message or reaction, posted only when
/// the person presses Post.
pub fn chat_asks(stream: String) -> impl IntoView {
    let Some(asks) = use_asks() else {
        return ().into_any();
    };
    let auth = crate::auth::use_auth();
    let shown = RwSignal::new(None::<(u32, Want)>);
    let busy = RwSignal::new(false);
    let note = RwSignal::new(String::new());
    let here = stream.clone();
    Effect::new(move |_| {
        let Some((id, want)) = asks.take(|w| match w {
            Want::Chat { stream, .. } | Want::React { stream, .. } if *stream == here => {
                Some(w.clone())
            }
            _ => None,
        }) else {
            return;
        };
        if let Some((old, _)) = shown.get_untracked() {
            asks.answer(
                old,
                Err("A newer request replaced this one. Nothing was sent.".into()),
            );
        }
        note.set(String::new());
        shown.set(Some((id, want)));
    });
    // Withdrawn by the assistant: the bar goes.
    Effect::new(move |_| {
        if let Some((id, _)) = shown.get() {
            if !asks.is_open(id) && !busy.get_untracked() {
                shown.set(None);
            }
        }
    });
    on_cleanup(move || {
        if let Some((id, _)) = shown.try_get_untracked().flatten() {
            asks.answer(
                id,
                Err("The page was left before Post. Nothing was sent.".into()),
            );
        }
    });
    let cancel = move |_| {
        if let Some((id, _)) = shown.get_untracked() {
            asks.answer(id, Err("The person cancelled. Nothing was sent.".into()));
        }
        shown.set(None);
    };
    let post = move |_| {
        let Some((id, want)) = shown.get_untracked() else {
            return;
        };
        if busy.get_untracked() {
            return;
        }
        busy.set(true);
        spawn_local(async move {
            let sent = match &want {
                Want::Chat { stream, text } => api::post_chat_json(auth, stream, text, None).await,
                Want::React { stream, reaction } => {
                    api::post_reaction_json(auth, stream, reaction, None).await
                }
                _ => return,
            };
            busy.set(false);
            match sent {
                Ok(_) => {
                    asks.answer(id, Ok("The person pressed Post. Posted.".into()));
                    shown.set(None);
                }
                Err(e) => {
                    let why = if e.code == "slow_down" {
                        "One message every 2 seconds. Nothing was sent.".to_string()
                    } else {
                        format!("Not posted: {e}")
                    };
                    note.set(why.clone());
                    asks.answer(id, Err(why));
                    shown.set(None);
                }
            }
        });
    };
    view! {
        <p class="agent-note" role="status">{move || note.get()}</p>
        {move || shown.get().map(|(_, want)| {
            let (lead, what) = match want {
                Want::Chat { text, .. } => ("An assistant asks to post this message:", text),
                Want::React { reaction, .. } => ("An assistant asks to send this reaction:", reaction),
                _ => ("", String::new()),
            };
            view! {
                <div class="agent-ask" role="group" aria-label="Request from an assistant"
                    data-testid="agent-ask">
                    <p>{lead}</p>
                    <blockquote data-testid="agent-ask-text">{what}</blockquote>
                    <div class="actions">
                        <button type="button" class="btn" data-testid="agent-post"
                            disabled=move || busy.get() on:click=post>"Post"</button>
                        <button type="button" class="btn btn-ghost" data-testid="agent-cancel"
                            disabled=move || busy.get() on:click=cancel>"Cancel"</button>
                    </div>
                </div>
            }
        })}
    }
    .into_any()
}
