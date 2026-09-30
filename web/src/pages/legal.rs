//! Who runs CapyTube, as the legal pages name it (capyweb-bpk). The owner's answer is one line,
//! `OPERATOR` below (capyweb-manager, 2026-09-30): until then Privacy shows a marked placeholder, and
//! `scripts/live-checks.mjs` fails on it.

/// The operator the legal pages name.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Operator {
    /// Not answered yet: Privacy shows `[insert company address]`, marked.
    Pending,
    /// A company, by its legal name and postal address.
    Company {
        name: &'static str,
        address: &'static str,
    },
    /// "CapyTube" only: contact by email, and no postal address.
    CapyTubeOnly,
}

/// The one line to change: `Operator::Company { name: "…", address: "…" }` or
/// `Operator::CapyTubeOnly`.
pub const OPERATOR: Operator = Operator::Pending;

impl Operator {
    /// Privacy's address line, when there is one.
    pub fn address_line(self) -> Option<String> {
        match self {
            Operator::Company { name, address } => Some(format!("{name}, {address}")),
            Operator::Pending | Operator::CapyTubeOnly => None,
        }
    }

    /// Who "we" are, for the first sentence of Privacy and Terms.
    pub fn we(self) -> String {
        match self {
            Operator::Company { name, .. } => format!("CapyTube, run by {name}"),
            Operator::Pending | Operator::CapyTubeOnly => "CapyTube".to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_company_names_itself_and_its_address() {
        let op = Operator::Company {
            name: "Example Co., Ltd.",
            address: "1 Example Road, Bangkok 10110, Thailand",
        };
        assert_eq!(
            op.address_line().as_deref(),
            Some("Example Co., Ltd., 1 Example Road, Bangkok 10110, Thailand")
        );
        assert_eq!(op.we(), "CapyTube, run by Example Co., Ltd.");
    }

    #[test]
    fn capytube_only_and_pending_give_no_address() {
        for op in [Operator::CapyTubeOnly, Operator::Pending] {
            assert_eq!(op.address_line(), None);
            assert_eq!(op.we(), "CapyTube");
        }
    }
}
