import { generateClient } from 'aws-amplify/api';
import { getDefaultStore } from 'jotai';
import { Schema } from '../../../amplify/data/resource';
import { NftAtomType, isForSaleNftAtom, nftAtom, specifiOwnerNftAtom } from '../../store/atoms/nftAtom';

const client = generateClient<Schema>();
const defaultStore = getDefaultStore();

export async function listAllNfts() {
  const response = await client.models.NFT.list({
    selectionSet: [
      'id',
      'name',
      'image_url',
      'rarity',
      'labels',
      'properties.*',
      'price.*',
      'is_for_sale',
      'owner_id',
      'createdAt',
      'owner_details.*',
    ],
  });

  if (response?.data?.length) {
    // @ts-ignore
    defaultStore.set(nftAtom, response?.data);
  }

  return response;
}

export async function listNftsByIsForSale({ isForSale }: { isForSale: 0 | 1 }) {
  const response = await client.models.NFT.listNFTByIs_for_sale(
    { is_for_sale: isForSale },
    {
      selectionSet: [
        'id',
        'name',
        'image_url',
        'rarity',
        'labels',
        'properties.*',
        'price.*',
        'is_for_sale',
        'owner_id',
        'createdAt',
        'owner_details.*',
      ],
    },
  );

  if (response?.data?.length) {
    // @ts-ignore
    defaultStore.set(isForSaleNftAtom, response?.data);
  }

  return response;
}

export async function listNFTByOwnerId({ ownerId }: { ownerId: string }) {
  const response = await client.models.NFT.listNFTByOwner_id(
    { owner_id: ownerId },
    {
      selectionSet: [
        'id',
        'name',
        'image_url',
        'rarity',
        'labels',
        'properties.*',
        'price.*',
        'is_for_sale',
        'owner_id',
        'createdAt',
        'owner_details.*',
      ],
    },
  );

  if (response?.data?.length) {
    // @ts-ignore
    defaultStore.set(specifiOwnerNftAtom, response?.data);
  }

  return response;
}

export async function getNftById({ id }: { id: string }) {
  const response = await client.models.NFT.get({ id });

  return response;
}

export async function createNft(params: Partial<NftAtomType>) {
  const response = await client.models.NFT.create({
    name: params.name,
    image_url: params.image_url,
    rarity: params.rarity,
    labels: params.labels,
    properties: params.properties,
    price: params.price,
    is_for_sale: params.is_for_sale,
    owner_id: params.owner_id,
    createdAt: new Date().getTime(),
  });

  return response;
}

export async function deleteNft({ id }: { id: string }) {
  const response = await client.models.NFT.delete({ id });

  return response;
}
