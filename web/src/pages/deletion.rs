//! Data deletion instructions (W9), ported from src/components/DeletionInstructions.tsx.
//! W12: rewritten to the real process (capyweb-manager, 2026-09-29): a request by email, done by
//! hand by staff (docs/RUNBOOKS.md section 1). There is no delete button, so the page names none.
//! What "its data" covers matches docs/DATA_SHEET.md. `[Insert contact email]` stays visible until
//! the owner supplies the mailbox.

use crate::components::chrome::PageHead;
use leptos::prelude::*;

#[component]
pub fn Deletion() -> impl IntoView {
    view! {
        <article class="static-page">
            <PageHead title="Account Deletion Instructions"/>
            <p>
                " You can ask us to delete your CapyTube account and the data that goes with it. There is no delete button on the site: you ask by email, and we do it for you. "
            </p>
            <h2>
                "Step 1: Email us from your account's address"
            </h2>
            <p>
                " Send an email to the address under \"Contact Us\" below. Send it from the email address you sign in to CapyTube with, and say that you want your account deleted. We can only act on a request from that address, so that nobody else can delete your account. "
            </p>
            <h2>
                "Step 2: Confirm by answering our reply"
            </h2>
            <p>
                " We reply to the address on your account to check that the request is really yours. Answer that reply to confirm. We will never ask for your password. "
            </p>
            <h2>
                "Step 3: We delete your account and its data"
            </h2>
            <p>
                " When you confirm, we switch off sign-in for your account straight away. Within 30 days, we delete the account and its data, and email you when it is done. This covers: "
            </p>
            <ul>
                <li>"your email address and password"</li>
                <li>"your display name"</li>
                <li>"your play-coin balance and history"</li>
                <li>"your votes and bids, and any custom requests you wrote"</li>
                <li>"your chat messages"</li>
                <li>"the paid-camera time on your account"</li>
            </ul>
            <p>
                " Reactions are counted without your name, and bid amounts are shown without one, so those totals stay as they are. A result that was already announced stays as it is. "
            </p>
            <h2>
                "Step 4: Backups and play coins"
            </h2>
            <p>
                " Our database keeps backups for 35 days, so copies of your data are gone from them within 35 days after we delete it. "
            </p>
            <p>
                " Play coins have no cash value, so any coins left on your account are not refunded or paid out. "
            </p>
            <h2>
                "Contact Us"
            </h2>
            <p>
                " If you have questions about deleting your account, write to us at: "
            </p>
            <p>"Email: [Insert contact email]"</p>
        </article>
    }
}
