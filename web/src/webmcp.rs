//! WebMCP tools, registered from Rust through a small JS shim (js/webmcp.js).
//!
//! Rules (nic, 2026-09-29): a tool does what the UI can do, with the same sign-in and the same
//! server-side permission checks, and nothing new becomes public. A tool calls the same API
//! function the page calls; it never gets a route of its own. Anything that spends coins is
//! marked consequential and must go through the page's own confirm step (docs/WASM_PLAN.md
//! section 4). The prototype registers no consequential tools.

use js_sys::{Object, Promise, Reflect};
use serde_json::json;
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;
use wasm_bindgen_futures::{future_to_promise, JsFuture};

use crate::api;

#[wasm_bindgen(module = "/js/webmcp.js")]
extern "C" {
    #[wasm_bindgen(js_name = webmcpAvailable)]
    fn webmcp_available() -> bool;

    /// Resolves to an AbortController, or null when absent or refused.
    #[wasm_bindgen(js_name = registerTool)]
    fn register_tool_js(
        name: &str,
        title: &str,
        description: &str,
        input_schema_json: &str,
        annotations_json: &str,
        execute: &JsValue,
    ) -> Promise;
}

/// The draft's hints. `readOnlyHint` means the tool changes nothing, so navigating is not
/// read-only; `consequentialHint` is for actions that spend or post as the user.
#[derive(Clone, Copy)]
enum Effect {
    /// Reads data; changes nothing.
    ReadOnly,
    /// Changes what the page shows (navigation), nothing on the server.
    Ui,
    /// Spends coins or posts as the user. Must go through the page's confirm step.
    #[allow(dead_code)]
    Consequential,
}

impl Effect {
    fn annotations(self) -> serde_json::Value {
        json!({
            "readOnlyHint": matches!(self, Effect::ReadOnly),
            "consequentialHint": matches!(self, Effect::Consequential),
        })
    }
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

/// The `signal` the draft passes to execute, so a cancelled call also cancels its fetch.
fn abort_signal(options: &JsValue) -> Option<web_sys::AbortSignal> {
    Reflect::get(options, &"signal".into())
        .ok()
        .and_then(|s| s.dyn_into::<web_sys::AbortSignal>().ok())
}

async fn register<F>(
    name: &str,
    title: &str,
    description: &str,
    schema: serde_json::Value,
    effect: Effect,
    f: F,
) -> bool
where
    F: Fn(JsValue, Option<web_sys::AbortSignal>) -> Promise + 'static,
{
    let exec =
        Closure::<dyn Fn(JsValue, JsValue) -> Promise>::new(move |input, options: JsValue| {
            f(input, abort_signal(&options))
        });
    let pending = register_tool_js(
        name,
        title,
        description,
        &schema.to_string(),
        &effect.annotations().to_string(),
        exec.as_ref(),
    );
    // The page registers its tools once for its whole life, so the callback must outlive this
    // call. The AbortController (when present) is how a future sign-out unregisters them.
    exec.forget();
    match JsFuture::from(pending).await {
        Ok(controller) => !controller.is_null(),
        Err(_) => false,
    }
}

fn str_arg(input: &JsValue, key: &str) -> Option<String> {
    Reflect::get(input, &key.into())
        .ok()
        .and_then(|v| v.as_string())
}

/// Register the catalog tools. `open` navigates the SPA (supplied by the router).
/// Returns how many the browser accepted.
pub async fn register_catalog_tools(open: impl Fn(String) + 'static) -> usize {
    if !webmcp_available() {
        return 0;
    }
    let mut n = 0;

    n += register(
        "list_streams",
        "List CapyTube streams",
        "List the capybara camera streams: id, title, whether it is live, and whether it is \
         public or private. Private streams show a price per 10 seconds when one is set; \
         watching one needs sign-in and payment on the site.",
        json!({ "type": "object", "properties": {} }),
        Effect::ReadOnly,
        |_input, signal| {
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
    )
    .await as usize;

    n += register(
        "open_stream",
        "Open a stream page",
        "Show one stream's page in this tab. Use an id from list_streams.",
        json!({
            "type": "object",
            "properties": { "id": { "type": "string", "description": "Stream id from list_streams" } },
            "required": ["id"]
        }),
        Effect::Ui,
        move |input, _signal| {
            let id = str_arg(&input, "id").unwrap_or_default();
            // Same rule as the catalog's requireId (backend/src/lib/http.ts ID_RE).
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
    )
    .await as usize;

    n
}
