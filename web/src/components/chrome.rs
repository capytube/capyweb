//! The frame around every page: skip link, top bar, footer, phone tab bar, toasts.

use leptos::prelude::*;
use leptos_router::components::A;

use crate::components::modal::Modal;
use crate::routes::Page;
use crate::state::{use_session, use_toasts};

fn nav_link(p: Page) -> impl IntoView {
    view! {
        <A href=p.path() exact=true>
            {p.label()}
        </A>
    }
}

#[component]
pub fn Header() -> impl IntoView {
    let session = use_session();
    view! {
        <a class="skip" href="#main">"Skip to content"</a>
        <header class="topbar">
            <A href="/" attr:class="brand" attr:aria-label="CapyTube home">
                <img src="/assets/capytube.svg" alt="CapyTube" width="120" height="52"/>
                <span class="beta">"Beta"</span>
            </A>
            <nav class="nav" aria-label="Main">
                {Page::NAV.into_iter().map(nav_link).collect_view()}
            </nav>
            <div class="top-tools">
                <Show
                    when=move || session.signed_in.get()
                    fallback=|| view! { <A href=Page::Profile.path() attr:class="btn btn-ghost btn-small account-link">"Account"</A> }
                >
                    <A href=Page::Profile.path() attr:class="coin-pill" attr:title="Play coins. Not real money.">
                        <img src="/assets/capyCoin.svg" alt=""/>
                        <span>{move || session.coins.get().map(|c| c.to_string()).unwrap_or_else(|| "…".into())}</span>
                        <span class="sr-only">" play coins"</span>
                    </A>
                </Show>
            </div>
        </header>
    }
}

#[component]
pub fn Footer() -> impl IntoView {
    let about_coins = RwSignal::new(false);
    view! {
        <footer class="footer">
            <p>
                "CapyTube · Magnus and friends, live from Thailand. "
                <button type="button" class="underline font-dynapuff" on:click=move |_| about_coins.set(true)>
                    "Play coins are not money"
                </button>
            </p>
            <nav aria-label="Footer">
                {Page::FOOTER.into_iter().map(|p| view! { <A href=p.path()>{p.label()}</A> }).collect_view()}
            </nav>
        </footer>
        <Modal open=about_coins title="Play coins">
            <p>
                "Coins on CapyTube are play coins. You spend them on snack votes and bids. They are not "
                "money, you cannot cash them out, and they are not a crypto token."
            </p>
        </Modal>
    }
}

#[component]
pub fn TabBar() -> impl IntoView {
    view! {
        <nav class="tabbar" aria-label="Main (phone)">
            {Page::TABS.into_iter().map(nav_link).collect_view()}
        </nav>
    }
}

#[component]
pub fn ToastHost() -> impl IntoView {
    let toasts = use_toasts();
    view! {
        <div class="toasts" role="status" aria-live="polite">
            <For each=move || toasts.items.get() key=|t| t.id let:t>
                <div class="toast">{t.text}</div>
            </For>
        </div>
    }
}

/// A page's heading block. Sets the document title from the heading.
#[component]
pub fn PageHead(
    #[prop(into)] title: String,
    #[prop(optional, into)] eyebrow: Option<String>,
    #[prop(optional, into)] lede: Option<String>,
) -> impl IntoView {
    crate::set_document_title(&crate::routes::title_for(&title));
    view! {
        <header class="mb-6">
            {eyebrow.map(|e| view! { <p class="eyebrow">{e}</p> })}
            <h1>{title}</h1>
            {lede.map(|l| view! { <p class="lede">{l}</p> })}
        </header>
    }
}
