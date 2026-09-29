//! Shapes returned by the capyweb HTTP API. Port of src/domain/catalog.ts.
//!
//! They describe what the API SENDS, not what the table stores: key attributes and playback
//! locators are stripped server-side (backend/src/lib/ddb.ts clean()), so there is no field
//! here that could carry a stream key or playback id. Playback comes from GET /stream/{id},
//! and only for a signed-in payer (docs/WASM_PLAN.md section 3).

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AccessType {
    Public,
    Private,
    /// A value this build does not know yet. Treated like private: never offer playback.
    #[serde(other)]
    Unknown,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct RatingCounts {
    pub capylove: Option<u32>,
    pub capylike: Option<u32>,
    pub capywow: Option<u32>,
    pub capyangry: Option<u32>,
    pub capyfire: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct LiveStream {
    pub id: String,
    pub title: String,
    pub access_type: Option<AccessType>,
    pub is_live: Option<bool>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub viewer_count: Option<u32>,
    #[serde(default)]
    pub capybara_ids: Vec<String>,
    pub price_per_10_sec: Option<u32>,
    /// Recorded reel shown when nothing is live, so the page is never dead.
    pub fallback_reel: Option<String>,
    #[serde(rename = "ratingCounts")]
    pub rating_counts: Option<RatingCounts>,
}

impl LiveStream {
    /// Only an explicitly public stream is watchable without sign-in and payment.
    pub fn is_public(&self) -> bool {
        self.access_type == Some(AccessType::Public)
    }
}

/// A list endpoint's envelope. `cursor` is opaque and belongs only to the query that returned it.
#[derive(Debug, Clone, PartialEq, Deserialize)]
pub struct Page<T> {
    pub items: Vec<T>,
    pub count: usize,
    pub cursor: Option<String>,
    /// Set when an unfiltered list merged two partitions and could not page.
    #[serde(default)]
    pub truncated: bool,
    pub hint: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_the_catalog_fixture() {
        let page: Page<LiveStream> =
            serde_json::from_str(include_str!("../fixtures/streams.json")).unwrap();
        assert_eq!(page.count, 3);
        assert_eq!(page.items.len(), 3);
        let wall = page.items.iter().find(|s| s.id == "wall-cam").unwrap();
        assert_eq!(wall.access_type, Some(AccessType::Private));
        assert_eq!(wall.price_per_10_sec, Some(1));
        assert!(!wall.is_public());
    }

    #[test]
    fn unknown_access_type_is_not_public() {
        let s: LiveStream =
            serde_json::from_str(r#"{"id":"x","title":"t","access_type":"members"}"#).unwrap();
        assert_eq!(s.access_type, Some(AccessType::Unknown));
        assert!(!s.is_public());
    }

    #[test]
    fn missing_access_type_is_not_public() {
        let s: LiveStream = serde_json::from_str(r#"{"id":"x","title":"t"}"#).unwrap();
        assert!(!s.is_public());
    }
}
