import { atom } from 'jotai';
import { UserAtomType } from './userAtom';

type RarityType = 'ultra_rare' | 'rare' | 'epic';

export interface Options {
  key: string | null;
  value: string | null;
}

export interface NftAtomType {
  id: string | null; // Unique Token ID (e.g., "NFT1234")
  name: string; // Name of the NFT (e.g., "Capy #1234")
  image_url: string | null;
  rarity: RarityType | null; // Rarity level (e.g., "Ultra rare", "Rare")
  labels: (string | null)[] | null; // Labels for categorization (e.g., "Capybara", "Chalk Bonus")
  properties: (Options | null)[] | null; // List of properties (e.g., "Chalk powder bonus")
  price: number | null; // Current price of the NFT
  is_for_sale: number | null; // possible values 0 or 1 (1 represent NFT is currently for sale)
  owner_id: string | null; // User ID of the current owner (nullable if listed for sale)
  owner_details: UserAtomType;
  offers?: unknown;
  activityLog?: unknown;
}

export const nftAtom = atom<NftAtomType[]>([]);

export const isForSaleNftAtom = atom<NftAtomType[]>([]);

export const specifiOwnerNftAtom = atom<NftAtomType[]>([]);
