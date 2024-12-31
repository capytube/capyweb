import { useEffect, useState } from 'react';
import { listAllOffersByNftId } from '../../../api/offers';
import { OffersAtomType } from '../../../store/atoms/offersAtom';
import { calculateOfferExpiration, shortenedWalletAddress } from '../../../utils/function';

type Props = { nftId: string };

const tableHeader = [
  { title: 'Price', minWidth: '60px' },
  { title: 'From', minWidth: '500px' },
  { title: 'Expires', minWidth: '88px' },
];

function OfferTable({ nftId }: Readonly<Props>) {
  // states
  const [isFetchingDataLoading, setIsFetchingDataLoading] = useState(false);
  const [allOffersData, setAllOffersData] = useState<OffersAtomType[]>([]);

  // variables
  const isNoOffersYet = allOffersData?.length === 0;

  // effects
  useEffect(() => {
    const fetchAllOffers = async () => {
      setIsFetchingDataLoading(true);
      await listAllOffersByNftId({ nftId })
        .then((res) => {
          setIsFetchingDataLoading(false);
          if (res?.data?.length) {
            setAllOffersData(res?.data);
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
    <table className="w-full overflow-x-auto">
      <thead className={isNoOffersYet ? 'border-b' : ''}>
        <tr>
          {tableHeader?.map((header) => (
            <th
              key={header?.title}
              className={`text-left text-chocoBrown pr-4 font-commissioner last:pr-0`}
              style={{ minWidth: header?.minWidth }}
            >
              {header?.title}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {allOffersData?.length > 0 ? (
          allOffersData?.map((row) => (
            <tr key={row?.id}>
              <td className="text-chocoBrown font-commissioner pt-6">{row?.price?.unit}</td>
              <td className="text-chocoBrown font-commissioner pt-6" title={row?.fromDetails?.wallet_address ?? ''}>
                {shortenedWalletAddress(row?.fromDetails?.wallet_address ?? '')}
              </td>
              <td className="text-chocoBrown font-commissioner pt-6">
                in {calculateOfferExpiration(row?.expires_at ?? 0)}
              </td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={3} className="px-4 py-6 text-center text-chocoBrown font-commissioner">
              {isFetchingDataLoading ? 'Loading...' : 'No offers yet'}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

export default OfferTable;
