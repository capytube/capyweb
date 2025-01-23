import { generateClient } from 'aws-amplify/api';
import { getDefaultStore } from 'jotai';
import { Schema } from '../../../amplify/data/resource';
import { CapybaraAtomType, capybaraAtom } from '../../store/atoms/capybaraAtom';
import { MakeSomeRequired } from '../../utils/function';

type CapybaraAtomParams = MakeSomeRequired<CapybaraAtomType, 'name'>;

const client = generateClient<Schema>();
const defaultStore = getDefaultStore();

export async function listCapybaras() {
  const response = await client.models.Capybara.list();

  if (response?.data) {
    const data = response?.data ?? [];

    const sortedData = data
      .slice()
      .sort((a, b) => {
        const x = a?.name?.toLowerCase() ?? '';
        const y = b?.name?.toLowerCase() ?? '';
        if (x > y) {
          return 1;
        }
        if (x < y) {
          return -1;
        }
        return 0;
      })
      ?.reverse();

    defaultStore.set(capybaraAtom, sortedData);
  }

  return response;
}

export async function createCapybara(params: CapybaraAtomParams) {
  const response = await client.models.Capybara.create({
    name: params.name,
    gender: params.gender,
    birth_date: params.birth_date,
    born_place: params.born_place,
    description: params.description,
    bio: params.bio,
    personality: params.personality,
    card_image_url: params.card_image_url,
    avatar_image_url: params.avatar_image_url,
    profile_image_url: params.profile_image_url,
    favorite_activities: params.favorite_activities,
    fun_fact: params.fun_fact,
  });

  return response;
}

export async function deleteCapybara({ id }: { id: string }) {
  const response = await client.models.Capybara.delete({ id });

  return response;
}
