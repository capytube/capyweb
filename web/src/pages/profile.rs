//! Profile page (W8): signed-out pitch only. Sign-in action lands in lane 3.

use leptos::prelude::*;

use crate::components::chrome::PageHead;

#[component]
pub fn ProfileSignedOut() -> impl IntoView {
    view! {
        <PageHead
            title="Profile"
            eyebrow="Signed out"
            lede="Track your play-coin moments, snack votes, and watch history once sign-in is ready."
        />
        <section class="profile-pitch" aria-labelledby="profile-perks">
            <h2 id="profile-perks">"What you'll do with your profile"</h2>
            <p>"Sign in unlocks your name, your play-coin balance, and your ledger history in one place."</p>
            <div class="profile-cards">
                <article class="card">
                    <h3>"Free public streams"</h3>
                    <p>"Watch Magnus and friends from the public room and keep up with each capybara's routine."</p>
                </article>
                <article class="card">
                    <h3>"Play-coin activity"</h3>
                    <p>"Spend play coins on snack votes and bids, then review each action in your profile ledger."</p>
                </article>
                <article class="card">
                    <h3>"Member-only extras"</h3>
                    <p>"Profile history and pass perks stay in sync once account routes are available."</p>
                </article>
            </div>
        </section>
        <section class="notice profile-slot" aria-label="Sign-in slot">
            <h2>"Sign-in action (coming soon)"</h2>
            <p>"Lane 3 adds the sign-in button here. This lane keeps the slot visible but non-interactive."</p>
        </section>
    }
}
