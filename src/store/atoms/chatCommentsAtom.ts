import { atom } from 'jotai';
import { UserAtomType } from './userAtom';

export interface ChatCommentsAtomType {
  id: string | null;
  stream_id: string;
  user_id: string;
  content: string;
  createdAt: string;
  stream?: unknown;
  user?: UserAtomType;
}

export const chatCommentsAtom = atom<ChatCommentsAtomType[]>([]);
