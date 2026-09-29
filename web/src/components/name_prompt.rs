//! Ask once per sign-in, leaving an existing dialog in charge of the page.

use std::time::Duration;

use leptos::prelude::*;
use leptos::task::spawn_local;
use leptos_router::hooks::use_location;

use crate::{
    api,
    auth::{dismiss_name_prompt, name_prompt_dismissed, use_auth},
    components::modal::Modal,
    display_name::{name_error, validate_name},
    oauth::CALLBACK_PATH,
    state::{use_session, use_toasts},
};

#[component]
pub fn NamePrompt() -> impl IntoView {
    let auth = use_auth();
    let session = use_session();
    let toasts = use_toasts();
    let location = use_location();
    let open = RwSignal::new(false);
    let attempted = StoredValue::new(false);
    let typed = RwSignal::new(String::new());
    let note = RwSignal::new("");
    let saving = RwSignal::new(false);

    Effect::new(move |_| {
        if !session.signed_in.get() {
            attempted.set_value(false);
            open.set(false);
            return;
        }
        if !session.needs_name.get() {
            open.set(false);
            return;
        }
        if location.pathname.get().starts_with(CALLBACK_PATH)
            || attempted.get_value()
            || name_prompt_dismissed()
        {
            return;
        }
        attempted.set_value(true);
        // Let the route's effects open any pending confirmation before checking the DOM.
        set_timeout(
            move || {
                if !session.signed_in.get_untracked()
                    || !session.needs_name.get_untracked()
                    || location.pathname.get_untracked().starts_with(CALLBACK_PATH)
                {
                    return;
                }
                if document()
                    .query_selector("dialog[open]")
                    .ok()
                    .flatten()
                    .is_some()
                {
                    dismiss_name_prompt();
                    return;
                }
                typed.set(String::new());
                note.set("");
                open.set(true);
            },
            Duration::ZERO,
        );
    });
    // Modal reports both Later and Escape through its open signal.
    Effect::new(move |was_open: Option<bool>| {
        let is_open = open.get();
        if was_open == Some(true) && !is_open && session.signed_in.get_untracked() {
            dismiss_name_prompt();
        }
        is_open
    });

    let save = move |ev: leptos::ev::SubmitEvent| {
        ev.prevent_default();
        if saving.get_untracked() || !session.signed_in.get_untracked() {
            return;
        }
        let value = typed.with_untracked(|s| s.trim().to_string());
        if let Some(message) = validate_name(&value) {
            note.set(message);
            return;
        }
        saving.set(true);
        note.set("Saving…");
        spawn_local(async move {
            let result = api::put_me(auth, &value).await;
            saving.set(false);
            if !session.signed_in.get_untracked() {
                return;
            }
            match result {
                Ok(me) => {
                    if me.balance.is_some() {
                        session.coins.set(me.balance);
                    }
                    session.needs_name.set(false);
                    open.set(false);
                    toasts.show("Display name saved.");
                }
                Err(e) if e.error.status == 400 => note.set(name_error(&e.error.message)),
                Err(_) => note.set("Could not save right now. Please try again."),
            }
        });
    };

    view! {
        <Modal open=open id="name-prompt" title="Pick a display name" close_label="Later">
            <p>"Others see this name next to your chat messages. You can change it later on your profile."</p>
            <form class="play-act" on:submit=save>
                <label class="play-field">
                    "Name"
                    <input class="play-input" type="text" maxlength="32" autocomplete="nickname"
                        autofocus=true data-testid="name-prompt-input"
                        prop:value=move || typed.get()
                        on:input=move |ev| typed.set(event_target_value(&ev))/>
                </label>
                <button type="submit" class="btn" data-testid="name-prompt-save"
                    disabled=move || saving.get()>"Save"</button>
            </form>
            <p class="play-hint" role="status" data-testid="name-prompt-note">{move || note.get()}</p>
        </Modal>
    }
}
