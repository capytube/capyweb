import { atom } from 'jotai';

export interface UserAtomType {
  id: string | null;
  username: string | null;
  email: string | null;
  createdAt: number | null;
  profile_image_url: string | null;
  wallet_address: string | null;
  bio: string | null;
  balance: number | null;
  userVotes?: unknown;
  userBids?: unknown;
  tokenTransaction?: unknown;
  chatComments?: unknown;
}

export const userAtom = atom<UserAtomType>({
  id: '',
  username: '',
  email: '',
  createdAt: 0,
  profile_image_url: '',
  wallet_address: '',
  bio: '',
  balance: 0,
  userVotes: null,
  userBids: null,
  tokenTransaction: null,
  chatComments: null,
});
