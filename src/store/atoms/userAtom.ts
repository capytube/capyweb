import { atom } from 'jotai';

export interface UserAtomType {
  id: string | null;
  username: string;
  email: string;
  profile_image_url: string | null;
  wallet_address: string | null;
  bio: string | null;
  balance: number | null;
  totalWatchTime: number | null;
  userVotes?: unknown;
  userBids?: unknown;
  tokenTransaction?: unknown;
  chatComments?: unknown;
}

export const userAtom = atom<UserAtomType>({
  id: '',
  username: '',
  email: '',
  profile_image_url: '',
  wallet_address: '',
  bio: '',
  balance: 0,
  totalWatchTime: 0,
  userVotes: null,
  userBids: null,
  tokenTransaction: null,
  chatComments: null,
});
