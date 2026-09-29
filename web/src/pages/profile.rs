//! Profile page (W8): signed-out pitch only. Sign-in action lands in lane 3.

use leptos::prelude::*;

use crate::components::chrome::PageHead;

#[component]
pub fn ProfileSignedOut() -> impl IntoView {
    view! {
        <PageHead
            title="Profile"
            eyebrow="Signed out"
            lede="Sign in soon to track your play coins."
        />
        <section class="profile-pitch" aria-labelledby="profile-perks">
            <h2 id="profile-perks">"What you'll do with your profile"</h2>
            <ul class="play-rules">
                <li>"See your display name."</li>
                <li>"Check your play-coin balance."</li>
                <li>"Review your vote and bid ledger."</li>
            </ul>
        </section>
        <div data-slot="sign-in" aria-hidden="true"></div>
    }
}
