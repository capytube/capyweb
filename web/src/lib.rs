//! CapyTube front end in Rust/WebAssembly (docs/WASM_PLAN.md). The binary in main.rs only mounts
//! `app::App`; everything else lives here so it can be tested natively with `cargo test`.

pub mod api;
pub mod app;
pub mod auth;
pub mod components;
pub mod domain;
pub mod oauth;
pub mod pages;
pub mod routes;
pub mod state;
#[cfg(feature = "webmcp")]
pub mod webmcp;

/// Set the tab title. Pages call this through `PageHead`.
pub fn set_document_title(title: &str) {
    if let Some(doc) = web_sys::window().and_then(|w| w.document()) {
        doc.set_title(title);
    }
}
