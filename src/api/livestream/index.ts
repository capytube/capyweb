import { generateClient } from 'aws-amplify/api';
import { getDefaultStore } from 'jotai';
import { Schema } from '../../../amplify/data/resource';
import {
  LivestreamAtomType,
  livestreamAllAtom,
  livestreamPrivateAtom,
  livestreamPublicAtom,
} from '../../store/atoms/livestreamAtom';
import { MakeSomeRequired } from '../../utils/function';

type LivestreamParams = MakeSomeRequired<LivestreamAtomType, 'title' | 'capybara_ids'>;

const client = generateClient<Schema>();
const defaultStore = getDefaultStore();

export async function listAllLivestreams() {
  const response = await client.models.LiveStream.list();

  if (response?.data) {
    defaultStore.set(livestreamAllAtom, response?.data);
  }

  return response;
}

export async function listPublicLivestreams() {
  const response = await client.models.LiveStream.list({ filter: { access_type: { eq: 'public' } } });

  if (response?.data?.length && response?.data?.[0].id) {
    defaultStore.set(livestreamPublicAtom, response?.data);
  }

  return response;
}

export async function listPrivateLivestreams() {
  const response = await client.models.LiveStream.list({ filter: { access_type: { eq: 'private' } } });

  if (response?.data?.length && response?.data?.[0].id) {
    defaultStore.set(livestreamPrivateAtom, response?.data);
  }

  return response;
}

export async function createLivestream(params: LivestreamParams) {
  const response = await client.models.LiveStream.create({
    title: params.title,
    start_time: params.start_time,
    end_time: params.end_time,
    is_live: params.is_live,
    viewer_count: params.viewer_count,
    capybara_ids: params.capybara_ids,
    access_type: params.access_type,
    price_per_10_sec: params.price_per_10_sec,
    s3_video_address: params.s3_video_address,
    streaming_address: params.streaming_address,
    ratingCounts: params.ratingCounts,
  });

  return response;
}

export async function deleteLivestream({ id }: { id: string }) {
  const response = await client.models.LiveStream.delete({ id });

  return response;
}
