import { atom } from 'jotai';

export type TransactionStatus = 'pending' | 'confirmed' | 'failed';

export type CapylPaymentTransactionData = {
  signature: string;
  status: TransactionStatus;
};

export interface AllTransactionData {
  signature: string;
  time: string;
  from: string;
  to: string;
  amount: number;
  status: string;
}

export const walletAtom = atom<string | null>(null);

export const capylPaymenttransactionsAtom = atom<CapylPaymentTransactionData[]>([]);

export const allTransactionsData = atom<AllTransactionData[]>([]);
