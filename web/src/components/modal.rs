//! A modal dialog on the native <dialog> element: showModal() gives Escape to close, focus moved
//! into the dialog and back, and the rest of the page made inert, with no focus-trap code of
//! our own. The React Modal had none of these.

use std::sync::atomic::{AtomicUsize, Ordering};

use leptos::html;
use leptos::prelude::*;

static NEXT_ID: AtomicUsize = AtomicUsize::new(0);

#[component]
pub fn Modal(
    open: RwSignal<bool>,
    #[prop(into)] title: String,
    #[prop(optional, into)] close_label: Option<String>,
    children: Children,
) -> impl IntoView {
    let dialog = NodeRef::<html::Dialog>::new();
    Effect::new(move |_| {
        let Some(d) = dialog.get() else { return };
        if open.get() {
            if !d.open() {
                let _ = d.show_modal();
            }
        } else if d.open() {
            d.close();
        }
    });
    let close_label = close_label.unwrap_or_else(|| "Close".into());
    let title_id = format!("modal-title-{}", NEXT_ID.fetch_add(1, Ordering::Relaxed));
    let labelled_by = title_id.clone();
    view! {
        <dialog class="modal" node_ref=dialog on:close=move |_| open.set(false) aria-labelledby=labelled_by>
            <h2 id=title_id>{title}</h2>
            <div class="mb-4">{children()}</div>
            <form method="dialog" class="actions justify-end">
                <button class="btn btn-small" type="submit">{close_label}</button>
            </form>
        </dialog>
    }
}
