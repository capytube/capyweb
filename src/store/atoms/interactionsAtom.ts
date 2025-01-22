import { atom } from 'jotai';

type InteractionType = 'vote' | 'bid';

export interface VoteOptions {
  id: string | null;
  title: string | null;
  description: string | null;
}

export interface InteractionsAtomType {
  id: string | null;
  capybara_id: string; // Foreign Key to Capybara
  capybara?: unknown;
  interaction_type: InteractionType | null; // "vote" or "bid"
  title: string; // Title of the interaction (e.g., "Vote for Snack Choice")
  title_icon_url: string | null;
  description: string;
  device_required: string | null;
  image_url: string | null;
  options: (VoteOptions | null)[] | null;
  rules: (string | null)[] | null;
  session_date: string | null;
  result: string | null; // winning option ID
  vote_cost: number | null;
  current_bid: number | null;
  userVotes?: unknown;
  userBids?: unknown;
}

export const interactionsAtom = atom<InteractionsAtomType[]>([]);
