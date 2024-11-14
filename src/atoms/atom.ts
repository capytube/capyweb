import { atom } from 'jotai';

interface userType {
  id: string | null;
  name: string | null;
  walletId: string | null;
  createdAt: number | null;
}

export const userAtom = atom<userType>({
  id: '',
  name: '',
  walletId: '',
  createdAt: 0,
});

export const walletAtom = atom<`0x${string}` | null>(null);
export const loadingAtom = atom<boolean>(false);
