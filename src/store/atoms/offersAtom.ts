import { PriceType } from './nftAtom';
import { UserAtomType } from './userAtom';

export interface OffersAtomType {
  id: string | null;
  price: PriceType | null; // Offered price for NFT
  from: string | null; // User ID of the user making the offer
  expires_at: number | null; // Expiration date of the offer
  nftId: string | null; // Foreign key to the NFT
  nftDetails?: unknown;
  fromDetails?: UserAtomType;
}
