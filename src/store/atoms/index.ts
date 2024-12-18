import { atom } from 'jotai';

export const walletAtom = atom<`0x${string}` | null>(null);
