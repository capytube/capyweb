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
/// the shell: Google may not see a noindex that JavaScript removes later. The canonical link goes
/// while it shows (`show_canonical`).
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
    sync_canonical();
    let meta = StoredValue::new_local(Some(meta));
    on_cleanup(move || {
        if let Some(m) = meta.try_update_value(Option::take).flatten() {
            m.remove();
            sync_canonical();
        }
    });
}

thread_local! {
    /// The path the router shows now, for `sync_canonical` when a noindex view goes.
    static ROUTED_PATH: std::cell::RefCell<String> = const { std::cell::RefCell::new(String::new()) };
}

/// Point `<link rel="canonical">` at the route being shown: `routes::canonical_url` of `path`.
/// The app calls it on every navigation. The shell has no canonical: it is served for every
/// route, so one there would call every page a copy of the home page (docs/CRAWLERS_NOTES.md).
pub fn show_canonical(path: &str) {
    ROUTED_PATH.with_borrow_mut(|p| path.clone_into(p));
    sync_canonical();
}

/// One canonical link for the routed path, or none while a noindex view shows: a page that does
/// not exist is nobody's canonical.
fn sync_canonical() {
    let Some(doc) = web_sys::window().and_then(|w| w.document()) else {
        return;
    };
    let noindex = matches!(
        doc.query_selector("meta[name=robots][content=noindex]"),
        Ok(Some(_))
    );
    let link = doc.query_selector("link[rel=canonical]").ok().flatten();
    let path = ROUTED_PATH.with_borrow(Clone::clone);
    if noindex || path.is_empty() {
        if let Some(link) = link {
            link.remove();
        }
        return;
    }
    let link = match link {
        Some(link) => link,
        None => {
            let (Ok(link), Ok(Some(head))) =
                (doc.create_element("link"), doc.query_selector("head"))
            else {
                return;
            };
            let _ = link.set_attribute("rel", "canonical");
            let _ = head.append_child(&link);
            link
        }
    };
    let _ = link.set_attribute("href", &routes::canonical_url(&path));
}

/// Set the tab title. Pages call this through `PageHead`.
pub fn set_document_title(title: &str) {
    if let Some(doc) = web_sys::window().and_then(|w| w.document()) {
        doc.set_title(title);
    }
}
