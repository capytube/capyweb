//! Privacy policy (W9; rewritten 2026-09-30 for capyweb-bpk). Every statement comes from
//! docs/DATA_SHEET.md, which names the file each fact was checked in; the AI legal read of that day
//! (not a lawyer) found the ported template described payments, advertising and marketing email the
//! site does not have. Who runs the site comes from `legal::OPERATOR`: until the owner answers, the
//! address is a marked placeholder (`mark.todo`).

use crate::components::chrome::PageHead;
use crate::pages::legal::{Operator, OPERATOR};
use leptos::prelude::*;

const MAIL: &str = "mailto:contact@capytube.xyz";

#[component]
pub fn Privacy() -> impl IntoView {
    view! {
        <article class="static-page">
            <PageHead title="Privacy policy"/>
            <p>
                <strong>"Effective Date: "</strong>
                "30 September 2026"
            </p>
            <p>
                {OPERATOR.we()}
                " (\"we\", \"us\") runs capytube.xyz. This policy says what we collect, why, where it is kept, for how long, and what you can ask us to do. It describes what the site really does."
            </p>

            <h2>"1. Who we are"</h2>
            <p>
                "We decide how your personal data is used (we are its \"controller\"). Write to us at "
                <a href=MAIL>"contact@capytube.xyz"</a>
                "."
                {match (OPERATOR, OPERATOR.address_line()) {
                    (Operator::Pending, _) => view! {
                        " Our postal address: "
                        <mark class="todo">"[insert company address]"</mark>
                    }
                    .into_any(),
                    (_, Some(line)) => view! { " Our postal address: " {line} "." }.into_any(),
                    (_, None) => ().into_any(),
                }}
            </p>

            <h2>"2. What we collect"</h2>
            <p>"You can watch the free cameras and read the chat without an account. If you create one, we keep:"</p>
            <ul>
                <li>"Your email address and password, for signing in. Amazon Cognito, our sign-in service, keeps them; the password is typed on Cognito's page, never on ours, and we never see it."</li>
                <li>"An account id that links your account to what you do on the site."</li>
                <li>"The display name you choose."</li>
                <li>"Your play-coin balance and every change to it, your votes and bids, and any short request you write with a vote."</li>
                <li>"Your chat messages, with your display name."</li>
                <li>"Which paid camera you paid to watch, and until when."</li>
                <li>"The time of your last chat message, to allow one message every 2 seconds, and a short record of each coin action, so a repeated click cannot spend twice."</li>
            </ul>
            <p>"If you email us, we keep your message and forward it to our team's mailbox."</p>
            <p>"We do not ask for your real name, age, postal address, phone number or any payment details. There is nothing to pay: play coins are not money."</p>

            <h2>"3. Why we use it"</h2>
            <ul>
                <li>"To run the service you signed up for: your account, the play coins, votes, bids, chat and paid cameras. This is needed to provide the service you asked for."</li>
                <li>"To keep the site safe and fair: limits on sign-ups and chat, removing abuse, and fixing errors. This is our legitimate interest in running a safe service."</li>
                <li>"To answer you when you write to us."</li>
                <li>"To meet a legal duty, if one applies."</li>
            </ul>
            <p>"We do not use your data for advertising, we do not sell it, and we send no marketing email."</p>

            <h2>"4. Who can see it"</h2>
            <ul>
                <li>"Everyone, signed in or not: chat messages with the author's display name, the reaction totals, and the highest bid on a bid round (a number, without a name). Never your email address or account id."</li>
                <li>"You: your own balance, coin history and display name."</li>
                <li>"Our team, who can read the database and the sign-in service when running the site."</li>
                <li>"Amazon Web Services (AWS), which hosts the site and processes the data for us under its data processing terms."</li>
                <li>"Our email provider, for the emails you send us: they are forwarded to our team's mailbox."</li>
            </ul>
            <p>"No one else receives your data from us."</p>

            <h2>"5. Where it is kept"</h2>
            <p>"Your data is stored by AWS in Singapore. The website and the videos reach you through Amazon CloudFront, from locations near you, which may be in other countries. Sign-up codes and password resets are emailed by AWS. If you live outside Singapore, your data is transferred there. Emails you send us are also forwarded to our team's mailbox, which may be kept in another country."</p>

            <h2>"6. How long we keep it"</h2>
            <ul>
                <li>"Your account and its data: until the account is deleted."</li>
                <li>"Chat messages: 30 days, then they are deleted automatically."</li>
                <li>"The records that stop a click from spending twice: 24 hours."</li>
                <li>"Server logs: 14 days. They hold no email address and no account id."</li>
                <li>"Emails you send us: 90 days in our mail storage; the forwarded copy stays in our team's mailbox."</li>
                <li>"Backups: 35 days. Deleted data can be restored from them for 35 days after it is deleted. For those 35 days we keep your account id and the date of deletion, only to delete your data again if a backup is ever restored."</li>
            </ul>

            <h2>"7. Cookies and storage in your browser"</h2>
            <ul>
                <li>"While you watch a paid camera, three cookies open that camera's video files until your paid time ends, plus 30 seconds. They hold no account id, email or name."</li>
                <li>"When you sign in, your browser keeps a sign-in token for up to 30 days, so you stay signed in. Signing out removes it."</li>
                <li>"During a sign-in, and to remember where a video was paused, the browser keeps a few short-lived values that go when you close the tab."</li>
                <li>"Amazon Cognito sets its own cookies on its sign-in page."</li>
            </ul>
            <p>"All of these are needed for the site to work. There are no advertising or analytics cookies, no tracking pixels and no third-party scripts."</p>

            <h2>"8. Your rights"</h2>
            <p>
                "You can ask for a copy of your data, to correct it, to delete it, or to limit or object to how we use it. Write to "
                <a href=MAIL>"contact@capytube.xyz"</a>
                " from the email address of your account, so we know the account is yours. We answer within 30 days. How deletion works is on the Account Deletion Instructions page. You can also complain to the data protection authority where you live."
            </p>

            <h2>"9. Children"</h2>
            <p>"CapyTube is not for children under 13. If we learn that a child under 13 has an account, we delete it."</p>

            <h2>"10. Security"</h2>
            <p>"The site is served only over HTTPS. Passwords are handled by Amazon Cognito, and only our team can reach the stored data."</p>

            <h2>"11. Changes to this policy"</h2>
            <p>"When this policy changes, we update it here with a new date. If a change is significant, we also say so on the site."</p>

            <h2>"12. Contact"</h2>
            <p>
                "Email: "
                <a href=MAIL>"contact@capytube.xyz"</a>
            </p>
            <p>"This Privacy Policy was last updated on 30 September 2026."</p>
        </article>
    }
}
