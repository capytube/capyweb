//! About us (W9), ported from src/components/AboutUs.tsx.

use crate::components::chrome::PageHead;
use leptos::prelude::*;

#[component]
pub fn About() -> impl IntoView {
    view! {
        <article class="static-page">
            <PageHead title="About CapyTube"/>
            <section>
                <h2 class="about-title">" Your Gateway to CapyTube "</h2>
                <p>
                    " Welcome to "
                    <strong>"CapyTube"</strong>
                    ", your window into the charming world of capybara cameras! "
                </p>
                <p>
                    " Here, you can watch your favorite capybara, "
                    <strong>"Magnus"</strong>
                    ", and take part in his everyday adventures. Vote on tasks for him to complete, or bid on what he does next, using "
                    <strong>"CapyCoins"</strong>
                    ", the play coins of this site. Play coins are not money: they have no cash value and cannot be cashed out. "
                </p>
                <p>
                    " On "
                    <strong>"CapyTube"</strong>
                    ", you’ll have the chance to guide Magnus through his activities, whether he’s lounging in a hot spring, munching on his favorite snacks, or exploring new territories. "
                </p>
                <p>
                    " With "
                    <strong>"CapyCoins"</strong>
                    ", you don’t just watch Magnus — you actively participate in his life! "
                </p>
                <div>
                    <img src="/assets/pages/aboutOne.webp" width="1250" height="1024" loading="lazy" alt="Two photos of a capybara: eating fresh greens, and sitting on a bed" />
                </div>
            </section>
            <section>
                <h2 class="about-title">" The Story of Magnus "</h2>
                <p>
                    " Magnus is no ordinary capybara. Born in the north of Thailand, he’s the second-generation capybara in his lineage, with a rich history of travel and adventure. From Thailand to various countries around the world, Magnus has become a symbol of peace, relaxation, and joy for everyone he meets. "
                </p>
                <p>
                    " Magnus is the star of our platform for a reason. Not only is he an adventurous capybara, but he’s also the heart and soul behind two major attractions: "
                </p>
                <ul>
                    <li>
                        <strong>"Magnus' Capybara Café:"</strong>
                        " A one-of-a-kind café experience where the theme and ambiance are all inspired by Magnus himself. "
                    </li>
                    <li>
                        <strong>"Magnus' Climbing Gym:"</strong>
                        " An adventurous, world-class climbing gym that brings Magnus' spirit of exploration and play to life. "
                    </li>
                </ul>
                <p>
                    " When he’s not running his café or gym, Magnus spends his time doing what he loves most — "
                    <strong>"swimming"</strong>
                    ", "
                    <strong>"bathing in hot springs"</strong>
                    ", and snacking on his favorite foods like "
                    <strong>"apples"</strong>
                    ", "
                    <strong>"watermelons"</strong>
                    ", "
                    <strong>"cucumbers"</strong>
                    ", and the occasional treat of "
                    <strong>"banana peels"</strong>
                    ". His all-time favorite, though, is "
                    <strong>"carrot pudding"</strong>
                    ". "
                </p>
                <div>
                    <img src="/assets/pages/aboutTwo.webp" width="800" height="1004" loading="lazy" alt="A capybara swimming in a shallow garden pool" />
                </div>
                <p>
                    " Though Magnus has many capybara friends, he’s "
                    <strong>"incredibly tame"</strong>
                    " and adores spending time with humans. In fact, he often prefers human companionship, soaking up the attention and love from everyone he meets. This makes him the perfect capybara to engage with our community and share his life with viewers worldwide. "
                </p>
            </section>
        </article>
    }
}
