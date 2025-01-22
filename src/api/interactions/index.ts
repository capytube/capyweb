import { generateClient } from 'aws-amplify/api';
import { getDefaultStore } from 'jotai';
import { Schema } from '../../../amplify/data/resource';
import { InteractionsAtomType, interactionsAtom } from '../../store/atoms/interactionsAtom';
import { MakeSomeRequired } from '../../utils/function';

type InteractionsAtomParams = MakeSomeRequired<InteractionsAtomType, 'capybara_id' | 'title' | 'description'>;

const client = generateClient<Schema>();
const defaultStore = getDefaultStore();

export async function listAllInteractionsByCapyId({ capyId }: { capyId: string }) {
  const response = await client.models.Interactions.listInteractionsByCapybara_idAndInteraction_type({
    capybara_id: capyId,
  });

  if (response?.data?.length) {
    defaultStore.set(interactionsAtom, response?.data);
  }

  return response;
}

export async function createInteractions(params: InteractionsAtomParams) {
  const response = await client.models.Interactions.create({
    capybara_id: params.capybara_id,
    interaction_type: params.interaction_type,
    title: params.title,
    title_icon_url: params.title_icon_url,
    description: params.description,
    device_required: params.device_required,
    image_url: params.image_url,
    options: params.options,
    rules: params.rules,
    session_date: params.session_date,
    result: params.result,
    vote_cost: params.vote_cost,
    current_bid: params.current_bid,
  });

  return response;
}

export async function deleteInteractions({ id }: { id: string }) {
  const response = await client.models.Interactions.delete({ id });

  return response;
}
