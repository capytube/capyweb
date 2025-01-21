import { atom } from 'jotai';

interface RatingsAtom {
  id: string | null;
  ratingCounts: {
    capylove: number | null;
    capylike: number | null;
    capywow: number | null;
    capyangry: number | null;
    capyfire: number | null;
  } | null;
}

export const ratingsAtom = atom<RatingsAtom>({
  id: '',
  ratingCounts: {
    capylove: null,
    capylike: null,
    capywow: null,
    capyangry: null,
    capyfire: null,
  },
});
