import { useEffect, useState } from 'react';
import { useAtomValue } from 'jotai';
import { DropdownIcon } from '../../Play/Icons';
import { SearchIcon } from '../../Icons/Icons';
import NFTCard from '../../Account/NFTCard';
import { nftAtom } from '../../../store/atoms/nftAtom';
import { listAllNfts } from '../../../api/nft';

function printValue(value: number) {
  if (value === 1) {
    return 'Low to High';
  } else if (value === 2) {
    return 'High to Low';
  }
}

export default function ListingSection() {
  // hooks
  const allNftData = useAtomValue(nftAtom);

  // states
  const [option, setOption] = useState<number>(1); // 1 for ASC, 2 for DESC
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isFetchingDataLoading, setIsFetchingDataLoading] = useState(true);
  const [sortedData, setSortedData] = useState(allNftData);
  const [searchedText, setSearchedText] = useState<string>('');

  // variables
  const optionsStyle = 'text-left text-lg p-2 rounded-lg hover:bg-[#faceaf]';

  // effects
  useEffect(() => {
    const fetchAllNfts = async () => {
      await listAllNfts()
        .then(() => {
          setIsFetchingDataLoading(false);
        })
        .catch(() => {
          setIsFetchingDataLoading(false);
        });
    };

    fetchAllNfts();
  }, []);

  // Sort data whenever `option` or `allNftData` changes
  useEffect(() => {
    const sortData = [...allNftData].sort((a, b) => {
      if (option === 1) {
        return (a?.price ?? 0) - (b?.price ?? 0); // Ascending order
      } else if (option === 2) {
        return (b?.price ?? 0) - (a?.price ?? 0); // Descending order
      }

      return 0;
    });

    setSortedData(sortData);
  }, [option, allNftData]);

  // filter nft data by search text
  useEffect(() => {
    const filteredData = [...allNftData].filter((nft) => String(nft?.name).includes(searchedText));
    setSortedData(filteredData);
  }, [searchedText]);

  return (
    <div className="lg:pt-10 py-8 lg:px-40 px-4 pb-20 flex flex-col lg:gap-y-10 gap-y-6 items-center">
      <div className="max-w-[1260px] flex lg:flex-row flex-col gap-y-4 justify-between items-end w-full">
        <div className="w-full flex-1">
          <span className="font-ADLaM text-xl text-chocoBrown">Search by Token ID</span>
          <div className="mt-2 flex gap-x-2 items-center text-chocoBrown border-2 border-chocoBrown rounded-[4px] px-3 sm:py-2.5 py-1.5 font-commissioner max-h-11 w-full lg:max-w-[587px]">
            <SearchIcon />
            <input
              type="text"
              className="outline-none w-full"
              value={searchedText}
              onChange={(e) => setSearchedText(e.target.value)}
            />
          </div>
        </div>
        <div className="relative md:w-max w-full">
          <button
            type="button"
            className="flex items-cente max-h-[50px] gap-x-2 text-base font-commissioner text-chocoBrown border-2 border-chocoBrown px-4 md:py-3 py-1.5  justify-between rounded-lg bg-white"
            onClick={() => setIsOpen(!isOpen)}
          >
            Price: {printValue(option)}
            <DropdownIcon className={`${isOpen ? 'rotate-180' : ''}`} />
          </button>
          {isOpen ? (
            <div className="absolute right-0 flex flex-col bg-cream w-full text-chocoBrown top-14 rounded-lg p-2">
              <button
                type="button"
                className={optionsStyle}
                onClick={() => {
                  setOption(1);
                  setIsOpen(!isOpen);
                }}
              >
                Low to High
              </button>
              <button
                type="button"
                className={optionsStyle}
                onClick={() => {
                  setOption(2);
                  setIsOpen(!isOpen);
                }}
              >
                High to Low
              </button>
            </div>
          ) : null}
        </div>
      </div>
      {(() => {
        if (isFetchingDataLoading) {
          return 'Loading...';
        } else if (sortedData?.length > 0) {
          return (
            <div className="grid 2xl:grid-cols-4 lg:grid-cols-3 grid-cols-2 max-[390px]:grid-cols-1 2xl:gap-x-11 lg:gap-x-16 gap-x-11 gap-y-10">
              {sortedData?.map((data) => (
                <NFTCard key={data?.id} data={data} />
              ))}
            </div>
          );
        } else if (searchedText && !sortedData?.length) {
          return (
            <div className="font-hanaleiFill text-chocoBrown md:text-4xl text-xl text-center px-3 sm:py-16">
              No NFT matched with your searched value
            </div>
          );
        } else {
          return (
            <div className="font-hanaleiFill text-chocoBrown md:text-4xl text-xl text-center px-3 sm:py-16">
              The NFTs aren't available right now
            </div>
          );
        }
      })()}
    </div>
  );
}
