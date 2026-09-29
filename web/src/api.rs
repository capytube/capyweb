//! Typed client for the capyweb HTTP API. Port of src/api/http.ts: same envelope, same errors,
//! 404 on a single item is `Ok(None)` rather than a failure.
//!
//! The base URL is fixed at build time from CAPYWEB_API_BASE:
//!   unset        -> "fixtures": static JSON under /fixtures, no network beyond this server
//!   "/api"       -> same-origin, as CloudFront will route it (and `trunk serve --proxy-*` locally)
//!   "https://…"  -> direct, which needs the origin in the API's CORS allow-list
//!
//! In fixture mode filters and paging are ignored: each route's file is its unfiltered first
//! page, generated from the backend's seed by web/tests/fixtures.mjs (`--check` spots drift).
//!
//! Signed-in calls go through `request_authed`, which takes the token from the auth seam
//! (`auth.rs`, W11): it adds `Authorization: Bearer <access token>`, and on a 401 refreshes once
//! and retries once. The server verifies the token (the `CognitoJwt` authorizer).

use gloo_net::http::Method;
use serde::de::DeserializeOwned;

use crate::auth::Auth;

use crate::domain::{
    AccessType, ActivityLog, Capybara, ChatMessage, ChatPage, Interaction, InteractionType,
    LiveStream, Offer, Page, Pass, RatingCounts,
};

pub const FIXTURES: &str = "fixtures";

pub fn base_url() -> &'static str {
    option_env!("CAPYWEB_API_BASE").unwrap_or(FIXTURES)
}

/// Refuse locators and nested paths: pass images must stay on our media origin.
pub fn media_src(key: &str) -> Option<String> {
    let name = key.strip_prefix("media/")?;
    if name.is_empty()
        || name.contains("..")
        || !name
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'.' | b'_' | b'-'))
    {
        return None;
    }
    Some(if base_url() == FIXTURES {
        format!("/fixtures/{key}")
    } else {
        format!("/{key}")
    })
}

/// A public camera's live HLS playlist: `/live/<id>/index.m3u8`, or `/fixtures/live/<id>/…` in
/// fixture mode (docs/VIDEO_DESIGN.md, "Player contract"). `None` for anything not explicitly
/// public: the browser never builds a media URL for a private camera. That URL will come from
/// the playback route, with signed cookies, once sign-in and payment exist.
pub fn live_src(stream: &LiveStream) -> Option<String> {
    if !stream.is_public() || validate_id(&stream.id).is_err() {
        return None;
    }
    let root = if base_url() == FIXTURES {
        "/fixtures"
    } else {
        ""
    };
    Some(format!("{root}/live/{}/index.m3u8", stream.id))
}

/// A non-2xx response, or a 2xx that was not JSON (usually the SPA's index.html).
#[derive(Debug, Clone, PartialEq)]
pub struct ApiError {
    pub status: u16,
    pub url: String,
    pub message: String,
    /// Stable `code` from the write API, empty when the body has none.
    pub code: String,
}

impl ApiError {
    pub fn is_not_found(&self) -> bool {
        self.status == 404
    }
}

impl std::fmt::Display for ApiError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{} ({})", self.message, self.status)
    }
}

/// Build the request URL. In fixture mode `/streams` maps to `/fixtures/streams.json` and the
/// query is dropped, because a static file cannot filter.
pub fn build_url(base: &str, path: &str, query: &[(&str, &str)]) -> String {
    let path = path.trim_start_matches('/');
    if base == FIXTURES {
        return format!("/{FIXTURES}/{path}.json");
    }
    let mut url = format!("{}/{}", base.trim_end_matches('/'), path);
    let pairs: Vec<String> = query
        .iter()
        .filter(|(_, v)| !v.is_empty())
        .map(|(k, v)| format!("{}={}", enc(k), enc(v)))
        .collect();
    if !pairs.is_empty() {
        url.push('?');
        url.push_str(&pairs.join("&"));
    }
    url
}

/// Percent-encode everything outside RFC 3986's unreserved set. Pure Rust, so it is testable
/// natively (js_sys would panic outside a browser).
pub fn enc(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        if b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'.' | b'~') {
            out.push(b as char);
        } else {
            out.push_str(&format!("%{b:02X}"));
        }
    }
    out
}

/// The API's `{ "error": "…" }` message, or a generic one.
pub fn error_message(status: u16, body: &str) -> String {
    serde_json::from_str::<serde_json::Value>(body)
        .ok()
        .and_then(|v| v.get("error").and_then(|e| e.as_str()).map(str::to_owned))
        .unwrap_or_else(|| format!("request failed with {status}"))
}

/// The write API's stable `code` (`slow_down`, `display_name_required`, …).
pub fn error_code(body: &str) -> String {
    serde_json::from_str::<serde_json::Value>(body)
        .ok()
        .and_then(|v| v.get("code").and_then(|c| c.as_str()).map(str::to_owned))
        .unwrap_or_default()
}

pub fn decode<T: DeserializeOwned>(status: u16, url: &str, body: &str) -> Result<T, ApiError> {
    let err = |message: String| ApiError {
        status,
        url: url.to_owned(),
        message,
        code: error_code(body),
    };
    if !(200..300).contains(&status) {
        return Err(err(error_message(status, body)));
    }
    serde_json::from_str(body).map_err(|e| {
        if body.trim_start().starts_with('<') {
            err("expected JSON, got something else".into())
        } else {
            err(format!("unexpected response shape: {e}"))
        }
    })
}

/// `signal` cancels the fetch, e.g. when a WebMCP caller aborts the tool call.
pub async fn request<T: DeserializeOwned>(
    path: &str,
    query: &[(&str, &str)],
    signal: Option<&web_sys::AbortSignal>,
) -> Result<T, ApiError> {
    let url = build_url(base_url(), path, query);
    let (status, body) = send(&url, Method::GET, None, None, None, signal).await?;
    decode(status, &url, &body)
}

/// One fetch: status and body text. Every API call goes through here.
/// `idempotency` is the `Idempotency-Key` header. The server requires it only when the
/// action spends coins; chat and reactions send one anyway so a later cost still replays.
async fn send(
    url: &str,
    method: Method,
    token: Option<&str>,
    body: Option<&str>,
    idempotency: Option<&str>,
    signal: Option<&web_sys::AbortSignal>,
) -> Result<(u16, String), ApiError> {
    let fail = |e: gloo_net::Error| ApiError {
        status: 0,
        url: url.to_owned(),
        message: format!("network error: {e}"),
        code: String::new(),
    };
    let mut req = gloo_net::http::RequestBuilder::new(url)
        .method(method)
        .header("accept", "application/json")
        .abort_signal(signal);
    if let Some(token) = token {
        req = req.header("authorization", &format!("Bearer {token}"));
    }
    if let Some(key) = idempotency {
        req = req.header("idempotency-key", key);
    }
    let req = match body {
        Some(b) => req.header("content-type", "application/json").body(b),
        None => req.build(),
    }
    .map_err(fail)?;
    let res = req.send().await.map_err(fail)?;
    Ok((res.status(), res.text().await.unwrap_or_default()))
}

/// A request as the signed-in user. `body` is JSON. Without a session it fails with 401 and
/// sends nothing. A 401 from the API triggers one refresh and one retry; if the refresh fails the
/// user is signed out and the 401 is returned.
pub async fn request_authed(
    auth: Auth,
    method: Method,
    path: &str,
    body: Option<&str>,
    signal: Option<&web_sys::AbortSignal>,
) -> Result<serde_json::Value, ApiError> {
    authed(auth, method, path, body, None, signal).await
}

/// One copy of the refresh-and-retry loop. Callers read the fields they need off the JSON
/// value, so chat and reactions do not each compile their own copy of this function.
async fn authed(
    auth: Auth,
    method: Method,
    path: &str,
    body: Option<&str>,
    idempotency: Option<&str>,
    signal: Option<&web_sys::AbortSignal>,
) -> Result<serde_json::Value, ApiError> {
    let url = build_url(base_url(), path, &[]);
    let mut retried = false;
    loop {
        let Some(token) = auth.access_token().await else {
            return Err(ApiError {
                status: 401,
                url,
                message: "sign in first".into(),
                code: String::new(),
            });
        };
        let (status, text) = send(
            &url,
            method.clone(),
            Some(&token),
            body,
            idempotency,
            signal,
        )
        .await?;
        if status == 401 && !retried {
            retried = true;
            if auth.refresh().await {
                continue;
            }
        }
        return decode(status, &url, &text);
    }
}

fn push_hex(out: &mut String, mut n: u64) {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    if n == 0 {
        out.push('0');
        return;
    }
    let mut buf = [0u8; 16];
    let mut i = 16;
    while n > 0 {
        i -= 1;
        buf[i] = HEX[(n & 0xf) as usize];
        n >>= 4;
    }
    out.push_str(std::str::from_utf8(&buf[i..]).unwrap_or("0"));
}

/// A key of `A-Za-z0-9` the server accepts when an action spends coins (8–64 characters).
fn action_key() -> String {
    let n = js_sys::Date::now() as u64;
    let r = (js_sys::Math::random() * 1.0e9) as u64;
    let mut s = String::from("k");
    push_hex(&mut s, n);
    push_hex(&mut s, r);
    s
}

/// `{"name":"value"}` with `value` escaped. Used for the two write bodies.
fn json_field(name: &str, value: &str) -> String {
    let quoted = serde_json::to_string(value).unwrap_or_else(|_| "\"\"".to_string());
    let mut s = String::from("{\"");
    s.push_str(name);
    s.push_str("\":");
    s.push_str(&quoted);
    s.push('}');
    s
}

/// The signed-in user's own record (`GET /me`, capyweb-7hj: `{id, display_name, balance,
/// createdAt}`). Only what the header needs; the other fields are ignored.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct Me {
    /// Play-coin balance from the server ledger.
    pub balance: Option<u64>,
}

impl Me {
    pub fn from_value(v: &serde_json::Value) -> Me {
        Me {
            balance: v.get("balance").and_then(serde_json::Value::as_u64),
        }
    }
}

/// `Ok(None)` while the route does not exist (404).
pub async fn get_me(auth: Auth) -> Result<Option<Me>, ApiError> {
    match request_authed(auth, Method::GET, "/me", None, None).await {
        Ok(v) => Ok(Some(Me::from_value(&v))),
        Err(e) if e.is_not_found() => Ok(None),
        Err(e) => Err(e),
    }
}

/// Paging for a single partition. Limits are clamped to the backend's 1–100 range.
#[derive(Debug, Clone, Copy, Default)]
pub struct Paging<'a> {
    pub limit: Option<u16>,
    pub cursor: Option<&'a str>,
}

/// A merged catalog cannot accept a cursor: select a partition before paging it.
#[derive(Debug, Clone, Copy)]
pub enum CatalogQuery<'a, F> {
    All { limit: Option<u16> },
    Filtered { filter: F, paging: Paging<'a> },
}

fn bad_input(message: &str) -> ApiError {
    ApiError {
        status: 400,
        url: String::new(),
        message: message.into(),
        code: String::new(),
    }
}

pub fn validate_id(id: &str) -> Result<(), ApiError> {
    if (1..=128).contains(&id.len())
        && id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'_' | b'-'))
    {
        Ok(())
    } else {
        Err(bad_input("invalid id"))
    }
}

fn paging_query(paging: Paging<'_>) -> Vec<(&'static str, String)> {
    let mut query = Vec::new();
    if let Some(limit) = paging.limit {
        query.push(("limit", limit.clamp(1, 100).to_string()));
    }
    if let Some(cursor) = paging.cursor {
        query.push(("cursor", cursor.to_owned()));
    }
    query
}

fn catalog_query<F>(
    selection: CatalogQuery<'_, F>,
    key: &'static str,
    wire: impl FnOnce(F) -> Result<&'static str, ApiError>,
) -> Result<Vec<(&'static str, String)>, ApiError> {
    match selection {
        CatalogQuery::All { limit } => Ok(paging_query(Paging {
            limit,
            cursor: None,
        })),
        CatalogQuery::Filtered { filter, paging } => {
            let mut query = paging_query(paging);
            query.push((key, wire(filter)?.into()));
            Ok(query)
        }
    }
}

fn access_wire(access: AccessType) -> Result<&'static str, ApiError> {
    match access {
        AccessType::Public => Ok("public"),
        AccessType::Private => Ok("private"),
        AccessType::Unknown => Err(bad_input("unknown access filter")),
    }
}

fn interaction_wire(kind: InteractionType) -> Result<&'static str, ApiError> {
    match kind {
        InteractionType::Vote => Ok("vote"),
        InteractionType::Bid => Ok("bid"),
        InteractionType::Unknown => Err(bad_input("unknown interaction filter")),
    }
}

async fn list<T: DeserializeOwned>(
    path: &str,
    query: Vec<(&str, String)>,
    signal: Option<&web_sys::AbortSignal>,
) -> Result<Page<T>, ApiError> {
    let borrowed: Vec<_> = query.iter().map(|(k, v)| (*k, v.as_str())).collect();
    request(path, &borrowed, signal).await
}

/// GET a single item; 404 is an ordinary outcome, not an error.
pub async fn get_one<T: DeserializeOwned>(
    path: &str,
    signal: Option<&web_sys::AbortSignal>,
) -> Result<Option<T>, ApiError> {
    match request::<T>(path, &[], signal).await {
        Ok(v) => Ok(Some(v)),
        Err(e) if e.is_not_found() => Ok(None),
        Err(e) => Err(e),
    }
}

pub async fn list_capybaras(
    paging: Paging<'_>,
    signal: Option<&web_sys::AbortSignal>,
) -> Result<Page<Capybara>, ApiError> {
    list("/capybaras", paging_query(paging), signal).await
}

pub async fn get_capybara(
    id: &str,
    signal: Option<&web_sys::AbortSignal>,
) -> Result<Option<Capybara>, ApiError> {
    validate_id(id)?;
    get_one(&format!("/capybaras/{id}"), signal).await
}

pub async fn list_interactions(
    id: &str,
    kind: Option<InteractionType>,
    paging: Paging<'_>,
    signal: Option<&web_sys::AbortSignal>,
) -> Result<Page<Interaction>, ApiError> {
    validate_id(id)?;
    let mut query = paging_query(paging);
    if let Some(kind) = kind {
        query.push(("type", interaction_wire(kind)?.into()));
    }
    list(&format!("/capybaras/{id}/interactions"), query, signal).await
}

/// Compatibility entry point for the home page and WebMCP tool.
pub async fn list_streams(
    signal: Option<&web_sys::AbortSignal>,
) -> Result<Page<LiveStream>, ApiError> {
    list_streams_query(CatalogQuery::All { limit: None }, signal).await
}

pub async fn list_streams_query(
    selection: CatalogQuery<'_, AccessType>,
    signal: Option<&web_sys::AbortSignal>,
) -> Result<Page<LiveStream>, ApiError> {
    list(
        "/streams",
        catalog_query(selection, "access", access_wire)?,
        signal,
    )
    .await
}

pub async fn get_stream(
    id: &str,
    signal: Option<&web_sys::AbortSignal>,
) -> Result<Option<LiveStream>, ApiError> {
    validate_id(id)?;
    get_one(&format!("/streams/{id}"), signal).await
}

pub async fn list_passes(
    selection: CatalogQuery<'_, bool>,
    signal: Option<&web_sys::AbortSignal>,
) -> Result<Page<Pass>, ApiError> {
    list(
        "/nfts",
        catalog_query(selection, "forSale", |sale| {
            Ok(if sale { "1" } else { "0" })
        })?,
        signal,
    )
    .await
}

pub async fn get_pass(
    id: &str,
    signal: Option<&web_sys::AbortSignal>,
) -> Result<Option<Pass>, ApiError> {
    validate_id(id)?;
    get_one(&format!("/nfts/{id}"), signal).await
}

pub async fn list_offers(
    id: &str,
    paging: Paging<'_>,
    signal: Option<&web_sys::AbortSignal>,
) -> Result<Page<Offer>, ApiError> {
    validate_id(id)?;
    list(&format!("/nfts/{id}/offers"), paging_query(paging), signal).await
}

pub async fn list_activity(
    id: &str,
    paging: Paging<'_>,
    signal: Option<&web_sys::AbortSignal>,
) -> Result<Page<ActivityLog>, ApiError> {
    validate_id(id)?;
    list(
        &format!("/nfts/{id}/activity"),
        paging_query(paging),
        signal,
    )
    .await
}

/// The five reactions the write API accepts, in display order.
pub const REACTIONS: [&str; 5] = ["capylove", "capylike", "capywow", "capyangry", "capyfire"];

pub fn known_reaction(name: &str) -> bool {
    REACTIONS.contains(&name)
}

/// 1–280 characters and at most 800 bytes, matching the write API.
pub fn check_chat_text(text: &str) -> Result<(), ApiError> {
    let trimmed = text.trim();
    if trimmed.is_empty() || trimmed.chars().count() > 280 || text.len() > 800 {
        return Err(bad_input("message must be 1 to 280 characters"));
    }
    Ok(())
}

/// GET `/streams/{id}/chat`. In fixture mode the cursor stays on the URL so a test can tell
/// pages apart; a missing fixture file is an empty room, not an error.
pub fn chat_get_url(id: &str, cursor: Option<&str>) -> Result<String, ApiError> {
    validate_id(id)?;
    let cursor = cursor.unwrap_or("");
    if base_url() == FIXTURES {
        let mut url = String::from("/fixtures/streams/");
        url.push_str(id);
        url.push_str("/chat.json");
        if !cursor.is_empty() {
            url.push_str("?cursor=");
            url.push_str(&enc(cursor));
        }
        return Ok(url);
    }
    let path = stream_chat_path(id);
    Ok(build_url(
        base_url(),
        &path,
        &[("limit", "50"), ("cursor", cursor)],
    ))
}

fn stream_chat_path(id: &str) -> String {
    let mut path = String::from("/streams/");
    path.push_str(id);
    path.push_str("/chat");
    path
}

fn stream_reaction_path(id: &str) -> String {
    let mut path = String::from("/streams/");
    path.push_str(id);
    path.push_str("/reactions");
    path
}

fn field_str(v: &serde_json::Value, key: &str) -> String {
    v.get(key)
        .and_then(serde_json::Value::as_str)
        .unwrap_or("")
        .to_string()
}

fn chat_message(v: &serde_json::Value) -> Option<ChatMessage> {
    let id = v.get("id").and_then(serde_json::Value::as_str)?;
    if id.is_empty() {
        return None;
    }
    let display_name = v
        .get("display_name")
        .and_then(serde_json::Value::as_str)
        .map(str::to_string);
    Some(ChatMessage {
        id: id.to_string(),
        stream_id: field_str(v, "stream_id"),
        display_name,
        text: field_str(v, "text"),
        created_at: field_str(v, "createdAt"),
    })
}

pub fn parse_chat_page(v: &serde_json::Value) -> ChatPage {
    let items = v
        .get("items")
        .and_then(serde_json::Value::as_array)
        .map(|a| a.iter().filter_map(chat_message).collect())
        .unwrap_or_default();
    let reactions = v
        .get("reactions")
        .cloned()
        .and_then(|r| serde_json::from_value(r).ok());
    let cursor = v
        .get("cursor")
        .and_then(serde_json::Value::as_str)
        .filter(|s| !s.is_empty())
        .map(str::to_string);
    ChatPage {
        items,
        count: v
            .get("count")
            .and_then(serde_json::Value::as_u64)
            .unwrap_or(0) as usize,
        cursor,
        reactions,
    }
}

/// The chat page body. A missing fixture is an empty room, so the page stays calm.
pub async fn read_chat_body(
    id: &str,
    cursor: Option<&str>,
    signal: Option<&web_sys::AbortSignal>,
) -> Result<String, ApiError> {
    let url = chat_get_url(id, cursor)?;
    let (status, body) = send(&url, Method::GET, None, None, None, signal).await?;
    if (200..300).contains(&status) {
        return Ok(body);
    }
    if base_url() == FIXTURES && (status == 404 || status == 0) {
        return Ok(r#"{"items":[],"count":0}"#.into());
    }
    Err(ApiError {
        status,
        url,
        message: error_message(status, &body),
        code: error_code(&body),
    })
}

pub async fn read_chat(
    id: &str,
    cursor: Option<&str>,
    signal: Option<&web_sys::AbortSignal>,
) -> Result<ChatPage, ApiError> {
    let body = read_chat_body(id, cursor, signal).await?;
    let value = serde_json::from_str(&body).unwrap_or(serde_json::Value::Null);
    Ok(parse_chat_page(&value))
}

fn bad_shape(url: &str) -> ApiError {
    ApiError {
        status: 200,
        url: url.to_string(),
        message: "unexpected response shape".into(),
        code: String::new(),
    }
}

async fn post_json(
    auth: Auth,
    path: &str,
    body: &str,
    signal: Option<&web_sys::AbortSignal>,
) -> Result<String, ApiError> {
    let key = action_key();
    authed(auth, Method::POST, path, Some(body), Some(&key), signal)
        .await
        .map(|v| v.to_string())
}

pub async fn post_chat(
    auth: Auth,
    id: &str,
    text: &str,
    signal: Option<&web_sys::AbortSignal>,
) -> Result<ChatMessage, ApiError> {
    let path = stream_chat_path(id);
    let raw = post_chat_json(auth, id, text, signal).await?;
    let value = serde_json::from_str::<serde_json::Value>(&raw).unwrap_or(serde_json::Value::Null);
    chat_message(value.get("message").unwrap_or(&serde_json::Value::Null))
        .ok_or_else(|| bad_shape(&path))
}

pub async fn post_reaction(
    auth: Auth,
    id: &str,
    reaction: &str,
    signal: Option<&web_sys::AbortSignal>,
) -> Result<RatingCounts, ApiError> {
    let raw = post_reaction_json(auth, id, reaction, signal).await?;
    let value = serde_json::from_str::<serde_json::Value>(&raw).unwrap_or(serde_json::Value::Null);
    Ok(value
        .get("reactions")
        .cloned()
        .and_then(|r| serde_json::from_value(r).ok())
        .unwrap_or_default())
}

/// Post and return the server JSON. The page uses this so the parsed structs stay out of the wasm.
pub async fn post_chat_json(
    auth: Auth,
    id: &str,
    text: &str,
    signal: Option<&web_sys::AbortSignal>,
) -> Result<String, ApiError> {
    validate_id(id)?;
    check_chat_text(text)?;
    let path = stream_chat_path(id);
    post_json(auth, &path, &json_field("text", text), signal).await
}

pub async fn post_reaction_json(
    auth: Auth,
    id: &str,
    reaction: &str,
    signal: Option<&web_sys::AbortSignal>,
) -> Result<String, ApiError> {
    validate_id(id)?;
    if !known_reaction(reaction) {
        return Err(bad_input("unknown reaction"));
    }
    let path = stream_reaction_path(id);
    post_json(auth, &path, &json_field("reaction", reaction), signal).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn media_keys_stay_on_our_origin() {
        for key in ["media/pass-chalk.png", "media/A_1-z.webp", "media/.a"] {
            let prefix = if base_url() == FIXTURES {
                "/fixtures"
            } else {
                ""
            };
            assert_eq!(media_src(key), Some(format!("{prefix}/{key}")));
        }
        for key in [
            "https://example.com/a",
            "//host/x",
            "media/../x",
            "media/a/b",
            "",
            "media/",
            "/media/a",
            "media/a..png",
            "media/a?x",
            "media/é.png",
        ] {
            assert_eq!(media_src(key), None, "{key}");
        }
    }

    fn cam(id: &str, access: Option<AccessType>) -> LiveStream {
        serde_json::from_value(serde_json::json!({ "id": id, "title": "Cam" }))
            .map(|s: LiveStream| LiveStream {
                access_type: access,
                ..s
            })
            .unwrap()
    }

    #[test]
    fn live_src_only_for_public_cameras_with_safe_ids() {
        let prefix = if base_url() == FIXTURES {
            "/fixtures"
        } else {
            ""
        };
        assert_eq!(
            live_src(&cam("main-cam", Some(AccessType::Public))),
            Some(format!("{prefix}/live/main-cam/index.m3u8"))
        );
        for access in [Some(AccessType::Private), Some(AccessType::Unknown), None] {
            assert_eq!(live_src(&cam("wall-cam", access)), None, "{access:?}");
        }
        for id in ["", "../x", "a/b", "a?b", "a.m3u8", &"x".repeat(129)] {
            assert_eq!(live_src(&cam(id, Some(AccessType::Public))), None, "{id}");
        }
    }

    #[test]
    fn me_reads_balance() {
        let me = |s: &str| Me::from_value(&serde_json::from_str(s).unwrap()).balance;
        assert_eq!(
            me(
                r#"{"id":"u-1","display_name":"Nok","balance":42,"createdAt":"2026-09-29T00:00:00Z"}"#
            ),
            Some(42)
        );
        assert_eq!(me(r#"{"coins":7}"#), None, "only `balance` is read");
        assert_eq!(me("{}"), None);
        assert_eq!(me(r#"{"balance":-1}"#), None);
    }

    #[test]
    fn fixture_urls() {
        assert_eq!(
            build_url(FIXTURES, "/streams", &[("access", "public")]),
            "/fixtures/streams.json"
        );
        assert_eq!(
            build_url(FIXTURES, "streams/main-cam", &[]),
            "/fixtures/streams/main-cam.json"
        );
    }

    #[test]
    fn api_urls_drop_empty_query_values() {
        assert_eq!(build_url("/api/", "/streams", &[]), "/api/streams");
        assert_eq!(
            build_url("/api", "/streams", &[("access", "public"), ("cursor", "")]),
            "/api/streams?access=public"
        );
    }

    #[test]
    fn query_values_are_percent_encoded() {
        assert_eq!(
            build_url("/api", "streams", &[("cursor", "a b&c=d/é")]),
            "/api/streams?cursor=a%20b%26c%3Dd%2F%C3%A9"
        );
    }

    #[test]
    fn error_body_message_is_used() {
        assert_eq!(error_message(400, r#"{"error":"bad id"}"#), "bad id");
        assert_eq!(error_message(502, "<html>"), "request failed with 502");
    }

    #[test]
    fn html_on_200_is_an_error() {
        let r: Result<Page<LiveStream>, _> = decode(200, "/api/streams", "<!DOCTYPE html>");
        assert_eq!(r.unwrap_err().message, "expected JSON, got something else");
    }

    #[test]
    fn non_2xx_carries_status() {
        let r: Result<Page<LiveStream>, _> =
            decode(404, "/api/streams/x", r#"{"error":"stream not found"}"#);
        let e = r.unwrap_err();
        assert!(e.is_not_found());
        assert_eq!(e.message, "stream not found");
    }

    #[test]
    fn every_route_has_fixture_and_api_urls() {
        for path in [
            "/capybaras",
            "/capybaras/magnus",
            "/capybaras/magnus/interactions",
            "/streams",
            "/streams/main-cam",
            "/nfts",
            "/nfts/capy-1234",
            "/nfts/capy-1234/offers",
            "/nfts/capy-1234/activity",
        ] {
            let query = [("limit", "2"), ("cursor", "a b&c=d/é")];
            assert_eq!(
                build_url(FIXTURES, path, &query),
                format!("/fixtures{path}.json")
            );
            assert_eq!(build_url("/api", path, &[]), format!("/api{path}"));
            assert_eq!(
                build_url("/api", path, &query),
                format!("/api{path}?limit=2&cursor=a%20b%26c%3Dd%2F%C3%A9")
            );
        }
    }

    #[test]
    fn ids_match_the_backend_ascii_contract() {
        for good in ["a", "ABC_123-z", &"x".repeat(128)] {
            assert!(validate_id(good).is_ok());
        }
        for bad in [
            "",
            "../x",
            "x/y",
            "x#y",
            "x?y",
            "x%2fy",
            "a b",
            "é",
            "a\n",
            &"x".repeat(129),
        ] {
            let err = validate_id(bad).unwrap_err();
            assert_eq!(err.status, 400);
            assert!(err.url.is_empty());
        }
    }

    #[test]
    fn typed_filters_and_limits_match_backend_queries() {
        assert_eq!(
            paging_query(Paging {
                limit: Some(0),
                cursor: None
            }),
            [("limit", "1".into())]
        );
        assert_eq!(
            paging_query(Paging {
                limit: Some(101),
                cursor: Some("next")
            }),
            [("limit", "100".into()), ("cursor", "next".into())]
        );
        assert!(paging_query(Paging::default()).is_empty());
        for (filter, value) in [
            (AccessType::Public, "public"),
            (AccessType::Private, "private"),
        ] {
            assert_eq!(
                catalog_query(
                    CatalogQuery::Filtered {
                        filter,
                        paging: Paging::default()
                    },
                    "access",
                    access_wire
                )
                .unwrap(),
                [("access", value.into())]
            );
        }
        assert_eq!(
            catalog_query(
                CatalogQuery::<AccessType>::All { limit: Some(10) },
                "access",
                access_wire
            )
            .unwrap(),
            [("limit", "10".into())]
        );
        assert_eq!(access_wire(AccessType::Unknown).unwrap_err().status, 400);
        assert_eq!(
            interaction_wire(InteractionType::Unknown)
                .unwrap_err()
                .status,
            400
        );
        assert_eq!(interaction_wire(InteractionType::Vote).unwrap(), "vote");
        assert_eq!(interaction_wire(InteractionType::Bid).unwrap(), "bid");
    }

    // Invalid inputs must complete on the first poll without touching browser fetch APIs.
    #[test]
    fn invalid_ids_never_make_a_request() {
        use std::{
            future::Future,
            pin::pin,
            task::{Context, Poll, Waker},
        };
        fn rejected<T>(future: impl Future<Output = Result<T, ApiError>>) {
            let mut future = pin!(future);
            let mut cx = Context::from_waker(Waker::noop());
            match future.as_mut().poll(&mut cx) {
                Poll::Ready(Err(error)) => assert_eq!(error.status, 400),
                _ => panic!("invalid input did not immediately return 400"),
            }
        }
        rejected(get_capybara("../x", None));
        rejected(get_stream("../x", None));
        rejected(get_pass("../x", None));
        rejected(list_interactions("../x", None, Paging::default(), None));
        rejected(list_offers("../x", Paging::default(), None));
        rejected(list_activity("../x", Paging::default(), None));
        rejected(list_streams_query(
            CatalogQuery::Filtered {
                filter: AccessType::Unknown,
                paging: Paging::default(),
            },
            None,
        ));
        rejected(list_interactions(
            "magnus",
            Some(InteractionType::Unknown),
            Paging::default(),
            None,
        ));
        rejected(read_chat("../x", None, None));
    }

    #[test]
    fn error_code_is_the_stable_field() {
        assert_eq!(
            error_code(r#"{"error":"one message every 2 seconds, please","code":"slow_down"}"#),
            "slow_down"
        );
        assert_eq!(error_code("nope"), "");
        let r: Result<ChatPage, _> = decode(
            409,
            "/api/streams/main-cam/chat",
            r#"{"error":"choose a display name first (PUT /me)","code":"display_name_required"}"#,
        );
        let e = r.unwrap_err();
        assert_eq!(e.status, 409);
        assert_eq!(e.code, "display_name_required");
    }

    #[test]
    fn chat_text_and_reaction_names() {
        assert!(check_chat_text("hello capy").is_ok());
        assert!(check_chat_text("  ").is_err());
        assert!(check_chat_text(&"x".repeat(281)).is_err());
        assert!(check_chat_text(&"x".repeat(801)).is_err());
        assert!(known_reaction("capylove"));
        assert!(!known_reaction("tip"));
        assert!(!known_reaction("capylove "));
    }

    #[test]
    fn chat_fixture_url_keeps_the_cursor() {
        assert_eq!(
            chat_get_url("main-cam", None).unwrap(),
            "/fixtures/streams/main-cam/chat.json"
        );
        assert_eq!(
            chat_get_url("main-cam", Some("")).unwrap(),
            "/fixtures/streams/main-cam/chat.json"
        );
        assert_eq!(
            chat_get_url("main-cam", Some("a b")).unwrap(),
            "/fixtures/streams/main-cam/chat.json?cursor=a%20b"
        );
        assert!(chat_get_url("../x", None).is_err());
    }

    #[test]
    fn chat_page_decodes_reactions_only_on_the_first_page() {
        let page = parse_chat_page(
            &serde_json::from_str(
                r#"{"items":[{"id":"m1","stream_id":"main-cam","display_name":"Capy Fan","text":"hello","createdAt":"2026-09-29T00:00:00Z"}],"count":1,"reactions":{"capylove":3,"capylike":0,"capywow":1,"capyangry":0,"capyfire":0}}"#,
            )
            .unwrap(),
        );
        assert_eq!(page.items[0].text, "hello");
        assert_eq!(page.items[0].display_name.as_deref(), Some("Capy Fan"));
        assert_eq!(page.reactions.unwrap().capylove, Some(3));
        let older = parse_chat_page(
            &serde_json::from_str(r#"{"items":[],"count":0,"cursor":"next"}"#).unwrap(),
        );
        assert!(older.reactions.is_none());
        assert_eq!(older.cursor.as_deref(), Some("next"));
        assert!(chat_message(&serde_json::json!({})).is_none());
    }
}
