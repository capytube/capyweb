import { useEffect, useState } from 'react';
import { ActivityLogAtomType } from '../../../store/atoms/activityLogAtom';
import { listAllActivityLogsByNftId } from '../../../api/activityLog';
import { calculateOfferExpiration, shortenedWalletAddress } from '../../../utils/function';

type Props = { nftId: string };

const tableHeader = [
  { title: 'Event', minWidth: '60px' },
  { title: 'Price', minWidth: '60px' },
  { title: 'Royalties', minWidth: '80px' },
  { title: 'From', minWidth: '170px' },
  { title: 'To', minWidth: '170px' },
  { title: 'Time', minWidth: '88px' },
];

export default function ActivityTable({ nftId }: Readonly<Props>) {
  // states
  const [isFetchingDataLoading, setIsFetchingDataLoading] = useState(false);
  const [allActivityData, setAllActivityData] = useState<ActivityLogAtomType[]>([]);

  // variables
  const isNoRowsYet = allActivityData?.length === 0;

  // effects
  useEffect(() => {
    const fetchAllOffers = async () => {
      setIsFetchingDataLoading(true);
      await listAllActivityLogsByNftId({ nftId })
        .then((res) => {
          setIsFetchingDataLoading(false);
          if (res?.data?.length) {
            setAllActivityData(res?.data);
          }
        })
        .catch(() => {
          setIsFetchingDataLoading(false);
        });
    };

    if (nftId) {
      fetchAllOffers();
    }
  }, [nftId]);

  return (
    <table className="w-full">
      <thead className={isNoRowsYet ? 'border-b' : ''}>
        <tr>
          {tableHeader?.map((header) => (
            <th
              key={header?.title}
              className="text-left text-chocoBrown pr-4 font-commissioner last:pr-0"
              style={{ minWidth: header?.minWidth }}
            >
              {header?.title}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {allActivityData?.length > 0 ? (
          allActivityData?.map((row) => (
            <tr key={row?.id}>
              <td className="text-chocoBrown font-commissioner pt-6">{row?.event}</td>
              <td className="text-chocoBrown font-commissioner pt-6">{row?.price?.unit}</td>
              <td
                className={`${row?.royalties === 'paid' ? 'text-siteGreen' : 'text-chocoBrown'} font-commissioner pt-6`}
              >
                {row?.royalties}
              </td>
              <td className="text-chocoBrown font-commissioner pt-6" title={row?.fromDetails?.wallet_address ?? ''}>
                {shortenedWalletAddress(row?.fromDetails?.wallet_address ?? '')}
              </td>
              <td className="text-chocoBrown font-commissioner pt-6" title={row?.toDetails?.wallet_address ?? ''}>
                {shortenedWalletAddress(row?.toDetails?.wallet_address ?? '')}
              </td>
              <td className="text-chocoBrown font-commissioner pt-6">
                {calculateOfferExpiration(row?.timestamp ?? 0)} ago
              </td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={6} className="px-4 py-6 text-center text-chocoBrown font-commissioner">
              {isFetchingDataLoading ? 'Loading...' : 'No Logs yet'}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
