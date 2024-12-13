import { atom } from 'jotai';

type AccessType = 'public' | 'private';

export interface LivestreamAtomType {
  id: string | null;
  title: string | null;
  start_time: number | null;
  end_time: number | null;
  is_live: boolean | null;
  viewer_count: number | null;
  capybara_ids: string | null; // array of Capybara IDs involved in the stream
  access_type: AccessType;
  price_per_10_sec: number | null;
  streaming_address: string | null; // URL or address for the live stream
  chatComments?: unknown;
}

export const livestreamAtom = atom<LivestreamAtomType[]>([]);
