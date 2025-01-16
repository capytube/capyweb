import { atom } from 'jotai';
import { UserAtomType } from './userAtom';

export interface ChatCommentsAtomType {
  id: string | null;
  stream_id: string | null;
  user_id: string | null;
  content: string | null;
  createdAt: string;
  stream?: unknown;
  user?: UserAtomType;
}

export const chatCommentsAtom = atom<ChatCommentsAtomType[]>([]);
