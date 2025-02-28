import { useAtom } from 'jotai';
import { useState, useEffect } from 'react';
import { Connection, PublicKey, ParsedConfirmedTransaction } from '@solana/web3.js';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { isSolanaWallet } from '@dynamic-labs/solana';
import { CAPYL_MINT_ADDRESS } from './constants';
import { AllTransactionData, allTransactionsData } from '../store/atoms';

export const useSolanaTransactions = ({ page }: { page: 'play' | 'account' }) => {
  const { primaryWallet } = useDynamicContext();
  const currWalletAddress = primaryWallet?.address;

  const [transactions, setTransactions] = useAtom(allTransactionsData);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = async () => {
    if (!primaryWallet || !currWalletAddress || !isSolanaWallet(primaryWallet)) {
      console.error('No Solana wallet connected');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const connection: Connection = await primaryWallet.getConnection();
      const address = new PublicKey(CAPYL_MINT_ADDRESS);

      // Fetch recent transaction signatures
      const signatures = await connection.getSignaturesForAddress(address, { limit: 5 });

      // Fetch details for each transaction
      const fetchedTransactions = await Promise.all(
        signatures.map(async (tx) => {
          const details = await connection.getParsedTransaction(tx.signature, {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0,
          });

          if (!details) return null; // Skip if no details found

          const formattedTx = formatTransactionData(details);
          // Filter: Include only transactions where "from" or "to" matches currWalletAddress
          if (formattedTx?.from === currWalletAddress || formattedTx?.to === currWalletAddress) {
            return formattedTx;
          }

          return null; // Exclude transactions that don't match
        }),
      );

      // Filter out null transactions (if any)
      setTransactions(fetchedTransactions.filter((tx): tx is AllTransactionData => tx !== null));
    } catch (err) {
      setError('Error fetching transactions');
      console.error('Error fetching transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (page === 'account') {
      fetchTransactions();
    }
  }, [page]);

  return { transactions, fetchTransactions, loading, error };
};

// Helper function to extract transaction details
const formatTransactionData = (tx: ParsedConfirmedTransaction): AllTransactionData | null => {
  if (!tx.meta || !tx.transaction.message.accountKeys) return null;

  const signature = tx.transaction.signatures[0];
  const blockTime = tx.blockTime ? new Date(tx.blockTime * 1000).toLocaleString() : 'Unknown';

  // Extract sender & receiver
  const from = tx.transaction.message.accountKeys[0].pubkey.toBase58();
  const to = tx.transaction.message.accountKeys[1].pubkey.toBase58();

  // Calculate amount transferred
  const preBalance = tx.meta.preBalances[1] ?? 0;
  const postBalance = tx.meta.postBalances[1] ?? 0;
  const amount = (preBalance - postBalance) / 1e6; // Convert lamports to CAPYL

  return {
    signature,
    time: blockTime,
    from,
    to,
    amount,
    status: tx.meta.err ? 'Failed' : 'Confirmed',
  };
};
