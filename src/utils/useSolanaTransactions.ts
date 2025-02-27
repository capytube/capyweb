import { useState, useEffect } from 'react';
import { Connection, PublicKey, ParsedConfirmedTransaction } from '@solana/web3.js';

interface TransactionData {
  signature: string;
  time: string;
  from: string;
  to: string;
  amount: number;
  status: string;
}

const mainnetUrl =
  'https://solana-mainnet.api.syndica.io/api-key/31XK4MAY4riQcjjEa78Zfre6C728JAwsV5WAySUuqmBVBUCtXmTHucp7evLydqbfmeGJJijXHzrYQD7d8Lb1zJC54URU8fayshY';
// const devnetUrl = 'https://api.devnet.solana.com';

const SOLANA_RPC_URL = mainnetUrl;

export const useSolanaTransactions = (CURR_WALLET_ADDR: string, CAPYL_MINT_ADDR: string) => {
  const [transactions, setTransactions] = useState<TransactionData[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = async () => {
    if (!CURR_WALLET_ADDR) return;

    setLoading(true);
    setError(null);

    try {
      const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
      const address = new PublicKey(CAPYL_MINT_ADDR);

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
          // Filter: Include only transactions where "from" or "to" matches CURR_WALLET_ADDR
          if (formattedTx?.from === CURR_WALLET_ADDR || formattedTx?.to === CURR_WALLET_ADDR) {
            return formattedTx;
          }

          return null; // Exclude transactions that don't match
        }),
      );

      // Filter out null transactions (if any)
      setTransactions(fetchedTransactions.filter((tx): tx is TransactionData => tx !== null));
    } catch (err) {
      setError('Error fetching transactions');
      console.error('Error fetching transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  return { transactions, fetchTransactions, loading, error };
};

// Helper function to extract transaction details
const formatTransactionData = (tx: ParsedConfirmedTransaction): TransactionData | null => {
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
