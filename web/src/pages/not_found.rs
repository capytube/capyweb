use leptos::prelude::*;
use leptos_router::components::A;

use crate::components::chrome::PageHead;

#[component]
pub fn NotFound() -> impl IntoView {
    crate::noindex_while_shown();
    view! {
        <PageHead title="Page not found" lede="Nothing lives at this address. Maybe it wandered off to the pond."/>
        <div class="actions mt-4">
            <A href="/" attr:class="btn">"Go home"</A>
            <A href="/watch" attr:class="btn btn-ghost">"Watch the capybaras"</A>
        </div>
    }
}
