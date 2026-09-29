//! The pure half of sign-in (W11, docs/WASM_PLAN.md section 3): PKCE, base64url, the URLs and
//! form bodies for Cognito's managed login, the callback checks, JWT claims and the refresh
//! schedule. No browser calls, so all of it is tested natively with `cargo test`. The browser
//! half (random bytes, SHA-256, storage, fetch, the Leptos state) is in `auth.rs`.

use serde_json::Value;

use crate::api::enc;

/// Refresh this long before the access token expires.
pub const REFRESH_LEAD_MS: u64 = 60_000;
/// The path Cognito sends the browser back to. Registered in the app client's callback URLs.
pub const CALLBACK_PATH: &str = "/auth/callback";

const B64: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/// base64url without padding (RFC 4648 section 5), as PKCE and JWTs use it.
pub fn b64url(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(bytes.len().div_ceil(3) * 4);
    for c in bytes.chunks(3) {
        let n = (c[0] as u32) << 16
            | (*c.get(1).unwrap_or(&0) as u32) << 8
            | *c.get(2).unwrap_or(&0) as u32;
        for i in 0..=c.len() {
            out.push(B64[(n >> (18 - 6 * i)) as usize & 63] as char);
        }
    }
    out
}

/// Decode base64url, with or without padding. `None` on any other character.
pub fn b64url_decode(s: &str) -> Option<Vec<u8>> {
    let s = s.trim_end_matches('=');
    if s.len() % 4 == 1 {
        return None;
    }
    let mut out = Vec::with_capacity(s.len() * 3 / 4);
    let (mut acc, mut bits) = (0u32, 0u32);
    for b in s.bytes() {
        let v = B64.iter().position(|&x| x == b)? as u32;
        acc = (acc << 6 | v) & 0xFFFF;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push((acc >> bits) as u8);
        }
    }
    Some(out)
}

/// The PKCE challenge for a verifier, given SHA-256 of the verifier's ASCII text (RFC 7636
/// section 4.2). The browser computes the digest with SubtleCrypto.
pub fn pkce_challenge(sha256_of_verifier: &[u8]) -> String {
    b64url(sha256_of_verifier)
}

/// A verifier is 43-128 characters of `[A-Za-z0-9-._~]` (RFC 7636 section 4.1). Ours are 32
/// random bytes in base64url: 43 characters.
pub fn valid_verifier(v: &str) -> bool {
    (43..=128).contains(&v.len())
        && v.bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'-' | b'.' | b'_' | b'~'))
}

/// Where the managed login lives and which client the app is. Loaded at run time from
/// `/config.json` (see `parse_config`), so one build serves every stage.
#[derive(Clone, Debug, PartialEq)]
pub struct AuthConfig {
    /// `https://<host>`, no path, no trailing slash.
    pub domain: String,
    pub client_id: String,
}

/// `{"auth": {"domain": "https://…", "client_id": "…"}}`. Anything else, including
/// `{"auth": null}`, an HTML page or a malformed value, means "no sign-in": the app then renders
/// no sign-in control. The domain must be plain `https://` plus a host name, so a tampered file
/// cannot point the token exchange at a path, a port or cleartext.
pub fn parse_config(json: &str) -> Option<AuthConfig> {
    let v: Value = serde_json::from_str(json).ok()?;
    let auth = v.get("auth")?;
    let domain = auth.get("domain")?.as_str()?;
    let client_id = auth.get("client_id")?.as_str()?;
    let host = domain.strip_prefix("https://")?.trim_end_matches('/');
    let host_ok = (3..=253).contains(&host.len())
        && host.contains('.')
        && !host.contains("..")
        && !host.starts_with(['.', '-'])
        && !host.ends_with(['.', '-'])
        && host
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || matches!(b, b'.' | b'-'));
    let id_ok = (1..=128).contains(&client_id.len())
        && client_id.bytes().all(|b| b.is_ascii_alphanumeric());
    (host_ok && id_ok).then(|| AuthConfig {
        domain: ["https://", host].concat(),
        client_id: client_id.to_owned(),
    })
}

pub fn authorize_url(c: &AuthConfig, redirect_uri: &str, challenge: &str, state: &str) -> String {
    at(
        c,
        "/oauth2/authorize?",
        &[
            ("response_type", "code"),
            ("client_id", &c.client_id),
            ("redirect_uri", redirect_uri),
            ("scope", "openid email"),
            ("code_challenge_method", "S256"),
            ("code_challenge", challenge),
            ("state", state),
        ],
    )
}

pub fn token_url(c: &AuthConfig) -> String {
    at(c, "/oauth2/token", &[])
}

pub fn revoke_url(c: &AuthConfig) -> String {
    at(c, "/oauth2/revoke", &[])
}

/// Cognito's `/logout` ends the managed-login session cookie, then returns to `logout_uri`,
/// which must be one of the app client's sign-out URLs.
pub fn logout_url(c: &AuthConfig, logout_uri: &str) -> String {
    at(
        c,
        "/logout?",
        &[("client_id", &c.client_id), ("logout_uri", logout_uri)],
    )
}

/// `domain + path + form(pairs)`. Built by pushing, not `format!`: this is first-load code.
fn at(c: &AuthConfig, path: &str, pairs: &[(&str, &str)]) -> String {
    c.domain.clone() + path + &form(pairs)
}

fn form(pairs: &[(&str, &str)]) -> String {
    let mut out = String::new();
    for (k, v) in pairs {
        if !out.is_empty() {
            out.push('&');
        }
        out.push_str(k);
        out.push('=');
        out.push_str(&enc(v));
    }
    out
}

/// The code exchange, as a public client: no secret, the verifier proves it is the same app.
pub fn code_body(c: &AuthConfig, code: &str, redirect_uri: &str, verifier: &str) -> String {
    form(&[
        ("grant_type", "authorization_code"),
        ("client_id", &c.client_id),
        ("code", code),
        ("redirect_uri", redirect_uri),
        ("code_verifier", verifier),
    ])
}

pub fn refresh_body(c: &AuthConfig, refresh_token: &str) -> String {
    form(&[
        ("grant_type", "refresh_token"),
        ("client_id", &c.client_id),
        ("refresh_token", refresh_token),
    ])
}

pub fn revoke_body(c: &AuthConfig, refresh_token: &str) -> String {
    form(&[("token", refresh_token), ("client_id", &c.client_id)])
}

/// Something the user tried to do before signing in, e.g. `{kind: "vote", data: "…"}`. The page
/// that owns the action replays it after the callback (`Auth::take_pending`).
#[derive(Clone, Debug, PartialEq)]
pub struct PendingAction {
    pub kind: String,
    pub data: String,
}

impl PendingAction {
    fn valid(&self) -> bool {
        (1..=32).contains(&self.kind.len())
            && self.data.len() <= 1024
            && !self.kind.contains('\n')
            && !self.data.contains('\n')
    }
}

/// What the app keeps in sessionStorage between the redirect and the callback.
#[derive(Clone, Debug, PartialEq)]
pub struct Flow {
    pub state: String,
    pub verifier: String,
    pub return_to: String,
    pub pending: Option<PendingAction>,
}

impl Flow {
    /// One field per line. None of them can hold a newline: state and verifier are base64url,
    /// the path has no control characters and a pending action with one is dropped.
    pub fn encode(&self) -> String {
        let (kind, data) = self
            .pending
            .as_ref()
            .map_or(("", ""), |p| (p.kind.as_str(), p.data.as_str()));
        [
            self.state.as_str(),
            &self.verifier,
            &self.return_to,
            kind,
            data,
        ]
        .join("\n")
    }

    pub fn decode(s: &str) -> Option<Flow> {
        let mut f = s.splitn(5, '\n');
        let (state, verifier, return_to, kind, data) =
            (f.next()?, f.next()?, f.next()?, f.next()?, f.next()?);
        Some(Flow {
            state: state.into(),
            verifier: verifier.into(),
            return_to: safe_return_path(return_to),
            pending: clean_pending(Some(PendingAction {
                kind: kind.into(),
                data: data.into(),
            })),
        })
    }
}

/// Why a callback was refused. Each maps to one plain sentence on the callback page.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum CallbackError {
    /// Cognito returned `error=…` (the user cancelled, or the request was refused).
    Refused,
    /// No sign-in was started in this tab, or its record was already used.
    NoFlow,
    /// `state` does not match the one this tab sent: possibly a forged or replayed link.
    StateMismatch,
    /// The token exchange failed.
    Exchange,
}

impl CallbackError {
    pub fn message(self) -> &'static str {
        match self {
            CallbackError::Refused => "Sign-in was cancelled.",
            CallbackError::NoFlow => {
                "This sign-in link has expired or was opened in another tab. Please sign in again."
            }
            CallbackError::StateMismatch => {
                "This sign-in did not start in this tab, so it was refused. Please sign in again."
            }
            CallbackError::Exchange => "Sign-in could not be finished. Please try again.",
        }
    }
}

/// Compare without stopping at the first difference.
fn same(a: &str, b: &str) -> bool {
    a.len() == b.len() && a.bytes().zip(b.bytes()).fold(0u8, |d, (x, y)| d | (x ^ y)) == 0
}

/// Check a callback before anything is sent to Cognito. Returns the code to exchange.
pub fn check_callback<'a>(
    flow: Option<&Flow>,
    code: Option<&'a str>,
    state: Option<&str>,
    error: Option<&str>,
) -> Result<&'a str, CallbackError> {
    if error.is_some() {
        return Err(CallbackError::Refused);
    }
    let flow = flow
        .filter(|f| f.state.len() >= 22 && valid_verifier(&f.verifier))
        .ok_or(CallbackError::NoFlow)?;
    match state {
        Some(s) if same(s, &flow.state) => {}
        _ => return Err(CallbackError::StateMismatch),
    }
    code.filter(|c| (1..=512).contains(&c.len()))
        .ok_or(CallbackError::NoFlow)
}

/// Only a path on this site: starts with one `/`, no `//` or `\` (which browsers treat as
/// another host), no control characters, and never the callback itself.
pub fn safe_return_path(p: &str) -> String {
    let ok = p.starts_with('/')
        && !p.starts_with("//")
        && !p.contains('\\')
        && p.len() <= 512
        && !p.bytes().any(|b| b.is_ascii_control())
        && !p.starts_with(CALLBACK_PATH);
    if ok { p } else { "/" }.to_owned()
}

/// Keep a pending action only if it is well formed.
pub fn clean_pending(p: Option<PendingAction>) -> Option<PendingAction> {
    p.filter(PendingAction::valid)
}

pub struct TokenResponse {
    pub access_token: String,
    pub id_token: Option<String>,
    pub refresh_token: Option<String>,
    pub expires_in: Option<u64>,
}

fn text(v: &Value, key: &str) -> Option<String> {
    v.get(key)?.as_str().map(str::to_owned)
}

/// The token endpoint's JSON. `None` without an access token.
pub fn parse_tokens(body: &str) -> Option<TokenResponse> {
    let v: Value = serde_json::from_str(body).ok()?;
    Some(TokenResponse {
        access_token: text(&v, "access_token")?,
        id_token: text(&v, "id_token"),
        refresh_token: text(&v, "refresh_token"),
        expires_in: v.get("expires_in").and_then(Value::as_u64),
    })
}

/// The claims the app reads. The signature is not checked here: the API Gateway authorizer
/// verifies every token it is sent. The client only schedules refreshes and shows the email.
#[derive(Clone, Debug, PartialEq)]
pub struct Claims {
    pub sub: String,
    pub exp: u64,
    pub iat: Option<u64>,
    pub email: Option<String>,
}

pub fn jwt_claims(jwt: &str) -> Option<Claims> {
    let mut parts = jwt.split('.');
    let (_, payload, _) = (parts.next()?, parts.next()?, parts.next()?);
    if parts.next().is_some() {
        return None;
    }
    let v: Value = serde_json::from_slice(&b64url_decode(payload)?).ok()?;
    Some(Claims {
        sub: text(&v, "sub")?,
        exp: v.get("exp")?.as_u64()?,
        iat: v.get("iat").and_then(Value::as_u64),
        email: text(&v, "email"),
    })
}

/// How long the token lives, in seconds, measured on the issuer's clock (`exp - iat`), or
/// `expires_in` from the token response when `iat` is missing.
pub fn lifetime_s(c: &Claims, expires_in: Option<u64>) -> u64 {
    match c.iat {
        Some(iat) if c.exp > iat => c.exp - iat,
        _ => expires_in.unwrap_or(0),
    }
}

/// When, on this device's clock, to refresh: one minute before expiry (half the lifetime for a
/// token shorter than two minutes). Counted from when the token arrived, not by comparing `exp`
/// with the device clock, so a phone whose clock is off by an hour neither refreshes in a loop
/// nor lets a token lapse.
pub fn refresh_at_ms(received_ms: u64, lifetime_s: u64) -> u64 {
    let life = lifetime_s * 1000;
    received_ms + life - REFRESH_LEAD_MS.min(life / 2)
}

/// Milliseconds from `now_ms` until `refresh_at_ms`, never negative.
pub fn refresh_delay_ms(refresh_at_ms: u64, now_ms: u64) -> u64 {
    refresh_at_ms.saturating_sub(now_ms)
}

/// True when a request should refresh first rather than send a token about to lapse.
pub fn needs_refresh(refresh_at_ms: u64, now_ms: u64) -> bool {
    now_ms >= refresh_at_ms
}

#[cfg(test)]
mod tests {
    use super::*;

    // RFC 7636 appendix B.
    const RFC_BYTES: [u8; 32] = [
        116, 24, 223, 180, 151, 153, 224, 37, 79, 250, 96, 125, 216, 173, 187, 186, 22, 212, 37,
        77, 105, 214, 191, 240, 91, 88, 5, 88, 83, 132, 141, 121,
    ];
    const RFC_VERIFIER: &str = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    const RFC_DIGEST: [u8; 32] = [
        19, 211, 30, 150, 26, 26, 216, 236, 47, 22, 177, 12, 76, 152, 46, 8, 118, 168, 120, 173,
        109, 241, 68, 86, 110, 225, 137, 74, 203, 112, 249, 195,
    ];
    const RFC_CHALLENGE: &str = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

    #[test]
    fn pkce_matches_rfc_7636_appendix_b() {
        assert_eq!(b64url(&RFC_BYTES), RFC_VERIFIER);
        assert!(valid_verifier(RFC_VERIFIER));
        assert_eq!(pkce_challenge(&RFC_DIGEST), RFC_CHALLENGE);
        assert_eq!(b64url_decode(RFC_CHALLENGE).unwrap(), RFC_DIGEST);
    }

    #[test]
    fn base64url_round_trips_every_length() {
        // RFC 4648 section 10 vectors, in the URL alphabet without padding.
        for (plain, coded) in [
            ("", ""),
            ("f", "Zg"),
            ("fo", "Zm8"),
            ("foo", "Zm9v"),
            ("foob", "Zm9vYg"),
            ("fooba", "Zm9vYmE"),
            ("foobar", "Zm9vYmFy"),
        ] {
            assert_eq!(b64url(plain.as_bytes()), coded);
            assert_eq!(b64url_decode(coded).unwrap(), plain.as_bytes());
        }
        let all: Vec<u8> = (0..=255).collect();
        let coded = b64url(&all);
        assert!(!coded.contains(['+', '/', '=']));
        assert_eq!(b64url_decode(&coded).unwrap(), all);
        assert_eq!(b64url_decode("Zg==").unwrap(), b"f");
        for bad in ["Z", "Zm9v+", "a/b", "ab c", "é"] {
            assert_eq!(b64url_decode(bad), None, "{bad}");
        }
    }

    #[test]
    fn verifier_rules() {
        assert!(!valid_verifier(&"a".repeat(42)));
        assert!(valid_verifier(&"a".repeat(128)));
        assert!(!valid_verifier(&"a".repeat(129)));
        assert!(!valid_verifier(&format!("{}+", "a".repeat(43))));
    }

    fn cfg() -> AuthConfig {
        parse_config(
            r#"{"auth":{"domain":"https://capyapp-capyweb-dev.auth.ap-southeast-1.amazoncognito.com/","client_id":"abc123"}}"#,
        )
        .unwrap()
    }

    #[test]
    fn config_is_strict() {
        assert_eq!(
            cfg().domain,
            "https://capyapp-capyweb-dev.auth.ap-southeast-1.amazoncognito.com"
        );
        for bad in [
            "",
            "{}",
            r#"{"auth":null}"#,
            "<!DOCTYPE html>",
            r#"{"auth":{"domain":"http://x.example","client_id":"a"}}"#,
            r#"{"auth":{"domain":"https://x.example/path","client_id":"a"}}"#,
            r#"{"auth":{"domain":"https://x.example:8443","client_id":"a"}}"#,
            r#"{"auth":{"domain":"https://user@x.example","client_id":"a"}}"#,
            r#"{"auth":{"domain":"https://X.example","client_id":"a"}}"#,
            r#"{"auth":{"domain":"https://localhost","client_id":"a"}}"#,
            r#"{"auth":{"domain":"https://.x.example","client_id":"a"}}"#,
            r#"{"auth":{"domain":"https://x..example","client_id":"a"}}"#,
            r#"{"auth":{"domain":"https://x.example","client_id":""}}"#,
            r#"{"auth":{"domain":"https://x.example","client_id":"a&b=c"}}"#,
            r#"{"auth":{"domain":"https://x.example"}}"#,
        ] {
            assert_eq!(parse_config(bad), None, "{bad}");
        }
    }

    #[test]
    fn urls_and_bodies() {
        let c = cfg();
        let d = &c.domain;
        assert_eq!(
            authorize_url(&c, "http://127.0.0.1:8791/auth/callback", "ch-_", "st"),
            format!("{d}/oauth2/authorize?response_type=code&client_id=abc123&redirect_uri=http%3A%2F%2F127.0.0.1%3A8791%2Fauth%2Fcallback&scope=openid%20email&code_challenge_method=S256&code_challenge=ch-_&state=st")
        );
        assert_eq!(token_url(&c), format!("{d}/oauth2/token"));
        assert_eq!(revoke_url(&c), format!("{d}/oauth2/revoke"));
        assert_eq!(
            logout_url(&c, "https://dev.capytube.xyz/"),
            format!("{d}/logout?client_id=abc123&logout_uri=https%3A%2F%2Fdev.capytube.xyz%2F")
        );
        assert_eq!(
            code_body(&c, "a b", "https://x.example/auth/callback", RFC_VERIFIER),
            format!("grant_type=authorization_code&client_id=abc123&code=a%20b&redirect_uri=https%3A%2F%2Fx.example%2Fauth%2Fcallback&code_verifier={RFC_VERIFIER}")
        );
        assert_eq!(
            refresh_body(&c, "r.t+/="),
            "grant_type=refresh_token&client_id=abc123&refresh_token=r.t%2B%2F%3D"
        );
        assert_eq!(revoke_body(&c, "rt"), "token=rt&client_id=abc123");
    }

    fn flow() -> Flow {
        Flow {
            state: "s".repeat(22),
            verifier: RFC_VERIFIER.into(),
            return_to: "/play".into(),
            pending: None,
        }
    }

    #[test]
    fn callback_state_checks() {
        let f = flow();
        let st = f.state.clone();
        assert_eq!(
            check_callback(Some(&f), Some("code1"), Some(&st), None),
            Ok("code1")
        );
        assert_eq!(
            check_callback(Some(&f), Some("code1"), Some("t".repeat(22).as_str()), None),
            Err(CallbackError::StateMismatch)
        );
        assert_eq!(
            check_callback(Some(&f), Some("code1"), Some(&st[1..]), None),
            Err(CallbackError::StateMismatch)
        );
        assert_eq!(
            check_callback(Some(&f), Some("code1"), None, None),
            Err(CallbackError::StateMismatch)
        );
        assert_eq!(
            check_callback(None, Some("code1"), Some(&st), None),
            Err(CallbackError::NoFlow)
        );
        assert_eq!(
            check_callback(Some(&f), None, Some(&st), None),
            Err(CallbackError::NoFlow)
        );
        assert_eq!(
            check_callback(Some(&f), Some("code1"), Some(&st), Some("access_denied")),
            Err(CallbackError::Refused)
        );
        // A stored record with an empty state must not match an empty state in the URL.
        let empty = Flow {
            state: String::new(),
            ..flow()
        };
        assert_eq!(
            check_callback(Some(&empty), Some("c"), Some(""), None),
            Err(CallbackError::NoFlow)
        );
    }

    #[test]
    fn flow_record_round_trips() {
        let mut f = flow();
        assert_eq!(Flow::decode(&f.encode()), Some(f.clone()));
        f.pending = Some(PendingAction {
            kind: "vote".into(),
            data: r#"{"option":"watermelon","n":2}"#.into(),
        });
        assert_eq!(Flow::decode(&f.encode()), Some(f.clone()));
        // A tampered record cannot smuggle an off-site return path.
        let bad = f.encode().replace("/play", "//evil.example");
        assert_eq!(Flow::decode(&bad).unwrap().return_to, "/");
        assert_eq!(Flow::decode("only\nthree\nlines"), None);
    }

    #[test]
    fn token_response() {
        let t = parse_tokens(
            r#"{"access_token":"a","id_token":"i","refresh_token":"r","expires_in":900,"token_type":"Bearer"}"#,
        )
        .unwrap();
        assert_eq!(
            (
                t.access_token.as_str(),
                t.id_token.as_deref(),
                t.refresh_token.as_deref(),
                t.expires_in
            ),
            ("a", Some("i"), Some("r"), Some(900))
        );
        let rotated_out = parse_tokens(r#"{"access_token":"a"}"#).unwrap();
        assert_eq!(rotated_out.refresh_token, None);
        assert!(parse_tokens(r#"{"error":"invalid_grant"}"#).is_none());
        assert!(parse_tokens("<html>").is_none());
    }

    #[test]
    fn return_paths_stay_on_this_site() {
        for good in ["/", "/play?capy=magnus", "/shop/capy-1234"] {
            assert_eq!(safe_return_path(good), good);
        }
        for bad in [
            "",
            "play",
            "//evil.example/x",
            "/\\evil.example",
            "https://evil.example/",
            "/auth/callback?code=x",
            "/a\nb",
        ] {
            assert_eq!(safe_return_path(bad), "/", "{bad:?}");
        }
    }

    #[test]
    fn pending_actions_are_bounded() {
        let ok = PendingAction {
            kind: "vote".into(),
            data: "x".repeat(1024),
        };
        assert_eq!(clean_pending(Some(ok.clone())), Some(ok));
        for bad in [
            PendingAction {
                kind: String::new(),
                data: String::new(),
            },
            PendingAction {
                kind: "k".repeat(33),
                data: String::new(),
            },
            PendingAction {
                kind: "vote".into(),
                data: "x".repeat(1025),
            },
            PendingAction {
                kind: "vote".into(),
                data: "a\nb".into(),
            },
        ] {
            assert_eq!(clean_pending(Some(bad)), None);
        }
    }

    fn jwt(payload: &str) -> String {
        format!("eyJhbGciOiJSUzI1NiJ9.{}.c2ln", b64url(payload.as_bytes()))
    }

    #[test]
    fn jwt_exp_parsing() {
        let c = jwt_claims(&jwt(
            r#"{"sub":"u-1","exp":1790700900,"iat":1790700000,"email":"a@b.example","token_use":"id"}"#,
        ))
        .unwrap();
        assert_eq!(c.sub, "u-1");
        assert_eq!(c.exp, 1_790_700_900);
        assert_eq!(c.email.as_deref(), Some("a@b.example"));
        assert_eq!(lifetime_s(&c, Some(3600)), 900, "exp - iat wins");
        let no_iat = jwt_claims(&jwt(r#"{"sub":"u","exp":5}"#)).unwrap();
        assert_eq!(lifetime_s(&no_iat, Some(900)), 900);
        assert_eq!(lifetime_s(&no_iat, None), 0);
        for bad in [
            "".to_string(),
            "a.b".into(),
            "a.b.c.d".into(),
            jwt(r#"{"sub":"u"}"#),
            jwt("not json"),
            "h.!!!.s".into(),
        ] {
            assert_eq!(jwt_claims(&bad), None, "{bad}");
        }
    }

    #[test]
    fn refresh_schedule() {
        let t0 = 1_000_000;
        // A 15-minute token refreshes after 14 minutes.
        let at = refresh_at_ms(t0, 900);
        assert_eq!(at, t0 + 840_000);
        assert_eq!(refresh_delay_ms(at, t0), 840_000);
        assert_eq!(refresh_delay_ms(at, at), 0);
        assert_eq!(refresh_delay_ms(at, t0 + 10_000_000), 0, "never negative");
        assert!(!needs_refresh(at, at - 1));
        assert!(needs_refresh(at, at));
        // A token shorter than two minutes refreshes at half its life, and a request made
        // before then does not refresh first.
        let short = refresh_at_ms(t0, 4);
        assert_eq!(short, t0 + 2_000);
        assert!(!needs_refresh(short, t0 + 1_999));
        assert_eq!(refresh_at_ms(t0, 60), t0 + 30_000);
        assert_eq!(refresh_at_ms(t0, 0), t0);
    }
}
