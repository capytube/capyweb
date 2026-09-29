//! Tools that change nothing on the server: reads, and navigation within this tab.

use js_sys::Promise;
use serde_json::json;
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::future_to_promise;

use super::{str_arg, text_result, Ctx, Hint, Tool};
use crate::api;
use crate::routes::Page;

/// Tools for everyone, registered for the page's life.
pub(super) fn public(ctx: Ctx) -> Vec<Tool> {
    vec![list_streams(), open_page(ctx)]
}

/// Tools that need sign-in, registered while the person is signed in.
pub(super) fn signed_in(_ctx: Ctx) -> Vec<Tool> {
    Vec::new()
}

fn list_streams() -> Tool {
    Tool {
        name: "list_streams",
        title: "List CapyTube streams",
        description: "List the capybara camera streams: id, title, whether it is live or plays a \
            recording (recorded), and whether it is public or private. Private streams show a \
            price per 10 seconds when one is set; watching one needs sign-in and play coins on \
            the site.",
        schema: json!({ "type": "object", "properties": {} }),
        hint: Hint::ReadOnly,
        run: Box::new(|_input, signal| {
            future_to_promise(async move {
                let page = api::list_streams(signal.as_ref())
                    .await
                    .map_err(|e| JsValue::from_str(&e.to_string()))?;
                let rows: Vec<_> = page
                    .items
                    .iter()
                    .map(|s| {
                        json!({
                            "id": s.id,
                            "title": s.title,
                            "access": if s.is_public() { "public" } else { "private" },
                            "live": s.is_live.unwrap_or(false) && !s.is_recording(),
                            "recorded": s.is_recording(),
                            "price_per_10_sec": s.price_per_10_sec,
                        })
                    })
                    .collect();
                Ok(text_result(
                    serde_json::to_string(&rows).unwrap_or_default(),
                ))
            })
        }),
    }
}

fn open_page(ctx: Ctx) -> Tool {
    Tool {
        name: "open_page",
        title: "Open a CapyTube page",
        description: "Show one of the site's pages in this tab. The page names are fixed; \
            anything else is refused.",
        schema: json!({
            "type": "object",
            "properties": {
                "page": {
                    "type": "string",
                    "enum": Page::ALL.iter().map(|p| p.name()).collect::<Vec<_>>(),
                    "description": "Which page to open"
                }
            },
            "required": ["page"]
        }),
        hint: Hint::Ui,
        run: Box::new(move |input, _signal| {
            match str_arg(&input, "page").as_deref().and_then(Page::from_name) {
                Some(page) => {
                    ctx.go(page.path(), page.label());
                    Promise::resolve(&text_result(format!("Opened {}", page.path())))
                }
                None => Promise::reject(&JsValue::from_str("unknown page")),
            }
        }),
    }
}
