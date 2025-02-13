import { generateClient } from 'aws-amplify/api';
import { Schema } from '../../../amplify/data/resource';
import { MakeSomeRequired } from '../../utils/function';

const client = generateClient<Schema>();

export interface UserBidsType {
  interaction_id: string; // Foreign Key to the Interactions Table
  interaction?: unknown;
  user_id: string; // Foreign Key to User
  user?: unknown;
  bid_amount: number | null;
}

type UserBidsParams = MakeSomeRequired<UserBidsType, 'interaction_id' | 'user_id'>;

export async function listAllUserBids() {
  const response = await client.models.UserBids.list();

  return response;
}

export async function listAllUserBidsByInteractionId(interactionId: string) {
  const response = await client.models.UserBids.listUserBidsByInteraction_id({ interaction_id: interactionId });

  return response;
}

export async function createUserBids(params: UserBidsParams) {
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
