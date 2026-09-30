//! Terms of Service (W9; rewritten 2026-09-30 for capyweb-bpk). nic's answer (Q197): no company, no
//! postal address and no regional law; the master asked for terms modelled on the Curve and Uniswap
//! interface terms (the interface as is, no custodian, users responsible for their accounts), adapted to
//! what the site does today: email sign-in, play coins in our own ledger, no wallet and nothing on-chain.
//! The facts match docs/DATA_SHEET.md and the code it names; AI legal reads (not a lawyer) checked them.
//! Who "we" are comes from `legal::OPERATOR`. There is deliberately no governing-law clause.

use crate::components::chrome::PageHead;
use crate::pages::legal::WeAre;
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
                <WeAre/>
                " These terms cover your use of the website (\"the site\"). By using the site you agree to them; if you do not agree, please do not use it."
            </p>

            <h2>"1. The site"</h2>
            <p>"CapyTube is a website for watching capybara cameras. With an account you can also vote on and bid for what the capybaras do next, chat, react and watch paid cameras, all with play coins. We may change, pause or stop any part of the site at any time, with or without notice."</p>

            <h2>"2. Your account"</h2>
            <p>"Anyone can watch the free cameras and read the chat. To do anything else, you need an account. You must be 13 or older to create one, and if you are under 18 you need a parent's or guardian's permission. You are responsible for your account: keep your password to yourself, and you answer for what is done with it. We will never ask for your password."</p>

            <h2>"3. Play coins: not money, and nothing held for you"</h2>
            <p>"Every new account gets 50 play coins once. Play coins exist only in CapyTube's own records. They are not money and have no money value: they cannot be bought, sold, withdrawn, cashed out or sent to another person, and they are not your property. We do not hold money or any other asset for you. We may change what things cost in play coins, and we may correct a balance that is wrong because of an error. When an account is deleted, its play coins go with it, and nothing is paid out."</p>

            <h2>"4. Paid cameras"</h2>
            <p>"A paid camera shows its price in play coins before you start. While you watch, it takes coins a minute at a time, buying the next minute shortly before the current one ends. Pausing the video does not stop the charge: press Stop watching to end it. No new minute is bought while the tab is hidden."</p>

            <h2>"5. Chat, names and requests"</h2>
            <p>"You are responsible for the display name, chat messages and requests you write. Chat messages are public, shown with your display name, and kept for 30 days. Do not post anything unlawful, hateful, harassing, sexual or violent, spam, someone else's personal information, or anything that pretends to be someone else. By posting, you let us show what you wrote on the site. We may remove anything that breaks these rules, and limit or close an account that does."</p>

            <h2>"6. Using the site fairly"</h2>
            <p>"Do not attack, overload or try to break into the site or anyone's account; do not use scripts or several accounts to collect or spend play coins; do not get around the site's limits; and do not use the site to break the law."</p>

            <h2>"7. The videos"</h2>
            <p>"The cameras may show recordings rather than live video; the site says when a camera is recorded. A camera may be offline. The videos and the site's design are ours: watch them here, but do not copy or republish them."</p>

            <h2>"8. Closing your account"</h2>
            <p>"You can ask us to delete your account at any time: the Account Deletion Instructions page says how. We may switch off or close an account that breaks these terms or harms other people or the site."</p>

            <h2>"9. No warranty"</h2>
            <p>"The site is provided \"as is\" and \"as available\", without warranties of any kind. We do not promise that the site, or any camera, will be available, free of errors or secure."</p>

            <h2>"10. Limits of liability"</h2>
            <p>"As far as the law allows, we are not liable for any loss that comes from using the site or from not being able to use it, including lost play coins or lost data."</p>

            <h2>"11. Changes to these terms"</h2>
            <p>"We may change these terms. When they change, we update them here with a new date, and if a change is significant, we also say so on the site. If you keep using the site after that, the new terms apply."</p>

            <h2>"12. Contact"</h2>
            <p>"If you have any questions about these terms, write to us at:"</p>
            <p>"Email: " <a href="mailto:contact@capytube.xyz">"contact@capytube.xyz"</a></p>
            <p>"These Terms of Service were last updated on 30 September 2026."</p>
        </article>
    }
}
