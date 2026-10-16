//! After a sign-in, offer a passkey once per account and device (hm-nuhjd): the next sign-in
//! then needs no email code. "Not now" (or Escape) is remembered; the profile page still adds one.

use leptos::prelude::*;
use leptos_router::hooks::use_location;

use crate::{
    auth::use_auth,
    components::modal::{after_open_dialog, Modal},
    oauth::CALLBACK_PATH,
};

#[component]
pub fn PasskeyOffer() -> impl IntoView {
    let auth = use_auth();
    let location = use_location();
    let open = RwSignal::new(false);
    let adding = StoredValue::new(false);

    Effect::new(move |_| {
        let path = location.pathname.get();
        if !auth.signed_in() || path.starts_with(CALLBACK_PATH) || !auth.take_passkey_offer() {
            return;
        }
        // Behind any dialog already open (a vote's confirmation, the name prompt).
        after_open_dialog(move || {
            if auth.signed_in_now() {
                open.set(true);
            }
        });
    });
    // Modal reports both "Not now" and Escape through its open signal.
    Effect::new(move |was_open: Option<bool>| {
        let is_open = open.get();
        if was_open == Some(true) && !is_open && !adding.get_value() {
            auth.decline_passkey();
        }
        is_open
    });
    let add = move |_| {
        adding.set_value(true);
        open.set(false);
        auth.add_passkey(&location.pathname.get_untracked());
    };

    view! {
        <Modal open=open id="passkey-offer" title="Sign in faster next time" close_label="Not now"
            actions=Box::new(move || view! {
                <button type="button" class="btn btn-small" data-testid="passkey-offer-add" on:click=add>"Add a passkey"</button>
            }.into_any())>
            <p>"Add a passkey on this device: next time you sign in with your face, fingerprint or screen lock, no email code."</p>
        </Modal>
    }
}
