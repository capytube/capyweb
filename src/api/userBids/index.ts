import { generateClient } from 'aws-amplify/api';
import { Schema } from '../../../amplify/data/resource';

const client = generateClient<Schema>();

export interface UserBidsType {
  interaction_id: string | null; // Foreign Key to the Interactions Table
  interaction?: unknown;
  user_id: string | null; // Foreign Key to User
  user?: unknown;
  bid_amount: number | null;
  tokenTransaction?: unknown;
}

export async function listAllUserBids() {
  const response = await client.models.UserBids.list();

  return response;
}

export async function listAllUserBidsByInteractionId(interactionId: string) {
  const response = await client.models.UserBids.listUserBidsByInteraction_id({ interaction_id: interactionId });

  return response;
}

export async function createUserBids(params: Partial<UserBidsType>) {
  const response = await client.models.UserBids.create({
    interaction_id: params.interaction_id,
    user_id: params.user_id,
    bid_amount: params.bid_amount,
  });

  return response;
}

export async function deleteUserBids(id: string) {
  const response = await client.models.UserBids.delete({ id });

  return response;
}
