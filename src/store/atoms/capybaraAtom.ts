import { atom } from 'jotai';

export interface CapybaraAtomType {
  id: string | null;
  name: string | null;
  gender: 'male' | 'female' | null;
  birth_year: number | null;
  born_place: string | null;
  description: string | null; // can be in Markdown format
  bio: string | null; // can be in Markdown format
  personality: string | null; // can be in Markdown format
  card_image_url: string | null;
  avatar_image_url: string | null;
  profile_image_url: string | null;
  favorite_activities: (string | null)[] | null;
  fun_fact: string | null; // can be in Markdown format
  interactions?: unknown;
}

export const capybaraAtom = atom<CapybaraAtomType[]>([]);
