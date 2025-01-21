import { generateClient } from 'aws-amplify/api';
import { getDefaultStore } from 'jotai';
import { Schema } from '../../../amplify/data/resource';
import { ChatCommentsAtomType, chatCommentsAtom } from '../../store/atoms/chatCommentsAtom';

const client = generateClient<Schema>();
const defaultStore = getDefaultStore();

export async function listAllComments({ streamId }: { streamId: string }) {
  const response = await client.models.ChatComments.listChatCommentsByStream_id(
    { stream_id: streamId },
    { selectionSet: ['id', 'stream_id', 'user_id', 'content', 'createdAt', 'user.*'] },
  );

  if (response?.data) {
    const data = response?.data ?? [];
    defaultStore.set(chatCommentsAtom, data);
  }

  return response;
}

export async function createChatComment(params: Partial<ChatCommentsAtomType>) {
  const response = await client.models.ChatComments.create({
    stream_id: params.stream_id,
    user_id: params.user_id,
    content: params.content,
  });

  return response;
}

export async function deleteChatComment({ id }: { id: string }) {
  const response = await client.models.ChatComments.delete({ id });

  return response;
}
