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
                // Focus starts on the safe way out, not on an action such as Confirm: a held
                // Enter from the button that opened the dialog must not spend anything.
                <button class="btn btn-small" type="submit" autofocus>{close_label}</button>
            </form>
        </dialog>
    }
}

/// Runs `f` now if no dialog is open, else once the open one closes (and any opened after it):
/// one modal at a time, without dropping the later one.
pub fn after_open_dialog(f: impl FnOnce() + 'static) {
    use wasm_bindgen::{closure::Closure, JsCast};
    let Some(open) = document().query_selector("dialog[open]").ok().flatten() else {
        f();
        return;
    };
    let mut f = Some(f);
    let on_close = Closure::<dyn FnMut()>::new(move || {
        if let Some(f) = f.take() {
            // The close event runs before the next dialog's showModal; check on the next turn.
            set_timeout(move || after_open_dialog(f), std::time::Duration::ZERO);
        }
    });
    let _ = open.add_event_listener_with_callback("close", on_close.as_ref().unchecked_ref());
    on_close.forget();
}
