import { useState, useEffect } from 'react';
import { ENV_ID } from '../Web3Provider';

interface TokenBalance {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI: string;
  balance: number;
  rawBalance: number;
  networkId?: number;
  price?: number;
  marketValue?: number;
}

interface UseCapylBalanceResult {
  data: TokenBalance | null;
  loading: boolean;
  error: string | null;
}

const API_URL = `https://app.dynamicauth.com/api/v0/sdk/${ENV_ID}/chains/SOL/balances`;
export const capylMintAddress = '4x3rzZ72Cwthrh5TRiPeCv3uY9yWZkXCKdDzhLbRpump';

export const useCapylBalance = (accountAddress: string): UseCapylBalanceResult => {
  const [data, setData] = useState<TokenBalance | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBalance = async () => {
      setLoading(true);
      setError(null);
      try {
        const authToken = localStorage.getItem('dynamic_authentication_token');
        if (!authToken) {
          throw new Error('Authentication token not found');
        }
        const parsedToken = JSON.parse(authToken);

        const response = await fetch(
          `${API_URL}?accountAddress=${accountAddress}&includePrices=true&includeNative=true`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${parsedToken}`,
            },
          },
        );

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const result: TokenBalance[] = await response.json();
        const filteredToken = result.find((token) => token.address === capylMintAddress) || null;
        setData(filteredToken);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    if (accountAddress) {
      fetchBalance();
    } else {
      setData(null);
    }
  }, [accountAddress]);

  return { data, loading, error };
};
