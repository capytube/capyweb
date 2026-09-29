//! Profile page (W8): the signed-out pitch, and sign-in once a user pool is configured.
//! The signed-in view (name, balance, ledger) is the rest of W8.

use leptos::prelude::*;

use crate::components::chrome::PageHead;

#[component]
pub fn ProfileSignedOut() -> impl IntoView {
    let auth = crate::auth::use_auth();
    view! {
        <PageHead
            title="Profile"
            eyebrow="Signed out"
            lede="Your name, play-coin balance and ledger, in one place once you sign in."
        />
        <section class="profile-pitch" aria-labelledby="profile-perks">
            <h2 id="profile-perks">"What you'll do with your profile"</h2>
            <ul class="play-rules">
                <li>"See your display name."</li>
                <li>"Check your play-coin balance."</li>
                <li>"Review your vote and bid ledger."</li>
            </ul>
        </section>
        // Only once a user pool is configured (config.json); a signed-in view comes with W8.
        <div data-slot="sign-in">
            {move || (auth.ready() && !auth.signed_in()).then(|| view! {
                <button type="button" class="btn" data-testid="profile-sign-in"
                    on:click=move |_| auth.sign_in("/profile")>"Sign in"</button>
            })}
        </div>
    }
}
