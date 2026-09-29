//! CapyTube front end in Rust/WebAssembly (docs/WASM_PLAN.md). The binary in main.rs only mounts
//! `app::App`; everything else lives here so it can be tested natively with `cargo test`.

pub mod api;
pub mod app;
pub mod auth;
pub mod components;
pub mod display_name;
pub mod domain;
pub mod oauth;
pub mod pages;
pub mod routes;
pub mod state;
#[cfg(feature = "webmcp")]
pub mod webmcp;

/// While this view is shown, ask search engines not to index it: `<meta name="robots"
/// content="noindex">` in the head, removed with the view. For views that stand for a page that
/// does not exist, which still answer 200 from the client (docs/CRAWLERS_NOTES.md). It is never in
/// the shell: Google may not see a noindex that JavaScript removes later.
pub fn noindex_while_shown() {
    use leptos::prelude::*;
    let Some(doc) = web_sys::window().and_then(|w| w.document()) else {
        return;
    };
    let (Ok(meta), Ok(Some(head))) = (doc.create_element("meta"), doc.query_selector("head"))
    else {
        return;
    };
    let _ = meta.set_attribute("name", "robots");
    let _ = meta.set_attribute("content", "noindex");
    let _ = head.append_child(&meta);
    let meta = StoredValue::new_local(Some(meta));
    on_cleanup(move || {
        if let Some(m) = meta.try_update_value(Option::take).flatten() {
            m.remove();
        }
    });
}

/// Set the tab title. Pages call this through `PageHead`.
pub fn set_document_title(title: &str) {
    if let Some(doc) = web_sys::window().and_then(|w| w.document()) {
        doc.set_title(title);
    }
}
