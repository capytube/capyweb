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
    /// The dialog element's id, for code that must tell this dialog apart.
    #[prop(optional, into)]
    id: Option<String>,
    #[prop(into)] title: String,
    #[prop(optional, into)] close_label: Option<String>,
    /// Buttons shown before the close button (e.g. Confirm); they must not submit the form.
    #[prop(optional)]
    actions: Option<Children>,
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
        // The browser queues the close event, so it can arrive after the dialog has been opened
        // again for another action: then it is stale, and must not close the new one.
        <dialog class="modal" id=id node_ref=dialog aria-labelledby=labelled_by on:close=move |_| {
            if !dialog.get_untracked().is_some_and(|d| d.open()) {
                open.set(false);
            }
        }>
            <h2 id=title_id>{title}</h2>
            <div class="mb-4">{children()}</div>
            <form method="dialog" class="actions justify-end">
                {actions.map(|a| a())}
                <button class="btn btn-small" type="submit">{close_label}</button>
            </form>
        </dialog>
    }
}
