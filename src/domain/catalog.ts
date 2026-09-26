// Shapes returned by the capyweb HTTP API. These replace the generated Amplify `Schema` types.
//
// They describe what the API actually SENDS, which is not the same as what the table stores:
// key attributes and playback locators are stripped server-side (backend/src/lib/ddb.ts), so
// `streaming_address` and `s3_video_address` deliberately do not appear here. Playback comes
// from GET /stream/{id}, never from the catalog.

export type AccessType = "public" | "private";
export type InteractionType = "vote" | "bid";
export type Rarity = "ultra_rare" | "rare" | "epic";
export type Gender = "male" | "female";

/** Every item carries these. `entity` makes a mixed list self-describing. */
export interface Entity {
  id: string;
  entity: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Capybara extends Entity {
  name: string;
  gender?: Gender;
  birth_date?: string;
  born_place?: string;
  description?: string;
  bio?: string;
  personality?: string;
  card_image_url?: string;
  avatar_image_url?: string;
  profile_image_url?: string;
  favorite_activities?: string[];
  fun_fact?: string;
  /** Published activity window, so a sleeping capybara reads as normal (capyweb-eh4). */
  awake_from?: string;
  awake_to?: string;
}

export interface RatingCounts {
  capylove?: number;
  capylike?: number;
  capywow?: number;
  capyangry?: number;
  capyfire?: number;
}

export interface LiveStream extends Entity {
  title: string;
  access_type?: AccessType;
  is_live?: boolean;
  start_time?: string;
  end_time?: string;
  viewer_count?: number;
  capybara_ids?: string[];
  price_per_10_sec?: number;
  /** Recorded reel shown when nothing is live, so the page is never dead (capyweb-0c8). */
  fallback_reel?: string;
  ratingCounts?: RatingCounts;
}

export interface VoteOption {
  id: string;
  title: string;
  description?: string;
}

export interface Interaction extends Entity {
  capybara_id: string;
  interaction_type?: InteractionType;
  title: string;
  description?: string;
  title_icon_url?: string;
  image_url?: string;
  device_required?: string;
  options?: VoteOption[];
  rules?: string[];
  session_date?: string;
  /** Winning option id, set when an admin declares the result (capyweb-zlb). */
  result?: string;
  vote_cost?: number;
  custom_request_cost?: number;
  current_bid?: number;
}

export interface NftProperty {
  key: string;
  value: string;
}

export interface Nft extends Entity {
  name: string;
  image_url?: string;
  rarity?: Rarity;
  labels?: string[];
  properties?: NftProperty[];
  price?: number;
  /** 0 or 1, matching the index partition it is stored under. */
  is_for_sale?: 0 | 1;
  owner_id?: string;
}

export interface Offer extends Entity {
  nftId: string;
  from: string;
  price: number;
  expires_at?: string;
}

export interface ActivityLogEntry extends Entity {
  nftId: string;
  event: string;
  price: number;
  from: string;
  to: string;
  timestamp?: string;
  royalties?: string;
}

/** What GET /stream/{id} resolves to. Obtained per-request, never listed in the catalog. */
export interface PlaybackSource {
  [key: string]: unknown;
}
