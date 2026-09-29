//! Tools that spend play coins or post as the person. None of them acts by itself: each hands its
//! action to the page that owns it, which shows its own confirm step, and resolves only after the
//! person confirms there, or cancels. No tool buys paid-camera time (capyweb-manager, hm-auue).

use super::{Ctx, Tool};

/// Registered while the person is signed in.
pub(super) fn tools(_ctx: Ctx) -> Vec<Tool> {
    Vec::new()
}
