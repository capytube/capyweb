//! WebMCP tools, registered from Rust through a small JS shim (js/webmcp.js).
//!
//! Rules (nic, 2026-09-29): a tool does what the UI can do, with the same sign-in and the same
//! server-side permission checks, and nothing new becomes public. A tool calls the same API
//! function the page calls; it never gets a route of its own. Anything that spends coins is
//! marked consequential and must go through the page's own confirm step (docs/WASM_PLAN.md
//! section 4). The prototype registers read-only tools only.

use js_sys::{Object, Promise, Reflect};
use serde_json::json;
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::future_to_promise;

use crate::api;

#[wasm_bindgen(module = "/js/webmcp.js")]
extern "C" {
    #[wasm_bindgen(js_name = webmcpAvailable)]
    fn webmcp_available() -> bool;

    #[wasm_bindgen(js_name = registerTool)]
    fn register_tool_js(
        name: &str,
        title: &str,
        description: &str,
        input_schema_json: &str,
        annotations_json: &str,
        execute: &JsValue,
    ) -> JsValue;
}

/// MCP-style result: `{ content: [{ type: "text", text }] }`.
fn text_result(text: String) -> JsValue {
    let item = Object::new();
    let _ = Reflect::set(&item, &"type".into(), &"text".into());
    let _ = Reflect::set(&item, &"text".into(), &text.into());
    let content = js_sys::Array::of1(&item);
    let out = Object::new();
    let _ = Reflect::set(&out, &"content".into(), &content);
    out.into()
}

fn register<F>(
    name: &str,
    title: &str,
    description: &str,
    schema: serde_json::Value,
    read_only: bool,
    f: F,
) -> bool
where
    F: Fn(JsValue) -> Promise + 'static,
{
    let exec = Closure::<dyn Fn(JsValue, JsValue) -> Promise>::new(move |input, _opts| f(input));
    let annotations = json!({ "readOnlyHint": read_only, "consequentialHint": !read_only });
    let controller = register_tool_js(
        name,
        title,
        description,
        &schema.to_string(),
        &annotations.to_string(),
        exec.as_ref(),
    );
    // The page registers its tools once for its whole life, so the callback must outlive this
    // call. The AbortController (when present) is how a future sign-out unregisters them.
    exec.forget();
    !controller.is_null()
}

fn str_arg(input: &JsValue, key: &str) -> Option<String> {
    Reflect::get(input, &key.into())
        .ok()
        .and_then(|v| v.as_string())
}

/// Register the read-only catalog tools. `open` navigates the SPA (supplied by the router).
pub fn register_catalog_tools(open: impl Fn(String) + 'static) -> usize {
    if !webmcp_available() {
        return 0;
    }
    let mut n = 0;

    n += register(
        "list_streams",
        "List CapyTube streams",
        "List the capybara camera streams: id, title, whether it is live, and whether it is \
         public or private. Private streams show a price per 10 seconds; watching one needs \
         sign-in and payment on the site.",
        json!({ "type": "object", "properties": {} }),
        true,
        |_input| {
            future_to_promise(async move {
                let page = api::list_streams()
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
                            "live": s.is_live.unwrap_or(false),
                            "price_per_10_sec": s.price_per_10_sec,
                        })
                    })
                    .collect();
                Ok(text_result(
                    serde_json::to_string(&rows).unwrap_or_default(),
                ))
            })
        },
    ) as usize;

    n += register(
        "open_stream",
        "Open a stream page",
        "Show one stream's page in this tab. Use an id from list_streams.",
        json!({
            "type": "object",
            "properties": { "id": { "type": "string", "description": "Stream id from list_streams" } },
            "required": ["id"]
        }),
        true,
        move |input| {
            let id = str_arg(&input, "id").unwrap_or_default();
            let valid = !id.is_empty()
                && id.len() <= 128
                && id
                    .chars()
                    .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_');
            if valid {
                open(id.clone());
                Promise::resolve(&text_result(format!("Opened /streams/{id}")))
            } else {
                Promise::reject(&JsValue::from_str("invalid stream id"))
            }
        },
    ) as usize;

    n
}
