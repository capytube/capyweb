import { atom } from 'jotai';

interface userType {
  id: string | null;
  name: string | null;
  createdAt: number | null;
}

interface commentsType {
  id: string | null;
  streamId: string | null;
  content: string | null;
  user: {
    name: string | null;
    createdAt: number | null;
    id: string | null;
    updatedAt: string | null;
  };
}

export const userAtom = atom<userType>({
  id: '',
  name: '',
  createdAt: 0,
});

export const walletAtom = atom<`0x${string}` | null>(null);
export const loadingAtom = atom<boolean>(false);

export const commentsAtom = atom<Array<commentsType> | []>([
  {
    id: null,
    streamId: null,
    content: null,
    user: {
      name: null,
      createdAt: null,
      id: null,
      updatedAt: null,
    },
  },
]);
