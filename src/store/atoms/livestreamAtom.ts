import { atom } from 'jotai';

type AccessType = 'public' | 'private';

export interface LivestreamAtomType {
  id: string | null;
  title: string;
  start_time: string | null;
  end_time: string | null;
  is_live: boolean | null;
  viewer_count: number | null;
  capybara_ids: (string | null)[]; // array of Capybara IDs involved in the stream
  access_type: AccessType | null;
  price_per_10_sec: number | null;
  s3_video_address: string | null; // S3 bucket URL address for playing custom stream
  streaming_address: string | null; // URL or address for the live stream
  ratingCounts: {
    capylove: number | null;
    capylike: number | null;
    capywow: number | null;
    capyangry: number | null;
    capyfire: number | null;
  } | null;
  chatComments?: unknown;
}

export const livestreamAllAtom = atom<LivestreamAtomType[]>([]);

export const livestreamPublicAtom = atom<LivestreamAtomType[]>([]);

export const livestreamPrivateAtom = atom<LivestreamAtomType[]>([]);
