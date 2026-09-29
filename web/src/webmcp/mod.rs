//! WebMCP tools, registered from Rust through a small JS shim (js/webmcp.js). Only in builds with
//! the `webmcp` feature: on in dev, off in production until W12's go (docs/WASM_PLAN.md section 4).
//!
//! Rules (nic, 2026-09-29, and capyweb-manager's review hm-auue): a tool does what the UI can do,
//! with the same sign-in and the same server-side permission checks, and nothing new becomes
//! public. A tool calls the same API function the page calls; it never gets a route of its own.
//! No tool output carries another user's id, a playback locator, a token or a cookie. A recording
//! is reported as recorded, never live. No tool buys paid-camera time.
//!
//! - `read`: tools that change nothing on the server (reads and navigation).
//! - `act`: tools that spend coins or post as the user. Each one hands its action to the page that
//!   owns it and resolves only after the person confirms it there, or cancels it.

mod act;
mod read;

use std::rc::Rc;

use js_sys::{Object, Promise, Reflect};
use leptos::prelude::*;
use leptos::task::spawn_local;
use serde_json::json;
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;
use wasm_bindgen_futures::JsFuture;

use crate::auth::Auth;

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
pub(crate) enum Hint {
    /// Reads data; changes nothing.
    ReadOnly,
    /// Reads text other users wrote (chat): the agent must not take it as instructions.
    #[allow(dead_code)] // read_chat (W10, in progress)
    Untrusted,
    /// Changes what the page shows (navigation), nothing on the server.
    Ui,
    /// Spends coins or posts as the user. Goes through the page's own confirm step.
    #[allow(dead_code)] // act.rs (W10, in progress)
    Consequential,
}

impl Hint {
    fn annotations(self) -> serde_json::Value {
        json!({
            "readOnlyHint": matches!(self, Hint::ReadOnly | Hint::Untrusted),
            "untrustedContentHint": matches!(self, Hint::Untrusted),
            "consequentialHint": matches!(self, Hint::Consequential),
        })
    }
}

/// What a tool does when called: the arguments, and the `signal` the draft passes to execute,
/// so a cancelled call also cancels its fetch.
pub(crate) type Run = Box<dyn Fn(JsValue, Option<web_sys::AbortSignal>) -> Promise>;

/// One tool, before registration.
pub(crate) struct Tool {
    pub name: &'static str,
    pub title: &'static str,
    pub description: &'static str,
    pub schema: serde_json::Value,
    pub hint: Hint,
    pub run: Run,
}

/// Opens a path in this tab: `(path, label)`, the label naming it in the toast.
type Go = Rc<dyn Fn(&str, &str)>;

/// What tools may use: the session, and the router (with the toast that tells the person
/// watching why the page moved).
#[derive(Clone)]
pub struct Ctx {
    pub auth: Auth,
    go: Go,
}

impl Ctx {
    /// `go(path, label)` opens `path` in this tab; `label` names it in the toast.
    pub fn new(auth: Auth, go: impl Fn(&str, &str) + 'static) -> Self {
        Ctx {
            auth,
            go: Rc::new(go),
        }
    }

    pub(crate) fn go(&self, path: &str, label: &str) {
        (self.go)(path, label)
    }
}

/// MCP-style result: `{ content: [{ type: "text", text }] }`.
pub(crate) fn text_result(text: String) -> JsValue {
    let item = Object::new();
    let _ = Reflect::set(&item, &"type".into(), &"text".into());
    let _ = Reflect::set(&item, &"text".into(), &text.into());
    let content = js_sys::Array::of1(&item);
    let out = Object::new();
    let _ = Reflect::set(&out, &"content".into(), &content);
    out.into()
}

pub(crate) fn str_arg(input: &JsValue, key: &str) -> Option<String> {
    Reflect::get(input, &key.into())
        .ok()
        .and_then(|v| v.as_string())
}

fn abort_signal(options: &JsValue) -> Option<web_sys::AbortSignal> {
    Reflect::get(options, &"signal".into())
        .ok()
        .and_then(|s| s.dyn_into::<web_sys::AbortSignal>().ok())
}

type Execute = Closure<dyn Fn(JsValue, JsValue) -> Promise>;

/// Register one tool. `Some` holds what unregisters it (abort the controller) and the callback
/// the browser calls, which must live as long as the tool. `None`: no WebMCP, or the browser
/// refused it; a refusal is not a registered tool.
async fn register(tool: Tool) -> Option<(web_sys::AbortController, Execute)> {
    let run = tool.run;
    let exec = Execute::new(move |input, options: JsValue| run(input, abort_signal(&options)));
    let pending = register_tool_js(
        tool.name,
        tool.title,
        tool.description,
        &tool.schema.to_string(),
        &tool.hint.annotations().to_string(),
        exec.as_ref(),
    );
    let controller = JsFuture::from(pending).await.ok()?;
    let controller = controller.dyn_into::<web_sys::AbortController>().ok()?;
    Some((controller, exec))
}

/// Register the tools. The public ones stay for the page's life. The signed-in ones are
/// registered at sign-in and dropped at sign-out, so the browser only offers what the person
/// could do on the page; the server checks the JWT on every call either way.
pub fn install(ctx: Ctx) {
    if !webmcp_available() {
        return;
    }
    let public = read::public(ctx.clone());
    spawn_local(async move {
        let mut n = 0;
        for tool in public {
            if let Some(registered) = register(tool).await {
                std::mem::forget(registered); // for the page's whole life
                n += 1;
            }
        }
        leptos::logging::log!("webmcp: {n} tool(s) registered");
    });

    let held = StoredValue::new_local(Vec::<(web_sys::AbortController, Execute)>::new());
    let gen = StoredValue::new(0u32);
    let auth = ctx.auth;
    Effect::new(move |_| {
        let on = auth.signed_in();
        gen.update_value(|g| *g += 1);
        let my = gen.get_value();
        for (controller, _exec) in held.try_update_value(std::mem::take).unwrap_or_default() {
            controller.abort();
        }
        if !on {
            return;
        }
        let tools: Vec<Tool> = read::signed_in(ctx.clone())
            .into_iter()
            .chain(act::tools(ctx.clone()))
            .collect();
        spawn_local(async move {
            let mut n = 0;
            for tool in tools {
                let Some(registered) = register(tool).await else {
                    continue;
                };
                if gen.try_get_value() != Some(my) {
                    registered.0.abort(); // signed out (or in again) meanwhile
                    return;
                }
                held.update_value(|v| v.push(registered));
                n += 1;
            }
            leptos::logging::log!("webmcp: {n} signed-in tool(s) registered");
        });
    });
}
