//! Keep the prompt and profile's name rules and messages the same.

pub fn validate_name(value: &str) -> Option<&'static str> {
    (!(2..=32).contains(&value.chars().count())).then_some("Use 2 to 32 characters.")
}

/// The server checks allowed characters and reserved names (DATA_MODEL section 6).
pub fn name_error(message: &str) -> &'static str {
    if message.contains("reserved") {
        "That name is reserved. Please pick another."
    } else {
        "Use 2 to 32 letters or digits, with single spaces, dots, dashes, underscores or apostrophes between them."
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn name_length_counts_characters() {
        for name in ["", "a", &"a".repeat(33)] {
            assert_eq!(validate_name(name), Some("Use 2 to 32 characters."));
        }
        for name in ["ab", "นก", &"é".repeat(32)] {
            assert_eq!(validate_name(name), None);
        }
    }

    #[test]
    fn server_refusals_use_plain_words() {
        assert_eq!(
            name_error("that display_name is reserved"),
            "That name is reserved. Please pick another."
        );
        assert!(name_error("invalid display_name").starts_with("Use 2 to 32 letters or digits"));
    }
}
