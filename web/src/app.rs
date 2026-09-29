//! The app shell and route table. Routes keep the React app's URLs (docs/WASM_PLAN.md
//! section 2).

use leptos::prelude::*;
use leptos_router::components::{Route, Router, Routes};
use leptos_router::path;

use crate::auth::{Auth, AuthCallback};
use crate::components::chrome::{Footer, Header, TabBar, ToastHost};
use crate::pages::home::Home;
use crate::pages::not_found::NotFound;
use crate::pages::{
    about::About, deletion::Deletion, play::Play, privacy::Privacy, profile::Profile, robot::Robot,
    terms::Terms,
};
use crate::state::{Session, Toasts};

#[component]
pub fn App() -> impl IntoView {
    let session = Session::default();
    let toasts = Toasts::default();
    provide_context(session);
    provide_context(toasts);
    Auth::provide(session, toasts);
    view! {
        <Router>
            <Tools/>
            <Header/>
            <main id="main" class="view" tabindex="-1">
                <Routes fallback=NotFound>
                    <Route path=path!("/") view=Home/>
                    <Route path=path!("/watch") view=crate::pages::watch::Watch/>
                    <Route path=path!("/stream/:capyId") view=crate::pages::watch_room::WatchRoom/>
                    <Route path=path!("/play") view=Play/>
                    <Route path=path!("/shop") view=crate::pages::shop::Shop/>
                    <Route path=path!("/shop/:id") view=crate::pages::shop::PassDetails/>
                    <Route path=path!("/profile") view=Profile/>
                    <Route path=path!("/robot") view=Robot/>
                    <Route path=path!("/about-us") view=About/>
                    <Route path=path!("/privacy-policy") view=Privacy/>
                    <Route path=path!("/terms-of-service") view=Terms/>
                    <Route path=path!("/deletion") view=Deletion/>
                    <Route path=path!("/auth/callback") view=AuthCallback/>
                </Routes>
            </main>
            <Footer/>
            <TabBar/>
            <ToastHost/>
        </Router>
    }
}

/// Registers the WebMCP tools once, inside the router so a tool can navigate. When an assistant
/// moves the page, a toast says so: the person watching should never wonder why it changed.
/// Only in builds with the `webmcp` feature (dev); a production build registers nothing.
#[cfg(feature = "webmcp")]
#[component]
fn Tools() -> impl IntoView {
    use crate::auth::use_auth;
    use crate::state::use_toasts;
    use leptos_router::hooks::use_navigate;
    use leptos_router::NavigateOptions;

    let navigate = use_navigate();
    let toasts = use_toasts();
    crate::webmcp::install(crate::webmcp::Ctx::new(use_auth(), move |path, label| {
        navigate(path, NavigateOptions::default());
        toasts.show(format!("An assistant opened {label}"));
    }));
}

#[cfg(not(feature = "webmcp"))]
#[component]
fn Tools() -> impl IntoView {}
