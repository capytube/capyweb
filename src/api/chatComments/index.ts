import { generateClient } from 'aws-amplify/api';
import { getDefaultStore } from 'jotai';
import { Schema } from '../../../amplify/data/resource';
import { ChatCommentsAtomType, chatCommentsAtom } from '../../store/atoms/chatCommentsAtom';
import { MakeSomeRequired } from '../../utils/function';

type ChatCommentsAtomParams = MakeSomeRequired<ChatCommentsAtomType, 'stream_id' | 'user_id' | 'content'>;

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

export async function createChatComment(params: ChatCommentsAtomParams) {
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
