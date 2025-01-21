import { PriceType } from './nftAtom';
import { UserAtomType } from './userAtom';

export interface ActivityLogAtomType {
  id: string | null;
  event: string | null; // Type of event (e.g., "Sale", "Transfer")
  price: PriceType | null; // Price associated with the event
  royalties: string | null; // (e.g., “Paid”)
  from: string | null; // User ID of the seller or previous owner
  to: string | null; // User ID of the buyer or new owner
  timestamp: number | null; // Time of the event
  nftId: string | null; // Foreign key to the NFT
  nftDetails?: unknown;
  fromDetails?: UserAtomType;
  toDetails?: UserAtomType;
}
