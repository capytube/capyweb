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
    AccessType, ActivityLog, Capybara, Interaction, InteractionType, LiveStream, Offer, Page, Pass,
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

/// A non-2xx response, or a 2xx that was not JSON (usually the SPA's index.html).
#[derive(Debug, Clone, PartialEq)]
pub struct ApiError {
    pub status: u16,
    pub url: String,
    pub message: String,
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

pub fn decode<T: DeserializeOwned>(status: u16, url: &str, body: &str) -> Result<T, ApiError> {
    let err = |message: String| ApiError {
        status,
        url: url.to_owned(),
        message,
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
    let (status, body) = send(&url, Method::GET, None, None, signal).await?;
    decode(status, &url, &body)
}

/// One fetch: status and body text. Every API call goes through here.
async fn send(
    url: &str,
    method: Method,
    token: Option<&str>,
    body: Option<&str>,
    signal: Option<&web_sys::AbortSignal>,
) -> Result<(u16, String), ApiError> {
    let fail = |e: gloo_net::Error| ApiError {
        status: 0,
        url: url.to_owned(),
        message: format!("network error: {e}"),
    };
    let mut req = gloo_net::http::RequestBuilder::new(url)
        .method(method)
        .header("accept", "application/json")
        .abort_signal(signal);
    if let Some(token) = token {
        req = req.header("authorization", &format!("Bearer {token}"));
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
pub async fn request_authed<T: DeserializeOwned>(
    auth: Auth,
    method: Method,
    path: &str,
    body: Option<&str>,
    signal: Option<&web_sys::AbortSignal>,
) -> Result<T, ApiError> {
    let url = build_url(base_url(), path, &[]);
    let mut retried = false;
    loop {
        let Some(token) = auth.access_token().await else {
            return Err(ApiError {
                status: 401,
                url,
                message: "sign in first".into(),
            });
        };
        let (status, text) = send(&url, method.clone(), Some(&token), body, signal).await?;
        if status == 401 && !retried {
            retried = true;
            if auth.refresh().await {
                continue;
            }
        }
        return decode(status, &url, &text);
    }
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
    }
}
