import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { useSolanaTransactions } from '../../../utils/useSolanaTransactions';
import { capylMintAddress } from '../../../utils/useCapylBalance';
import { RefreshIcon } from '../Icons';

const tableHeader = [
  { title: 'Signature', minWidth: '150px' },
  { title: 'Time', minWidth: '120px' },
  { title: 'From', minWidth: '150px' },
  { title: 'To', minWidth: '150px' },
  { title: 'Amount', minWidth: '100px' },
  { title: 'Status', minWidth: '100px' },
];

const TransactionsTable = () => {
  const { primaryWallet } = useDynamicContext();
  const walletAddress = primaryWallet?.address;
  const { transactions, fetchTransactions, loading, error } = useSolanaTransactions(
    walletAddress ?? '',
    capylMintAddress ?? '',
  );

  return (
    <div className="p-6 bg-grassGreen shadow-md">
      <div className="md:w-[70%] mx-auto border border-chocoBrown rounded-lg p-3">
        <div className="flex items-center">
          <h3 className="text-xl font-semibold text-chocoBrown mb-4">Transaction History</h3>
          <button
            onClick={fetchTransactions}
            disabled={loading}
            className="mb-4 px-4 py-2 text-white rounded-lg disabled:opacity-50"
          >
            {loading ? 'Loading...' : <RefreshIcon />}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full overflow-x-auto">
            <thead className={transactions.length === 0 ? 'border-b' : 'border-t border-chocoBrown'}>
              <tr>
                {tableHeader.map((header) => (
                  <th
                    key={header.title}
                    className="text-left text-chocoBrown pt-2 pr-4 font-commissioner last:pr-0"
                    style={{ minWidth: header.minWidth }}
                  >
                    {header.title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {error || transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-chocoBrown font-commissioner">
                    {error ? 'Error fetching transactions' : 'No transactions found'}
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.signature} className="rounded-lg">
                    <td className="text-chocoBrown font-commissioner py-3">
                      <a
                        href={`https://solscan.io/tx/${tx.signature}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline"
                      >
                        {tx.signature.slice(0, 6)}...{tx.signature.slice(-6)}
                      </a>
                    </td>
                    <td className="text-chocoBrown font-commissioner py-3">{tx.time}</td>
                    <td className="text-chocoBrown font-commissioner py-3" title={tx.from}>
                      {tx.from.slice(0, 6)}...{tx.from.slice(-6)}
                    </td>
                    <td className="text-chocoBrown font-commissioner py-3" title={tx.to}>
                      {tx.to.slice(0, 6)}...{tx.to.slice(-6)}
                    </td>
                    <td className="text-chocoBrown font-commissioner py-3">{tx.amount.toFixed(4)}</td>
                    <td className="text-chocoBrown font-commissioner py-3">
                      <span
                        className={`px-2 py-1 rounded text-white ${
                          tx.status === 'Success' ? 'bg-green-700' : 'bg-green-800'
                        }`}
                      >
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TransactionsTable;
