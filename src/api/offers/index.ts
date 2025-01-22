import { generateClient } from 'aws-amplify/api';
import { Schema } from '../../../amplify/data/resource';
import { OffersAtomType } from '../../store/atoms/offersAtom';

const client = generateClient<Schema>();

export async function listAllOffersByNftId({ nftId }: { nftId: string }) {
  const response = await client.models.Offers.listOffersByNftId(
    { nftId },
    { selectionSet: ['id', 'price', 'from', 'expires_at', 'nftId', 'fromDetails.*'] },
  );

  return response;
}

export async function createNewOffer(params: Omit<OffersAtomType, 'id'>) {
  const response = await client.models.Offers.create({
    price: params.price,
    from: params.from ?? '',
    expires_at: params.expires_at,
    nftId: params.nftId ?? '',
  });

  return response;
}

export async function deleteAOffer({ id }: { id: string }) {
  const response = await client.models.Offers.delete({ id });

  return response;
}
