//! Privacy (W9; rewritten 2026-09-30 for capyweb-bpk). nic's answer (Q197): no company, no postal
//! address, and no regional-law compliance claims; the master and capyweb-manager asked for an honest
//! account of what the site collects, modelled loosely on web3 interface policies. Every statement comes
//! from docs/DATA_SHEET.md, which names the file each fact was checked in; AI legal reads (not a
//! lawyer) checked it against the code. Who runs the site comes from `legal::OPERATOR`.

use crate::components::chrome::PageHead;
use crate::pages::legal::WeAre;
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
                <WeAre/>
                " This page says what the site collects, why, where it is kept, for how long, and how to have it deleted. It describes what the site does today."
            </p>

            <h2>"1. Who we are"</h2>
            <p>
                "CapyTube has no postal address. To reach us, write to "
                <a href=MAIL>"contact@capytube.xyz"</a>
                "."
            </p>

            <h2>"2. What we collect"</h2>
            <p>"You can watch the free cameras and read the chat without an account. We do not log visits: access logging is switched off on the website and on its server. When something goes wrong on our server, our error log notes which page or camera the request was for and the error, not your email address or account id."</p>
            <p>"If you create an account, we keep:"</p>
            <ul>
                <li>"Your email address and password, for signing in. Amazon Cognito, our sign-in service, keeps them. You type the password on Cognito's page, never on ours, and our code never sees it."</li>
                <li>"An account id that links your account to what you do on the site."</li>
                <li>"The display name you choose."</li>
                <li>"Your play-coin balance and every change to it, your votes and bids, and any short request you write with a vote."</li>
                <li>"Your chat messages, with your display name and account id."</li>
                <li>"Which paid camera you paid to watch, and until when."</li>
                <li>"The time of your last chat message, to allow one message every 2 seconds, and a short record of each coin action, so a repeated click cannot spend twice."</li>
            </ul>
            <p>"Reactions are kept only as a total for each camera: we do not keep who reacted."</p>
            <p>"If you email us, we keep your message and forward it to our team's mailbox."</p>
            <p>"The site does not ask for your real name, age, postal address, phone number or any payment details. There is nothing to pay: play coins are not money."</p>

            <h2>"3. Why we use it"</h2>
            <ul>
                <li>"To run what you use: your account, the play coins, votes, bids, chat and paid cameras."</li>
                <li>"To keep the site working and fair: limits on sign-ups and chat, removing abuse, and fixing errors."</li>
                <li>"To answer you when you write to us."</li>
            </ul>
            <p>"We do not sell your data, we show no advertising, and we send no marketing email."</p>

            <h2>"4. Who can see it"</h2>
            <ul>
                <li>"Everyone, signed in or not: chat messages with the author's display name, the reaction totals, and the highest bid on a bid round (a number, without a name). Never your email address or account id."</li>
                <li>"You: your own balance, coin history and display name."</li>
                <li>"Our team, who can read the database and the sign-in service, including email addresses, when running the site."</li>
                <li>"Amazon Web Services (AWS), which hosts the site and its data."</li>
                <li>"The provider of our team's mailbox, for the emails you send us."</li>
            </ul>
            <p>"The site's own code sends your data to no one else."</p>

            <h2>"5. Where it is kept"</h2>
            <p>"Your data is stored with AWS in its Singapore region. The website and the videos reach you through Amazon CloudFront, from locations nearer to you, which may be in other countries. Sign-up codes and password-reset emails are sent by AWS. The emails you send us are forwarded to our team's mailbox, which may be kept in another country."</p>

            <h2>"6. How long we keep it"</h2>
            <ul>
                <li>"Your account and its data: until the account is deleted."</li>
                <li>"Chat messages: 30 days, then they are deleted automatically."</li>
                <li>"The records that stop a click from spending twice: 24 hours."</li>
                <li>"Reaction totals: as long as the camera exists. They hold no account id."</li>
                <li>"Error logs: 14 days. They hold no email address and no account id."</li>
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
            <p>"These are all needed for the site to work. The site has no advertising or analytics cookies, no tracking pixels and no third-party scripts."</p>

            <h2>"8. Deleting your data, and other requests"</h2>
            <p>
                "To have your account and its data deleted, write to "
                <a href=MAIL>"contact@capytube.xyz"</a>
                " from the email address you sign in with. The Account Deletion Instructions page gives the steps. From the same address you can also ask for a copy of what we keep about your account. You can change your display name yourself on your Profile page."
            </p>

            <h2>"9. Children"</h2>
            <p>"CapyTube is not for children under 13. If we learn that a child under 13 has an account, we delete it."</p>

            <h2>"10. Security"</h2>
            <p>"The site is served only over HTTPS. Passwords are handled by Amazon Cognito and never reach our code, and only our team can reach the stored data. No website is perfectly secure, and we cannot promise that ours is."</p>

            <h2>"11. Changes to this page"</h2>
            <p>"When this page changes, we update it here with a new date. If a change is significant, we also say so on the site."</p>

            <h2>"12. Contact"</h2>
            <p>
                "Email: "
                <a href=MAIL>"contact@capytube.xyz"</a>
            </p>
            <p>"This Privacy Policy was last updated on 30 September 2026."</p>
        </article>
    }
}
