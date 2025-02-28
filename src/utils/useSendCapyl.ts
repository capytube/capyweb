import { useSetAtom } from 'jotai';
import { toast } from 'react-hot-toast';
import { Connection, PublicKey, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { isSolanaWallet } from '@dynamic-labs/solana';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { CAPYL_MINT_ADDRESS } from './constants';
import { CapylPaymentTransactionData, capylPaymenttransactionsAtom } from '../store/atoms';

const CAPYL_TOKEN_MINT = new PublicKey(CAPYL_MINT_ADDRESS);

export const useSendCAPYL = () => {
  const { primaryWallet } = useDynamicContext();
  const setCapylTransactions = useSetAtom(capylPaymenttransactionsAtom);

  const sendCAPYL = async (recipientAddress: string, amount: number) => {
    if (!primaryWallet || !isSolanaWallet(primaryWallet)) {
      toast.error('No Solana wallet connected');
      return;
    }

    console.log('⏳ Sending CAPYL...');
    const connection: Connection = await primaryWallet.getConnection();
    const fromKey = new PublicKey(primaryWallet.address);
    const toKey = new PublicKey(recipientAddress);

    try {
      // Check if recipient has a CAPYL token account
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(toKey, {
        mint: new PublicKey(CAPYL_TOKEN_MINT),
      });

      if (tokenAccounts.value.length === 0) {
        console.error('Recipient does not have a CAPYL token account!');
        toast.error('Recipient does not have a CAPYL token account!');
        return null; // Exit
      }
    } catch (err) {
      console.error('Error fetching recipient token accounts:', err);
      toast.error('Error fetching recipient token accounts!');
      return null; // Exit
    }

    // Get Associated Token Accounts (ATA)
    const senderTokenAccount = await getAssociatedTokenAddress(CAPYL_TOKEN_MINT, fromKey);
    const recipientTokenAccount = await getAssociatedTokenAddress(CAPYL_TOKEN_MINT, toKey);

    // Amount in smallest unit (CAPYL = 6 decimals)
    const amountInSmallestUnit = amount * Math.pow(10, 6);

    // Create transfer instruction
    const transferInstruction = createTransferInstruction(
      senderTokenAccount,
      recipientTokenAccount,
      fromKey,
      amountInSmallestUnit,
      [],
      TOKEN_PROGRAM_ID,
    );

    // Get latest blockhash
    const blockhash = await connection.getLatestBlockhash();

    // Create transaction message
    const messageV0 = new TransactionMessage({
      instructions: [transferInstruction],
      payerKey: fromKey,
      recentBlockhash: blockhash.blockhash,
    }).compileToV0Message();

    // Create versioned transaction
    const transferTransaction = new VersionedTransaction(messageV0);

    // Sign and send transaction
    const signer = await primaryWallet.getSigner();

    // Show pending toast and store the toast ID
    const loadingToastId = toast.loading('Transaction Pending... We will notify you when confirmed.');

    try {
      const res = await signer.signAndSendTransaction(transferTransaction);
      const signature = res.signature;
      console.log(`Transaction Sent: ${signature}`);

      // Store transaction in Jotai state with "pending" status
      setCapylTransactions((prev) => [...prev, { signature, status: 'pending' } as CapylPaymentTransactionData]);

      // Wait for confirmation
      await connection.confirmTransaction(signature, 'confirmed');

      // Update transaction status to "confirmed"
      setCapylTransactions((prev) =>
        prev.map((tx) => (tx.signature === signature ? { ...tx, status: 'confirmed' } : tx)),
      );

      console.log(`✅ Transaction Confirmed: ${signature}`);
      // Update the toast from loading to success
      toast.success(`Transaction Confirmed! ✅`, {
        id: loadingToastId,
      });

      return signature;
    } catch (err) {
      console.error('Transaction failed:', err);
      // Update the toast from loading to error
      toast.error('Transaction Failed ❌', { id: loadingToastId });

      return null;
    }
  };

  return { sendCAPYL };
};
