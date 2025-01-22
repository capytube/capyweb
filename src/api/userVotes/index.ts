import { generateClient } from 'aws-amplify/api';
import { Schema } from '../../../amplify/data/resource';
import { MakeSomeRequired } from '../../utils/function';

const client = generateClient<Schema>();

export interface UserVotesType {
  id: string | null;
  interaction_id: string; // Foreign Key to the Interactions Table
  interaction?: unknown;
  user_id: string; // Foreign Key to User
  user?: unknown;
  option_id: string | null; // ID of the option the user voted for
  number_of_votes: number | null; // Number of votes purchased
  cost: number | null; // Total cost (including extra cost for custom votes)
  is_custom_request: boolean | null; // Whether the vote is for a custom option
  custom_request: string | null; // custom request string
  approved: boolean | null; // Whether the custom request is approved (if applicable)
  tokenTransaction?: unknown;
}

type UserVotesParams = MakeSomeRequired<UserVotesType, 'interaction_id' | 'user_id'>;

export async function listAllUserVotes() {
  const response = await client.models.UserVotes.list();

  return response;
}

export async function listAllUserVotesByInteractionId(interactionId: string) {
  const response = await client.models.UserVotes.listUserVotesByInteraction_id({ interaction_id: interactionId });

  return response;
}

export async function createUserVotes(params: UserVotesParams) {
  const response = await client.models.UserVotes.create({
    interaction_id: params.interaction_id,
    user_id: params.user_id,
    option_id: params.option_id,
    number_of_votes: params.number_of_votes,
    cost: params.cost,
    is_custom_request: params.is_custom_request,
    custom_request: params.custom_request,
    approved: params.approved,
  });

  return response;
}

export async function deleteUserVotes(id: string) {
  const response = await client.models.UserVotes.delete({ id });

  return response;
}
