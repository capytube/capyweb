//! Stand-in for a page that has not been ported yet. Each one is replaced by its task in
//! docs/WASM_PLAN.md section 7; the route exists now so deep links and the nav already work.

use leptos::prelude::*;
use leptos_router::components::A;

use crate::components::chrome::PageHead;

#[component]
pub fn ComingSoon(#[prop(into)] title: String, #[prop(into)] blurb: String) -> impl IntoView {
    view! {
        <PageHead title=title/>
        <div class="notice">
            <p class="mb-3">{blurb}</p>
            <A href="/" attr:class="btn btn-small">"Back to the capybaras"</A>
        </div>
    }
}
