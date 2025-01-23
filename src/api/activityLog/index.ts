import { generateClient } from 'aws-amplify/api';
import { Schema } from '../../../amplify/data/resource';
import { ActivityLogAtomType } from '../../store/atoms/activityLogAtom';

const client = generateClient<Schema>();

export async function listAllActivityLogsByNftId({ nftId }: { nftId: string }) {
  const response = await client.models.ActivityLog.listActivityLogsByNftId(
    { nftId },
    {
      selectionSet: [
        'id',
        'event',
        'price',
        'royalties',
        'from',
        'to',
        'timestamp',
        'nftId',
        'fromDetails.*',
        'toDetails.*',
      ],
    },
  );

  return response;
}

export async function createNewActivityLog(params: Omit<ActivityLogAtomType, 'id'>) {
  const response = await client.models.ActivityLog.create({
    event: params.event ?? '',
    price: params.price,
    royalties: params.royalties ?? '',
    from: params.from ?? '',
    to: params.to ?? '',
    timestamp: params.timestamp,
    nftId: params.nftId ?? '',
  });

  return response;
}

export async function deleteActivityLog({ id }: { id: string }) {
  const response = await client.models.ActivityLog.delete({ id });

  return response;
}
