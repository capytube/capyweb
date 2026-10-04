//! Shapes returned by the capyweb HTTP API. Port of src/domain/catalog.ts.
//!
//! They describe what the API SENDS, not what the table stores: key attributes and playback
//! locators are stripped server-side (backend/src/lib/ddb.ts clean()), so there is no field
//! here that could carry a stream key or playback id. Playback never comes from the catalog;
//! the playback route arrives with the video source in task W6 (docs/WASM_PLAN.md).

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
    #[serde(default)]
    pub capylove: Option<u32>,
    #[serde(default)]
    pub capylike: Option<u32>,
    #[serde(default)]
    pub capywow: Option<u32>,
    #[serde(default)]
    pub capyangry: Option<u32>,
    #[serde(default)]
    pub capyfire: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct LiveStream {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub access_type: Option<AccessType>,
    #[serde(default)]
    pub is_live: Option<bool>,
    #[serde(default)]
    pub start_time: Option<String>,
    #[serde(default)]
    pub end_time: Option<String>,
    #[serde(default)]
    pub viewer_count: Option<u32>,
    #[serde(default)]
    pub capybara_ids: Vec<String>,
    #[serde(default)]
    pub price_per_10_sec: Option<u32>,
    /// `recording`: the camera plays CapyTube's recording, never live (W6, until the encoder box;
    /// docs/VIDEO_DESIGN.md section 8). Anything else is a live camera.
    #[serde(default)]
    pub video_mode: Option<String>,
    /// Recorded reel shown when nothing is live, so the page is never dead.
    #[serde(default)]
    pub fallback_reel: Option<String>,
    #[serde(rename = "ratingCounts")]
    #[serde(default)]
    pub rating_counts: Option<RatingCounts>,
}

impl LiveStream {
    /// Only an explicitly public stream is watchable without sign-in and payment.
    pub fn is_public(&self) -> bool {
        self.access_type == Some(AccessType::Public)
    }

    /// Plays a recording: every page says "Recorded", never "Live".
    pub fn is_recording(&self) -> bool {
        self.video_mode.as_deref() == Some("recording")
    }

    /// A paid camera's price for one minute (the server sells 60 s blocks at 6 x the
    /// 10-second price). `None` when it has no price: then it cannot be bought.
    pub fn price_per_minute(&self) -> Option<u32> {
        self.price_per_10_sec
            .filter(|p| *p > 0)
            .and_then(|p| p.checked_mul(6))
    }

    /// The reel as a bare media key (served under /media/), or None. `fallback_reel` is free text
    /// that the backend's name-based playback filter cannot see into, so anything that could be
    /// a locator - a URL, a path, a query - is refused here rather than played.
    pub fn reel_key(&self) -> Option<&str> {
        let r = self.fallback_reel.as_deref()?;
        let bare = !r.is_empty()
            && r.len() <= 128
            && !r.starts_with('.')
            && r.bytes()
                .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'.'));
        bare.then_some(r)
    }
}

/// A list endpoint's envelope. `cursor` is opaque and belongs only to the query that returned it.
#[derive(Debug, Clone, PartialEq, Deserialize)]
pub struct Page<T> {
    pub items: Vec<T>,
    pub count: usize,
    #[serde(default)]
    pub cursor: Option<String>,
    /// Set when an unfiltered list merged two partitions and could not page.
    #[serde(default)]
    pub truncated: bool,
    #[serde(default)]
    pub hint: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum InteractionType {
    Vote,
    Bid,
    #[serde(other)]
    Unknown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Rarity {
    Common,
    Rare,
    Epic,
    Legendary,
    UltraRare,
    #[serde(other)]
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Capybara {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub gender: Option<String>,
    #[serde(default)]
    pub bio: Option<String>,
    #[serde(default)]
    pub personality: Option<String>,
    #[serde(default)]
    pub fun_fact: Option<String>,
    #[serde(default)]
    pub favorite_activities: Option<Vec<String>>,
    #[serde(default)]
    pub awake_from: Option<String>,
    #[serde(default)]
    pub awake_to: Option<String>,
    #[serde(rename = "createdAt")]
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(rename = "updatedAt")]
    #[serde(default)]
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct VoteOption {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Interaction {
    pub id: String,
    pub capybara_id: String,
    pub interaction_type: InteractionType,
    pub title: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub session_date: Option<String>,
    #[serde(default)]
    pub vote_cost: Option<u64>,
    #[serde(default)]
    pub custom_request_cost: Option<u64>,
    #[serde(default)]
    pub options: Option<Vec<VoteOption>>,
    #[serde(default)]
    pub current_bid: Option<u64>,
    #[serde(default)]
    pub rules: Option<Vec<String>>,
    #[serde(rename = "createdAt")]
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(rename = "updatedAt")]
    #[serde(default)]
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PassProperty {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Pass {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub rarity: Option<Rarity>,
    #[serde(default)]
    pub price: Option<u64>,
    #[serde(default)]
    pub is_for_sale: Option<u8>,
    #[serde(default)]
    pub image_url: Option<String>,
    #[serde(default)]
    pub labels: Option<Vec<String>>,
    #[serde(default)]
    pub properties: Option<Vec<PassProperty>>,
    #[serde(default)]
    pub owner_id: Option<String>,
    #[serde(rename = "createdAt")]
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(rename = "updatedAt")]
    #[serde(default)]
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Offer {
    pub id: String,
    #[serde(rename = "nftId")]
    pub nft_id: String,
    pub from: String,
    pub price: u64,
    #[serde(default)]
    pub expires_at: Option<String>,
    #[serde(rename = "createdAt")]
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(rename = "updatedAt")]
    #[serde(default)]
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ActivityLog {
    pub id: String,
    #[serde(rename = "nftId")]
    pub nft_id: String,
    pub event: String,
    #[serde(default)]
    pub price: Option<u64>,
    #[serde(default)]
    pub from: Option<String>,
    #[serde(default)]
    pub to: Option<String>,
    pub timestamp: String,
    #[serde(rename = "createdAt")]
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(rename = "updatedAt")]
    #[serde(default)]
    pub updated_at: Option<String>,
}

impl Pass {
    pub fn for_sale(&self) -> bool {
        self.is_for_sale == Some(1)
    }
}

/// One public chat line. Names and text are other people's words: render them as text only.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ChatMessage {
    pub id: String,
    #[serde(default)]
    pub stream_id: String,
    #[serde(default)]
    pub display_name: Option<String>,
    #[serde(default)]
    pub text: String,
    #[serde(rename = "createdAt")]
    #[serde(default)]
    pub created_at: String,
}

/// `GET /streams/{id}/chat`. `reactions` is present on the first page only.
#[derive(Debug, Clone, Default, PartialEq, Deserialize)]
pub struct ChatPage {
    #[serde(default)]
    pub items: Vec<ChatMessage>,
    #[serde(default)]
    pub count: usize,
    #[serde(default)]
    pub cursor: Option<String>,
    #[serde(default)]
    pub reactions: Option<RatingCounts>,
}

impl RatingCounts {
    pub fn of(&self, name: &str) -> u32 {
        match name {
            "capylove" => self.capylove.unwrap_or(0),
            "capylike" => self.capylike.unwrap_or(0),
            "capywow" => self.capywow.unwrap_or(0),
            "capyangry" => self.capyangry.unwrap_or(0),
            "capyfire" => self.capyfire.unwrap_or(0),
            _ => 0,
        }
    }
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
    fn reel_must_be_a_bare_media_key() {
        let with = |r: &str| LiveStream {
            fallback_reel: Some(r.into()),
            ..serde_json::from_str(r#"{"id":"x","title":"t"}"#).unwrap()
        };
        assert_eq!(
            with("capytube-stream.mp4").reel_key(),
            Some("capytube-stream.mp4")
        );
        for bad in [
            "https://video.example.com/hls/abc/index.m3u8",
            "../x.mp4",
            "a/b.mp4",
            "x.mp4?t=1",
            ".env",
            "",
        ] {
            assert_eq!(with(bad).reel_key(), None, "{bad}");
        }
    }

    #[test]
    fn missing_access_type_is_not_public() {
        let s: LiveStream = serde_json::from_str(r#"{"id":"x","title":"t"}"#).unwrap();
        assert!(!s.is_public());
    }

    #[test]
    fn every_catalog_fixture_matches_the_wire_contract() {
        let capys: Page<Capybara> =
            serde_json::from_str(include_str!("../fixtures/capybaras.json")).unwrap();
        assert_eq!(capys.count, 3);
        assert_eq!(
            capys
                .items
                .iter()
                .map(|c| c.id.as_str())
                .collect::<Vec<_>>(),
            ["einstein", "magnus", "elon"]
        );
        let passes: Page<Pass> =
            serde_json::from_str(include_str!("../fixtures/nfts.json")).unwrap();
        assert_eq!(passes.count, 3);
        assert!(!passes.truncated);
        assert_eq!(
            passes
                .items
                .iter()
                .map(|p| p.id.as_str())
                .collect::<Vec<_>>(),
            ["capy-1234", "capy-5687", "capy-632574"]
        );
        assert!(passes.items[0].for_sale());
        assert!(!passes.items[2].for_sale());
        let streams: Page<LiveStream> =
            serde_json::from_str(include_str!("../fixtures/streams.json")).unwrap();
        assert_eq!(
            streams
                .items
                .iter()
                .map(|s| s.id.as_str())
                .collect::<Vec<_>>(),
            ["food-cam", "main-cam", "wall-cam"]
        );
        assert!(!streams.truncated);
        let c: Capybara =
            serde_json::from_str(include_str!("../fixtures/capybaras/einstein.json")).unwrap();
        assert_eq!(c.id, "einstein");
        assert_eq!(c.created_at.as_deref(), Some("2026-09-26T00:00:00.000Z"));
        assert!(c
            .favorite_activities
            .as_ref()
            .is_some_and(|v| !v.is_empty()));
        let interactions: Page<Interaction> = serde_json::from_str(include_str!(
            "../fixtures/capybaras/einstein/interactions.json"
        ))
        .unwrap();
        assert_eq!(interactions.count, 0);
        assert_eq!(interactions.items.len(), interactions.count);
        let c: Capybara =
            serde_json::from_str(include_str!("../fixtures/capybaras/elon.json")).unwrap();
        assert_eq!(c.id, "elon");
        assert_eq!(c.created_at.as_deref(), Some("2026-09-26T00:00:00.000Z"));
        assert!(c
            .favorite_activities
            .as_ref()
            .is_some_and(|v| !v.is_empty()));
        let interactions: Page<Interaction> =
            serde_json::from_str(include_str!("../fixtures/capybaras/elon/interactions.json"))
                .unwrap();
        assert_eq!(interactions.count, 1);
        assert_eq!(interactions.items.len(), interactions.count);
        assert_eq!(interactions.items[0].interaction_type, InteractionType::Bid);
        assert_eq!(interactions.items[0].current_bid, Some(20));
        assert_eq!(interactions.items[0].options, None);
        let c: Capybara =
            serde_json::from_str(include_str!("../fixtures/capybaras/magnus.json")).unwrap();
        assert_eq!(c.id, "magnus");
        assert_eq!(c.created_at.as_deref(), Some("2026-09-26T00:00:00.000Z"));
        assert!(c
            .favorite_activities
            .as_ref()
            .is_some_and(|v| !v.is_empty()));
        let interactions: Page<Interaction> = serde_json::from_str(include_str!(
            "../fixtures/capybaras/magnus/interactions.json"
        ))
        .unwrap();
        assert_eq!(interactions.count, 1);
        assert_eq!(interactions.items.len(), interactions.count);
        let vote = &interactions.items[0];
        assert_eq!(vote.interaction_type, InteractionType::Vote);
        assert_eq!(vote.vote_cost, Some(1));
        assert_eq!(vote.custom_request_cost, Some(5));
        assert_eq!(
            vote.options
                .as_ref()
                .unwrap()
                .iter()
                .map(|o| o.id.as_str())
                .collect::<Vec<_>>(),
            ["carrots", "pandan", "watermelon", "grass"]
        );
        assert_eq!(vote.rules.as_ref().unwrap().len(), 2);
        assert_eq!(vote.current_bid, None);
        let stream: LiveStream =
            serde_json::from_str(include_str!("../fixtures/streams/food-cam.json")).unwrap();
        assert_eq!(stream.id, "food-cam");
        assert_eq!(stream.capybara_ids, ["einstein"]);
        assert_eq!(stream.reel_key(), Some("capytube-stream.mp4"));
        let stream: LiveStream =
            serde_json::from_str(include_str!("../fixtures/streams/main-cam.json")).unwrap();
        assert_eq!(stream.id, "main-cam");
        assert_eq!(stream.capybara_ids, ["magnus"]);
        assert_eq!(stream.reel_key(), Some("capytube-stream.mp4"));
        let stream: LiveStream =
            serde_json::from_str(include_str!("../fixtures/streams/wall-cam.json")).unwrap();
        assert_eq!(stream.id, "wall-cam");
        assert_eq!(stream.capybara_ids, ["elon"]);
        // A private camera's reel is paid content: the catalog does not show it (capyweb-0m7).
        assert_eq!(stream.reel_key(), None);
        assert_eq!(stream.price_per_10_sec, Some(1));
        let pass: Pass =
            serde_json::from_str(include_str!("../fixtures/nfts/capy-1234.json")).unwrap();
        assert_eq!(pass.id, "capy-1234");
        assert_eq!(pass.rarity, Some(Rarity::UltraRare));
        assert!(pass.for_sale());
        assert!(pass.image_url.as_deref().unwrap().starts_with("media/"));
        assert_eq!(pass.labels.as_ref().unwrap().len(), 2);
        assert!(!pass.properties.as_ref().unwrap()[0].value.is_empty());
        let offers: Page<Offer> =
            serde_json::from_str(include_str!("../fixtures/nfts/capy-1234/offers.json")).unwrap();
        let activity: Page<ActivityLog> =
            serde_json::from_str(include_str!("../fixtures/nfts/capy-1234/activity.json")).unwrap();
        assert_eq!(offers.count, 2);
        assert_eq!(offers.items.len(), offers.count);
        assert_eq!(activity.count, offers.count);
        assert_eq!(activity.items.len(), activity.count);
        assert_eq!(
            offers
                .items
                .iter()
                .map(|o| o.id.as_str())
                .collect::<Vec<_>>(),
            ["offer-2", "offer-1"]
        );
        assert_eq!(offers.items[0].price, 7);
        assert_eq!(offers.items[0].nft_id, pass.id);
        assert_eq!(
            offers.items[0].created_at.as_deref(),
            Some("2026-09-26T00:00:00.000Z")
        );
        assert_eq!(
            activity
                .items
                .iter()
                .map(|a| a.event.as_str())
                .collect::<Vec<_>>(),
            ["Listed", "Minted"]
        );
        assert_eq!(activity.items[0].nft_id, pass.id);
        assert_eq!(pass.owner_id, None);
        let pass: Pass =
            serde_json::from_str(include_str!("../fixtures/nfts/capy-5687.json")).unwrap();
        assert_eq!(pass.id, "capy-5687");
        assert_eq!(pass.rarity, Some(Rarity::Rare));
        assert!(pass.for_sale());
        assert!(pass.image_url.as_deref().unwrap().starts_with("media/"));
        assert_eq!(pass.labels.as_ref().unwrap().len(), 2);
        assert!(!pass.properties.as_ref().unwrap()[0].value.is_empty());
        let offers: Page<Offer> =
            serde_json::from_str(include_str!("../fixtures/nfts/capy-5687/offers.json")).unwrap();
        let activity: Page<ActivityLog> =
            serde_json::from_str(include_str!("../fixtures/nfts/capy-5687/activity.json")).unwrap();
        assert_eq!(offers.count, 0);
        assert_eq!(offers.items.len(), offers.count);
        assert_eq!(activity.count, offers.count);
        assert_eq!(activity.items.len(), activity.count);
        assert_eq!(pass.owner_id.as_deref(), None);
        let pass: Pass =
            serde_json::from_str(include_str!("../fixtures/nfts/capy-632574.json")).unwrap();
        assert_eq!(pass.id, "capy-632574");
        assert_eq!(pass.rarity, Some(Rarity::Epic));
        assert!(!pass.for_sale());
        assert!(pass.image_url.as_deref().unwrap().starts_with("media/"));
        assert_eq!(pass.labels.as_ref().unwrap().len(), 2);
        assert!(!pass.properties.as_ref().unwrap()[0].value.is_empty());
        let offers: Page<Offer> =
            serde_json::from_str(include_str!("../fixtures/nfts/capy-632574/offers.json")).unwrap();
        let activity: Page<ActivityLog> =
            serde_json::from_str(include_str!("../fixtures/nfts/capy-632574/activity.json"))
                .unwrap();
        assert_eq!(offers.count, 0);
        assert_eq!(offers.items.len(), offers.count);
        assert_eq!(activity.count, offers.count);
        assert_eq!(activity.items.len(), activity.count);
        assert_eq!(pass.owner_id.as_deref(), Some("seed-user-1"));
    }

    #[test]
    fn unknown_enums_and_missing_optional_fields() {
        assert_eq!(
            serde_json::from_str::<InteractionType>(r#""future""#).unwrap(),
            InteractionType::Unknown
        );
        assert_eq!(
            serde_json::from_str::<Rarity>(r#""future""#).unwrap(),
            Rarity::Unknown
        );
        let pass: Pass = serde_json::from_str(r#"{"id":"p","name":"Pass","extra":true}"#).unwrap();
        assert!(!pass.for_sale());
        assert_eq!(pass.owner_id, None);
        assert_eq!(pass.labels, None);
    }

    /// If a response ever carried a playback locator, the app's types would drop it: there is
    /// no field to hold it (scripts/guard.sh rule 4 keeps it that way).
    #[test]
    fn a_leaked_locator_does_not_survive_parsing() {
        let s: LiveStream = serde_json::from_str(
            r#"{"id":"s","title":"t","access_type":"private","playbackId":"abc","streaming_address":"x"}"#,
        )
        .unwrap();
        let back = serde_json::to_string(&s).unwrap();
        assert!(
            !back.contains("abc") && !back.contains("streaming_address"),
            "{back}"
        );
    }
}
