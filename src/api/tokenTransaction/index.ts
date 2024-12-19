import { generateClient } from 'aws-amplify/api';
import { Schema } from '../../../amplify/data/resource';

const client = generateClient<Schema>();

type TransactionType = 'tip' | 'reward' | 'stream_payment' | 'transfer' | 'withdraw' | 'deposit' | 'vote' | 'bid';
type InteractionType = 'vote' | 'bid';

export interface TokenTransactionType {
  user_id: string | null; // Foreign Key to User
  user?: unknown;
  transaction_type: TransactionType | null;
  amount: number | null; // Transaction amount in tokens
  related_id: string | null; // Id of either UserVotes or UserBids
  related_type: InteractionType | null;
  relatedVote?: unknown;
  relatedBid?: unknown;
  createdAt: number | null;
}

export async function listAllTokenTransactions() {
  const response = await client.models.TokenTransaction.list({
    selectionSet: [
      'id',
      'user_id',
      'user.*',
      'transaction_type',
      'amount',
      'related_id',
      'related_type',
      'relatedVote.*',
      'relatedBid.*',
      'createdAt',
    ],
  });

  return response;
}

export async function listTokenTransactionById(id: string) {
  const response = await client.models.TokenTransaction.get(
    { id },
    {
      selectionSet: [
        'id',
        'user_id',
        'user.*',
        'transaction_type',
        'amount',
        'related_id',
        'related_type',
        'relatedVote.*',
        'relatedBid.*',
        'createdAt',
      ],
    },
  );

  return response;
}

export async function createTokenTransaction(params: Partial<TokenTransactionType>) {
  const response = await client.models.TokenTransaction.create({
    user_id: params.user_id,
    transaction_type: params.transaction_type,
    amount: params.amount,
    related_id: params.related_id,
    related_type: params.related_type,
    createdAt: params.createdAt ?? new Date().getTime(),
  });

  return response;
}

export async function deleteTokenTransaction(id: string) {
  const response = await client.models.TokenTransaction.delete({ id });

  return response;
}
