//! App-wide state, provided as context: the session and the toast queue.

use std::time::Duration;

use leptos::prelude::*;

/// Sign-in is wired up in W11 (Cognito managed login). Until the build carries a client id, the
/// app runs signed out and shows no sign-in or spend buttons: write routes do not exist yet.
pub const AUTH_ENABLED: bool = option_env!("CAPYWEB_COGNITO_CLIENT_ID").is_some();

#[derive(Clone, Copy)]
pub struct Session {
    pub signed_in: RwSignal<bool>,
    pub writes_enabled: RwSignal<bool>,
    /// Play-coin balance from the server ledger. `None` until known.
    pub coins: RwSignal<Option<u64>>,
}

impl Default for Session {
    fn default() -> Self {
        Self {
            signed_in: RwSignal::new(false),
            writes_enabled: RwSignal::new(false),
            coins: RwSignal::new(None),
        }
    }
}

pub fn use_session() -> Session {
    expect_context::<Session>()
}

/// How long a toast stays up, and how many can stack before the oldest goes.
pub const TOAST_MS: u64 = 2800;
pub const TOAST_MAX: usize = 3;

#[derive(Clone, Debug, PartialEq)]
pub struct Toast {
    pub id: u64,
    pub text: String,
}

/// Pure queue logic, kept apart from signals so it is testable natively.
pub fn push_toast(queue: &mut Vec<Toast>, next_id: u64, text: String) {
    queue.push(Toast { id: next_id, text });
    if queue.len() > TOAST_MAX {
        let extra = queue.len() - TOAST_MAX;
        queue.drain(..extra);
    }
}

#[derive(Clone, Copy)]
pub struct Toasts {
    pub items: RwSignal<Vec<Toast>>,
    next: StoredValue<u64>,
}

impl Default for Toasts {
    fn default() -> Self {
        Self {
            items: RwSignal::new(Vec::new()),
            next: StoredValue::new(0),
        }
    }
}

impl Toasts {
    pub fn show(&self, text: impl Into<String>) {
        let id = self.next.get_value();
        self.next.set_value(id + 1);
        self.items.update(|q| push_toast(q, id, text.into()));
        let items = self.items;
        set_timeout(
            move || items.update(|q| q.retain(|t| t.id != id)),
            Duration::from_millis(TOAST_MS),
        );
    }
}

pub fn use_toasts() -> Toasts {
    expect_context::<Toasts>()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn toast_queue_keeps_the_newest() {
        let mut q = Vec::new();
        for i in 0..5 {
            push_toast(&mut q, i, format!("t{i}"));
        }
        assert_eq!(q.len(), TOAST_MAX);
        assert_eq!(q.first().unwrap().text, "t2");
        assert_eq!(q.last().unwrap().text, "t4");
    }
}
