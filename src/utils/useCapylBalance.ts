import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { clusterApiUrl, Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';

const connection = new Connection(clusterApiUrl('mainnet-beta'), 'confirmed'); // mainnet URL for production
const CAPYL_TOKEN_MINT = new PublicKey('4x3rzZ72Cwthrh5TRiPeCv3uY9yWZkXCKdDzhLbRpump'); // capyl actual mint address

const useCapylBalance = async () => {
  const { primaryWallet } = useDynamicContext();
  const userWalletAddress = primaryWallet?.address;

  if (!userWalletAddress) return { balance: 0, error: 'No wallet connected' };

  try {
    const userWallet = new PublicKey(userWalletAddress);

    // Get Associated Token Account (ATA) for CAPYL
    const capylATA = await getAssociatedTokenAddress(CAPYL_TOKEN_MINT, userWallet);

    // Fetch account balance
    const capylAccount = await getAccount(connection, capylATA);
    const balance = Number(capylAccount.amount) / Math.pow(10, 6); // As CAPYL has 6 decimals

    return { balance, error: null };
  } catch (error) {
    console.error('Error fetching CAPYL balance:', error);
    return { balance: 0, error: error };
  }
};

export default useCapylBalance;
