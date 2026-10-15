//! Sign-in with Cognito managed login (W11, docs/WASM_PLAN.md section 3): the auth seam other
//! pages use, the token store, refresh and sign-out, and the `/auth/callback` page. The pure
//! logic is in `oauth.rs`; this file is the browser and Leptos half.
//!
//! - **Configuration** is read at run time from `/config.json` (`oauth::parse_config`). The
//!   repository ships `{"auth": null}`, so a build renders no sign-in control anywhere until a
//!   deploy writes the pool's domain and client id there.
//! - **Tokens:** access and ID tokens in memory only; the refresh token in localStorage (every
//!   access wrapped in `js/auth.js`, since storage can throw); the PKCE verifier, `state` and
//!   the pending action in sessionStorage for the length of one redirect.
//! - **Refresh** a minute before expiry, and once on a 401 followed by a retry
//!   (`api::request_authed`). Concurrent refreshes share one request. A refresh that Cognito
//!   refuses signs the user out and forgets the refresh token; a network failure signs out in
//!   memory only, so the next page load can try again.

use std::time::Duration;

use js_sys::{Promise, Uint8Array};
use leptos::prelude::*;
use leptos::task::spawn_local;
use leptos_router::components::A;
use leptos_router::hooks::use_navigate;
use leptos_router::NavigateOptions;
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::JsFuture;

use crate::components::chrome::PageHead;
use crate::oauth::{self, AuthConfig, CallbackError, Flow, PendingAction};
use crate::state::{Session, Toasts};

#[wasm_bindgen(module = "/js/auth.js")]
extern "C" {
    #[wasm_bindgen(js_name = randomBytes)]
    fn random_bytes(n: u32) -> Vec<u8>;
    fn sha256(text: &str) -> Promise;
    #[wasm_bindgen(js_name = storeGet)]
    fn store_get(session: bool, key: &str) -> Option<String>;
    #[wasm_bindgen(js_name = storeSet)]
    fn store_set(session: bool, key: &str, value: &str) -> bool;
    #[wasm_bindgen(js_name = storeDel)]
    fn store_del(session: bool, key: &str);
    #[wasm_bindgen(js_name = pageOrigin)]
    fn page_origin() -> String;
    #[wasm_bindgen(js_name = pagePath)]
    fn page_path() -> String;
    fn go(url: &str);
    #[wasm_bindgen(js_name = queryParam)]
    fn query_param(name: &str) -> Option<String>;
    #[wasm_bindgen(js_name = postForm)]
    fn post_form_js(url: &str, body: &str, no_cors: bool) -> Promise;
    #[wasm_bindgen(js_name = postIdp)]
    fn post_idp_js(url: &str, action: &str, body: &str) -> Promise;
}

/// localStorage: survives the tab, so a returning visitor stays signed in.
const REFRESH_KEY: &str = "capyweb.auth.refresh";
/// sessionStorage: one redirect's PKCE verifier, state, return path and pending action.
const FLOW_KEY: &str = "capyweb.auth.flow";
const NAME_PROMPT_KEY: &str = "capyweb.auth.name-prompt-dismissed";
/// sessionStorage: where to go once managed login's add-a-passkey page comes back.
const PASSKEY_KEY: &str = "capyweb.auth.passkey-return";
/// The pending action that sends a new account on to add a passkey after its first sign-in.
const PASSKEY_KIND: &str = "passkey";

const SESSION: bool = true;
const LOCAL: bool = false;

pub fn name_prompt_dismissed() -> bool {
    store_get(SESSION, NAME_PROMPT_KEY).is_some()
}

pub fn dismiss_name_prompt() {
    store_set(SESSION, NAME_PROMPT_KEY, "1");
}

/// The signed-in user, from the ID token. For display only: the API trusts the JWT, not this.
#[derive(Clone, Debug, PartialEq)]
pub struct User {
    pub sub: String,
    pub email: Option<String>,
}

struct Access {
    token: String,
    refresh_at_ms: u64,
}

/// Everything that is not shown on screen, in one arena slot (each signal type costs code).
#[derive(Default)]
struct Inner {
    config: Option<AuthConfig>,
    access: Option<Access>,
    timer: Option<TimeoutHandle>,
    pending: Option<PendingAction>,
    user: Option<User>,
    /// What "Sign in" was asked for, kept while the chooser is open.
    asked: Option<(String, Option<PendingAction>)>,
}

fn now_ms() -> u64 {
    js_sys::Date::now() as u64
}

fn redirect_uri() -> String {
    page_origin() + oauth::CALLBACK_PATH
}

/// A fresh `Idempotency-Key` for one action that spends play coins: 128 random bits from
/// `crypto.getRandomValues`, base64url (22 characters).
pub fn random_key() -> String {
    oauth::b64url(&random_bytes(16))
}

/// The auth seam. `use_auth()` anywhere under `App`.
#[derive(Clone, Copy)]
pub struct Auth {
    /// A pool is configured and a stored session has been tried: sign-in controls may show.
    ready: RwSignal<bool>,
    /// The sign-in chooser (`SignInDialog`) is open.
    pub chooser: RwSignal<bool>,
    inner: StoredValue<Inner, LocalStorage>,
    session: Session,
    toasts: Toasts,
}

pub fn use_auth() -> Auth {
    expect_context::<Auth>()
}

/// Share the balance and its failure state between sign-in and the confirm dialog.
pub async fn load_balance(auth: Auth, session: Session) -> Option<u64> {
    session.coins_failed.set(false);
    let me = crate::api::get_me(auth).await.ok().flatten();
    // A response that arrives after sign-out must not restore account state.
    if !session.signed_in.get_untracked() {
        return None;
    }
    if let Some(me) = &me {
        session.needs_name.set(me.display_name.is_none());
    }
    let coins = me.and_then(|me| me.balance);
    session.coins.set(coins);
    session.coins_failed.set(coins.is_none());
    coins
}

impl Auth {
    /// Provide the context and start: load `/config.json`, then resume a stored session.
    /// Call once in `App`, after `Session` and `Toasts` are provided.
    pub fn provide(session: Session, toasts: Toasts) {
        let auth = Auth {
            ready: RwSignal::new(false),
            chooser: RwSignal::new(false),
            inner: StoredValue::new_local(Inner::default()),
            session,
            toasts,
        };
        provide_context(auth);
        spawn_local(async move {
            if auth.load_config().await.is_none() {
                return;
            }
            // The callback page finishes its own sign-in; resuming there would race it. Back
            // from adding a passkey it carries no code, and the stored session resumes.
            if !(page_path().starts_with(oauth::CALLBACK_PATH) && query_param("code").is_some())
                && store_get(LOCAL, REFRESH_KEY).is_some()
            {
                auth.refresh().await;
            }
            auth.ready.set(true);
        });
    }

    /// A pool is configured and any stored session has been tried, so sign-in controls may
    /// render. Always false without a configured pool. Reactive.
    pub fn ready(&self) -> bool {
        self.ready.get()
    }

    /// Reactive (through `Session::signed_in`, which only this module writes, and which is
    /// set again on every token change).
    pub fn signed_in(&self) -> bool {
        self.session.signed_in.get()
    }

    /// The user's email and `sub`, for display. Reactive.
    pub fn user(&self) -> Option<User> {
        self.session.signed_in.track();
        self.inner.with_value(|i| i.user.clone())
    }

    /// Sign in or create an account, then come back to `return_to` (a path on this site). With
    /// our own sign-up configured this opens the chooser; otherwise straight to managed login.
    pub fn sign_in(&self, return_to: &str) {
        self.ask(return_to, None);
    }

    /// Like `sign_in`, and hand `action` back to its page afterwards (`take_pending`).
    pub fn sign_in_then(&self, return_to: &str, action: PendingAction) {
        self.ask(return_to, Some(action));
    }

    fn ask(&self, return_to: &str, pending: Option<PendingAction>) {
        if self.can_sign_up() {
            self.inner
                .update_value(|i| i.asked = Some((return_to.to_owned(), pending)));
            self.chooser.set(true);
        } else {
            self.start(return_to, pending, "");
        }
    }

    /// Our own sign-up is configured (`config.json` names Cognito's API).
    pub fn can_sign_up(&self) -> bool {
        self.config().is_some_and(|c| c.idp.is_some())
    }

    /// The chooser's "Sign in": managed login, for what was asked.
    pub fn continue_sign_in(&self) {
        let (to, pending) = self
            .inner
            .try_update_value(|i| i.asked.take())
            .flatten()
            .unwrap_or_else(|| ("/".into(), None));
        self.chooser.set(false);
        self.start(&to, pending, "");
    }

    /// After a confirmed sign-up: managed login with the email filled in (its first sign-in is
    /// by e-mail code), then managed login's page to add a passkey, then back.
    pub fn sign_in_new(&self, email: &str) {
        let to = self
            .inner
            .try_update_value(|i| i.asked.take())
            .flatten()
            .map_or_else(|| "/".into(), |a| a.0);
        self.chooser.set(false);
        let passkey = PendingAction {
            kind: PASSKEY_KIND.into(),
            data: String::new(),
        };
        self.start(&to, Some(passkey), email);
    }

    /// Managed login's page to add a passkey (or another one), then back to `return_to`.
    pub fn add_passkey(&self, return_to: &str) {
        let Some(cfg) = self.config() else { return };
        if store_set(SESSION, PASSKEY_KEY, &oauth::safe_return_path(return_to)) {
            go(&oauth::passkey_add_url(&cfg, &redirect_uri()));
        }
    }

    /// One Cognito API call of our sign-up. `Err` is a sentence for the user.
    async fn idp(
        &self,
        action: &str,
        body: impl Fn(&AuthConfig) -> String,
    ) -> Result<(), &'static str> {
        let cfg = self.config().ok_or("Sign-up is not available here.")?;
        let url = cfg.idp.clone().ok_or("Sign-up is not available here.")?;
        let r = js_sys::Array::from(
            &JsFuture::from(post_idp_js(&url, action, &body(&cfg)))
                .await
                .map_err(|_| "No connection. Please try again.")?,
        );
        match r.get(0).as_f64().unwrap_or(0.0) as u16 {
            200 => Ok(()),
            0 => Err("No connection. Please try again."),
            _ => Err(oauth::idp_error(&r.get(1).as_string().unwrap_or_default())),
        }
    }

    /// Create the account with the email only; Cognito emails a code to confirm it.
    pub async fn sign_up(&self, email: &str) -> Result<(), &'static str> {
        self.idp("SignUp", |c| oauth::signup_body(c, email)).await
    }

    pub async fn confirm_sign_up(&self, email: &str, code: &str) -> Result<(), &'static str> {
        self.idp("ConfirmSignUp", |c| oauth::confirm_body(c, email, code))
            .await
    }

    pub async fn resend_code(&self, email: &str) -> Result<(), &'static str> {
        self.idp("ResendConfirmationCode", |c| oauth::resend_body(c, email))
            .await
    }

    /// The action saved by `sign_in_then`, if it is of this kind. Taken once.
    pub fn take_pending(&self, kind: &str) -> Option<String> {
        self.inner
            .try_update_value(|i| i.pending.take_if(|p| p.kind == kind).map(|p| p.data))
            .flatten()
    }

    /// Clear the session here, revoke the refresh token, then end the managed-login session
    /// through Cognito's `/logout`, which returns to this site's `/`.
    pub fn sign_out(&self) {
        let cfg = self.config();
        let refresh = store_get(LOCAL, REFRESH_KEY);
        self.forget();
        store_del(SESSION, FLOW_KEY);
        spawn_local(async move {
            let Some(cfg) = cfg else { return };
            if let Some(rt) = refresh {
                // no-cors: the revoke must reach Cognito whatever its CORS headers say.
                let _ = JsFuture::from(post_form_js(
                    &oauth::revoke_url(&cfg),
                    &oauth::revoke_body(&cfg, &rt),
                    true,
                ))
                .await;
            }
            go(&oauth::logout_url(&cfg, &(page_origin() + "/")));
        });
    }

    /// An access token with at least a minute left, refreshing first if needed. `None` when
    /// signed out.
    pub async fn access_token(&self) -> Option<String> {
        let token = |fresh_only: bool| {
            self.inner.with_value(|i| {
                i.access
                    .as_ref()
                    .filter(|a| !fresh_only || !oauth::needs_refresh(a.refresh_at_ms, now_ms()))
                    .map(|a| a.token.clone())
            })
        };
        if let Some(t) = token(true) {
            return Some(t);
        }
        if !self.signed_in_untracked() || !self.refresh().await {
            return None;
        }
        token(false)
    }

    fn signed_in_untracked(&self) -> bool {
        self.session.signed_in.get_untracked()
    }

    fn config(&self) -> Option<AuthConfig> {
        self.inner.with_value(|i| i.config.clone())
    }

    /// Exchange the stored refresh token for new tokens. Callers at the same moment share one
    /// request (`postForm` in js/auth.js), so a burst of 401s cannot spend the token several
    /// times.
    pub async fn refresh(&self) -> bool {
        let (Some(cfg), Some(rt)) = (self.config(), store_get(LOCAL, REFRESH_KEY)) else {
            self.sign_out_here();
            return false;
        };
        match post_form(&oauth::token_url(&cfg), oauth::refresh_body(&cfg, &rt)).await {
            Some((200, body)) => {
                let ok = self.accept(&body);
                if !ok {
                    self.forget();
                }
                ok
            }
            // Refused (expired, revoked or rotated away): this refresh token is finished.
            Some((400..=499, _)) => {
                self.forget();
                false
            }
            // Offline or a Cognito outage: signed out for now, but keep the token for later.
            _ => {
                self.sign_out_here();
                false
            }
        }
    }

    /// Store a token response. False if it is not usable.
    fn accept(&self, body: &str) -> bool {
        let Some(t) = oauth::parse_tokens(body) else {
            return false;
        };
        let Some(access) = oauth::jwt_claims(&t.access_token) else {
            return false;
        };
        let id = t.id_token.as_deref().and_then(oauth::jwt_claims);
        let received = now_ms();
        let life = oauth::lifetime_s(&access, t.expires_in);
        if life == 0 {
            return false;
        }
        let at = oauth::refresh_at_ms(received, life);
        // With rotation on, every refresh returns a new refresh token; keep the old one only if
        // none came back.
        if let Some(rt) = &t.refresh_token {
            store_set(LOCAL, REFRESH_KEY, rt);
        }
        self.inner.update_value(|i| {
            i.access = Some(Access {
                token: t.access_token,
                refresh_at_ms: at,
            })
        });
        let was_signed_in = self.signed_in_untracked();
        self.inner.update_value(|i| {
            i.user = Some(User {
                sub: access.sub,
                email: id.and_then(|c| c.email),
            })
        });
        self.session.signed_in.set(true);
        self.schedule(oauth::refresh_delay_ms(at, now_ms()));
        if !was_signed_in {
            let auth = *self;
            spawn_local(async move {
                load_balance(auth, auth.session).await;
            });
        }
        true
    }

    fn schedule(&self, delay_ms: u64) {
        self.cancel_timer();
        let auth = *self;
        let handle = set_timeout_with_handle(
            move || {
                spawn_local(async move {
                    auth.refresh().await;
                })
            },
            Duration::from_millis(delay_ms),
        )
        .ok();
        self.inner.update_value(|i| i.timer = handle);
    }

    fn cancel_timer(&self) {
        if let Some(h) = self.inner.try_update_value(|i| i.timer.take()).flatten() {
            h.clear();
        }
    }

    /// Signed out in memory; the stored refresh token stays.
    fn sign_out_here(&self) {
        self.cancel_timer();
        self.inner.update_value(|i| {
            i.access = None;
            i.user = None;
        });
        self.session.signed_in.set(false);
        self.session.coins.set(None);
        self.session.coins_failed.set(false);
        self.session.needs_name.set(false);
    }

    /// Signed out, and the refresh token is gone from storage.
    fn forget(&self) {
        self.sign_out_here();
        store_del(LOCAL, REFRESH_KEY);
    }

    async fn load_config(&self) -> Option<AuthConfig> {
        if let Some(c) = self.config() {
            return Some(c);
        }
        let res = gloo_net::http::Request::get("/config.json")
            .send()
            .await
            .ok()?;
        if res.status() != 200 {
            return None;
        }
        let cfg = oauth::parse_config(&res.text().await.ok()?)?;
        self.inner.update_value(|i| i.config = Some(cfg.clone()));
        Some(cfg)
    }

    fn start(&self, return_to: &str, pending: Option<PendingAction>, login_hint: &str) {
        let Some(cfg) = self.config() else {
            return;
        };
        let toasts = self.toasts;
        let hint = login_hint.to_owned();
        let flow = Flow {
            state: oauth::b64url(&random_bytes(16)),
            verifier: oauth::b64url(&random_bytes(32)),
            return_to: oauth::safe_return_path(return_to),
            pending: oauth::clean_pending(pending),
        };
        spawn_local(async move {
            // SHA-256 needs a secure page (https, or loopback in development); the verifier
            // needs sessionStorage. Without either there is no safe way to sign in.
            match JsFuture::from(sha256(&flow.verifier)).await {
                Ok(digest) if store_set(SESSION, FLOW_KEY, &flow.encode()) => {
                    let challenge = oauth::pkce_challenge(&Uint8Array::new(&digest).to_vec());
                    go(&oauth::authorize_url_for(
                        &cfg,
                        &redirect_uri(),
                        &challenge,
                        &flow.state,
                        &hint,
                    ))
                }
                _ => toasts.show("Sign-in needs HTTPS and this site to be allowed to store data."),
            }
        });
    }

    /// Finish a sign-in on `/auth/callback`. Returns where to go next.
    async fn complete(
        &self,
        flow: Option<Flow>,
        code: Option<String>,
        state: Option<String>,
        error: Option<String>,
    ) -> Result<String, CallbackError> {
        let code = oauth::check_callback(
            flow.as_ref(),
            code.as_deref(),
            state.as_deref(),
            error.as_deref(),
        )?;
        let flow = flow.ok_or(CallbackError::NoFlow)?;
        let cfg = self.load_config().await.ok_or(CallbackError::Exchange)?;
        let body = oauth::code_body(&cfg, code, &redirect_uri(), &flow.verifier);
        match post_form(&oauth::token_url(&cfg), body).await {
            Some((200, body)) if self.accept(&body) => {
                // A new sign-in may ask again; refreshing or reloading the tab must not.
                store_del(SESSION, NAME_PROMPT_KEY);
                self.inner
                    .update_value(|i| i.pending = oauth::clean_pending(flow.pending));
                Ok(flow.return_to)
            }
            _ => Err(CallbackError::Exchange),
        }
    }
}

/// POST a form to Cognito. `None` on a network error.
async fn post_form(url: &str, body: String) -> Option<(u16, String)> {
    let r = js_sys::Array::from(&JsFuture::from(post_form_js(url, &body, false)).await.ok()?);
    let status = r.get(0).as_f64()? as u16;
    (status != 0).then(|| (status, r.get(1).as_string().unwrap_or_default()))
}

/// `/auth/callback`: where managed login returns. Checks `state` before anything is sent,
/// exchanges the code, then replaces itself with the page the user came from, so the code never
/// stays in the history.
#[component]
pub fn AuthCallback() -> impl IntoView {
    let auth = use_auth();
    let navigate = use_navigate();
    let failed = RwSignal::new(None::<&'static str>);
    // Back from managed login's add-a-passkey page: no code, only where to go next.
    let passkey_return = store_get(SESSION, PASSKEY_KEY);
    store_del(SESSION, PASSKEY_KEY);
    if let Some(to) = passkey_return.filter(|_| query_param("code").is_none()) {
        let to = oauth::safe_return_path(&to);
        request_animation_frame(move || {
            navigate(
                &to,
                NavigateOptions {
                    replace: true,
                    ..Default::default()
                },
            )
        });
        return view! {
            <PageHead title="Signing you in"/>
            <p class="lede" role="status" data-testid="auth-status">"One moment…"</p>
            <A href="/">"Back to home"</A>
        }
        .into_any();
    }
    // Read once and delete: a callback URL replayed later finds no flow and is refused.
    let flow = store_get(SESSION, FLOW_KEY).and_then(|s| Flow::decode(&s));
    store_del(SESSION, FLOW_KEY);
    spawn_local(async move {
        match auth
            .complete(
                flow,
                query_param("code"),
                query_param("state"),
                query_param("error"),
            )
            .await
        {
            // A new account's first sign-in goes on to add a passkey.
            Ok(path) if auth.take_pending(PASSKEY_KIND).is_some() => auth.add_passkey(&path),
            Ok(path) => navigate(
                &path,
                NavigateOptions {
                    replace: true,
                    ..Default::default()
                },
            ),
            Err(e) => failed.set(Some(e.message())),
        }
    });
    view! {
        <PageHead title="Signing you in"/>
        <p class="lede" role="status" data-testid="auth-status">
            {move || failed.get().unwrap_or("One moment…")}
        </p>
        <A href="/">"Back to home"</A>
    }
    .into_any()
}

/// "Sign in" with our own sign-up next to it (hm-nuhjd): managed login's sign-up always asks a
/// password, so a new account is made here with the email and a code, no password; its first
/// sign-in is by e-mail code on managed login, which then adds a passkey.
#[component]
pub fn SignInDialog() -> impl IntoView {
    use crate::components::modal::Modal;
    let auth = use_auth();
    // 0: choose, 1: email, 2: code
    let step = RwSignal::new(0u8);
    let email = RwSignal::new(String::new());
    let code = RwSignal::new(String::new());
    let note = RwSignal::new("");
    let busy = RwSignal::new(false);
    Effect::new(move |_| {
        if auth.chooser.get() {
            step.set(0);
            code.set(String::new());
            note.set("");
        }
    });
    let send = move |again: bool| {
        let e = email.get_untracked().trim().to_lowercase();
        if !oauth::valid_email(&e) {
            note.set("Please enter your email address.");
            return;
        }
        busy.set(true);
        note.set("");
        spawn_local(async move {
            let mut r = if again {
                auth.resend_code(&e).await
            } else {
                auth.sign_up(&e).await
            };
            // An earlier sign-up that was never confirmed: send its code again. A confirmed
            // account refuses the resend, and the user is told to sign in.
            if r == Err(oauth::USER_EXISTS) && auth.resend_code(&e).await.is_ok() {
                r = Ok(());
            }
            busy.set(false);
            match r {
                Ok(()) => {
                    step.set(2);
                    note.set("We sent a 6-digit code to your email.");
                }
                Err(m) => note.set(m),
            }
        });
    };
    let confirm = move || {
        let e = email.get_untracked().trim().to_lowercase();
        let c: String = code
            .get_untracked()
            .chars()
            .filter(|c| !c.is_whitespace())
            .collect();
        if !oauth::valid_code(&c) {
            note.set("Enter the 6-digit code from the email.");
            return;
        }
        busy.set(true);
        note.set("");
        spawn_local(async move {
            match auth.confirm_sign_up(&e, &c).await {
                Ok(()) => auth.sign_in_new(&e),
                Err(m) => {
                    busy.set(false);
                    note.set(m);
                }
            }
        });
    };
    let shown = move |n: u8| move || step.get() != n;
    view! {
        <Modal open=auth.chooser title="Sign in or create an account" close_label="Cancel">
            <div data-testid="signin-choose" hidden=shown(0)>
                <p class="mb-4">"No password needed: sign in with a passkey or a code we email you."</p>
                <div class="actions">
                    <button type="button" class="btn" data-testid="choose-sign-in"
                        on:click=move |_| auth.continue_sign_in()>"Sign in"</button>
                    <button type="button" class="btn btn-ghost" data-testid="choose-sign-up"
                        on:click=move |_| step.set(1)>"Create account"</button>
                </div>
            </div>
            <form data-testid="signup-email" novalidate hidden=shown(1)
                on:submit=move |ev| { ev.prevent_default(); send(false); }>
                <label for="signup-email">"Email address"</label>
                <input id="signup-email" type="email" autocomplete="email"
                    prop:value=email on:input=move |ev| email.set(event_target_value(&ev))/>
                <div class="actions mt-2">
                    <button type="submit" class="btn" disabled=busy>"Send code"</button>
                    <button type="button" class="btn btn-ghost" data-testid="signup-back"
                        on:click=move |_| { note.set(""); step.set(0); }>"Back"</button>
                </div>
            </form>
            <form data-testid="signup-code" hidden=shown(2)
                on:submit=move |ev| { ev.prevent_default(); confirm(); }>
                <label for="signup-code">"Code"</label>
                <input id="signup-code" inputmode="numeric" autocomplete="one-time-code" maxlength="8"
                    prop:value=code on:input=move |ev| code.set(event_target_value(&ev))/>
                <div class="actions mt-2">
                    <button type="submit" class="btn" disabled=busy>"Confirm"</button>
                    <button type="button" class="btn btn-ghost" disabled=busy
                        on:click=move |_| send(true)>"Send a new code"</button>
                    <button type="button" class="btn btn-ghost" data-testid="signup-change-email"
                        on:click=move |_| { note.set(""); code.set(String::new()); step.set(1); }>"Change email"</button>
                </div>
            </form>
            <p role="status" data-testid="signup-note">{move || note.get()}</p>
        </Modal>
    }
}

/// The header's account control: nothing extra until a pool is configured; then "Sign in", or
/// the coin pill and "Sign out".
#[component]
pub fn AccountControl() -> impl IntoView {
    let auth = use_auth();
    let session = auth.session;
    move || {
        if !auth.ready() {
            return view! {
                <A href=crate::routes::Page::Profile.path() attr:class="btn btn-ghost btn-small account-link">"Account"</A>
            }
            .into_any();
        }
        let user = auth.user();
        let signed_in = user.is_some();
        view! {
            {signed_in.then(|| view! {
                <A href=crate::routes::Page::Profile.path() attr:class="coin-pill" attr:title="Play coins. Not real money.">
                    <img src="/assets/capyCoin.svg" alt=""/>
                    <span>{move || session.coins.get().map(|c| c.to_string()).unwrap_or_else(|| "…".into())}</span>
                    <span class="sr-only">" play coins"</span>
                </A>
            })}
            <button type="button" class="btn btn-ghost btn-small whitespace-nowrap"
                data-testid=if signed_in { "sign-out" } else { "sign-in" }
                title=user.and_then(|u| u.email)
                on:click=move |_| if signed_in { auth.sign_out() } else { auth.sign_in(&page_path()) }>
                {if signed_in { "Sign out" } else { "Sign in" }}
            </button>
        }
        .into_any()
    }
}
