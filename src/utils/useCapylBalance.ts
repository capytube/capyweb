import { useState, useEffect } from 'react';
import { CAPYL_MINT_ADDRESS, DYNAMIC_SOL_BALANCE_API_URL } from './constants';
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
          `${DYNAMIC_SOL_BALANCE_API_URL}?accountAddress=${accountAddress}&includePrices=true&includeNative=true`,
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
        const filteredToken = result.find((token) => token.address === CAPYL_MINT_ADDRESS) || null;
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
