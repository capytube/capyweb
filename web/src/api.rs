//! Typed client for the capyweb HTTP API. Port of src/api/http.ts: same envelope, same errors,
//! 404 on a single item is `Ok(None)` rather than a failure.
//!
//! The base URL is fixed at build time from CAPYWEB_API_BASE:
//!   unset        -> "fixtures": static JSON under /fixtures, no network beyond this server
//!   "/api"       -> same-origin, as CloudFront will route it (and `trunk serve --proxy-*` locally)
//!   "https://…"  -> direct, which needs the origin in the API's CORS allow-list
//!
//! Auth is a seam here exactly as in http.ts: `authenticated` requests need a token provider,
//! which the Cognito task supplies (docs/WASM_PLAN.md section 3).

use serde::de::DeserializeOwned;

use crate::domain::{LiveStream, Page};

pub const FIXTURES: &str = "fixtures";

pub fn base_url() -> &'static str {
    option_env!("CAPYWEB_API_BASE").unwrap_or(FIXTURES)
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

fn enc(s: &str) -> String {
    String::from(js_sys::encode_uri_component(s))
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

pub async fn request<T: DeserializeOwned>(
    path: &str,
    query: &[(&str, &str)],
) -> Result<T, ApiError> {
    let url = build_url(base_url(), path, query);
    let res = gloo_net::http::Request::get(&url)
        .header("accept", "application/json")
        .send()
        .await
        .map_err(|e| ApiError {
            status: 0,
            url: url.clone(),
            message: format!("network error: {e}"),
        })?;
    let status = res.status();
    let body = res.text().await.unwrap_or_default();
    decode(status, &url, &body)
}

/// GET a single item; 404 is an ordinary outcome, not an error.
pub async fn get_one<T: DeserializeOwned>(path: &str) -> Result<Option<T>, ApiError> {
    match request::<T>(path, &[]).await {
        Ok(v) => Ok(Some(v)),
        Err(e) if e.is_not_found() => Ok(None),
        Err(e) => Err(e),
    }
}

pub async fn list_streams() -> Result<Page<LiveStream>, ApiError> {
    request("/streams", &[]).await
}

pub async fn get_stream(id: &str) -> Result<Option<LiveStream>, ApiError> {
    get_one(&format!("/streams/{}", enc(id))).await
}

#[cfg(test)]
mod tests {
    use super::*;

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
}
