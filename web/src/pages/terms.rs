//! Terms of Service (W9; rewritten 2026-09-30 for capyweb-bpk). The facts (play coins, chat, paid
//! cameras, deletion) match docs/DATA_SHEET.md and the code it names; the AI legal read of that day
//! (not a lawyer) asked for the play-coin, user-content and liability clauses. Who "we" are comes
//! from `legal::OPERATOR`. The governing law waits for the owner's answer on who runs the site.

use crate::components::chrome::PageHead;
use crate::pages::legal::OPERATOR;
use leptos::prelude::*;

#[component]
pub fn Terms() -> impl IntoView {
    view! {
        <article class="static-page">
            <PageHead title="Terms of Service"/>
            <p>
                "Effective Date: "
                "30 September 2026"
            </p>
            <p>
                "Welcome to CapyTube! "
                {OPERATOR.we()}
                " (\"we\", \"us\") runs capytube.xyz. By using the site you agree to these terms. Please read them."
            </p>

            <h2>"1. Who can use CapyTube"</h2>
            <p>"Anyone can watch the free cameras and read the chat. To vote, bid, chat, react or watch a paid camera, you need an account. You must be 13 or older to create one, and if you are under 18 you need a parent's or guardian's permission. Keep your password to yourself: you are responsible for what happens in your account."</p>

            <h2>"2. Play coins"</h2>
            <p>"Every new account gets 50 play coins once. You spend them on votes, bids and paid-camera time. Play coins are not money: they cannot be bought, sold, cashed out, or sent to another person, and they are not your property. We may change prices and the rules of the game, and we may correct a balance that is wrong because of an error. When an account is closed, its play coins go with it, and nothing is refunded."</p>

            <h2>"3. Paid cameras"</h2>
            <p>"A paid camera shows its price in play coins before you start. While you watch, coins are taken each minute. Pausing does not stop the charge: press Stop watching to end it. Nothing is taken while the tab is hidden."</p>

            <h2>"4. Chat, names and requests"</h2>
            <p>"You are responsible for the display name, chat messages and requests you write. Chat messages are public, shown with your display name, and kept for 30 days. Do not post anything unlawful, hateful, harassing, sexual or violent, spam, someone else's personal information, or anything that pretends to be someone else. By posting, you let us show what you wrote on the site. We may remove anything that breaks these rules, and limit or close an account that does."</p>

            <h2>"5. The videos"</h2>
            <p>"The cameras may show recordings rather than live video; the site says when a camera is recorded. A camera may be offline, and we do not promise that any camera, or the site, is always available. The videos and the site's design are ours: watch them here, but do not copy or republish them."</p>

            <h2>"6. Closing your account"</h2>
            <p>"You can ask us to delete your account at any time: the Account Deletion Instructions page says how. We may close an account that breaks these terms or harms other people or the site."</p>

            <h2>"7. Changes"</h2>
            <p>"We may change the site and these terms. When the terms change, we update them here with a new date, and if a change is significant, we also say so on the site. If you keep using the site after that, the new terms apply."</p>

            <h2>"8. No warranty, and limits of liability"</h2>
            <p>"CapyTube is free and is provided \"as is\", without warranties of any kind. As far as the law allows, we are not liable for any indirect or consequential loss, or for losing play coins. Nothing in these terms limits any right you have that the law does not allow us to limit."</p>

            <h2>"9. Contact"</h2>
            <p>"If you have any questions about these terms, write to us at:"</p>
            <p>"Email: " <a href="mailto:contact@capytube.xyz">"contact@capytube.xyz"</a></p>
            <p>"These Terms of Service were last updated on 30 September 2026."</p>
        </article>
    }
}
