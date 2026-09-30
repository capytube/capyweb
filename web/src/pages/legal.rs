//! Who runs CapyTube, as the legal pages name it (capyweb-bpk). nic's answer (Q197, 2026-09-30, through
//! the master and capyweb-manager): no company and no postal address. The operator is "CapyTube", named
//! with the on-chain address it is run from only if the project publishes one. The one line to change
//! is `OPERATOR`.

use leptos::prelude::*;

/// The operator the legal pages name.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Operator {
    /// "CapyTube" only, reached by email.
    CapyTube,
    /// "CapyTube", run from a published address, e.g. `OnChain { chain: "Solana", address: "…" }`.
    OnChain {
        chain: &'static str,
        address: &'static str,
    },
}

/// The one line to change: `Operator::CapyTube` or `Operator::OnChain { chain: "…", address: "…" }`.
pub const OPERATOR: Operator = Operator::CapyTube;

impl Operator {
    /// The chain and address to name after "CapyTube runs the website at capytube.xyz", if any.
    pub fn address(self) -> Option<(&'static str, &'static str)> {
        match self {
            Operator::CapyTube => None,
            Operator::OnChain { chain, address } => Some((chain, address)),
        }
    }
}

/// The opening sentence of Terms and Privacy: who "we" are, with the address when there is one.
#[component]
pub fn WeAre() -> impl IntoView {
    view! {
        "CapyTube (\"we\", \"us\") runs the website at capytube.xyz"
        {OPERATOR.address().map(|(chain, address)| view! {
            ", from the " {chain} " address " <code class="addr">{address}</code>
        })}
        "."
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_an_on_chain_operator_names_an_address() {
        assert_eq!(Operator::CapyTube.address(), None);
        let op = Operator::OnChain {
            chain: "Example",
            address: "ExampleAddress123",
        };
        assert_eq!(op.address(), Some(("Example", "ExampleAddress123")));
    }
}
