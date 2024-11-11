import React from 'react';
import { DropdownIcon } from '../../Play/Icons';
import { SearchIcon } from '../../Icons/Icons';
import NFTCard from '../../Account/NFTCard';

type Props = {};

const nftCards = [
  {
    id: 1,
    title: '#12345678',
    image: 'src/assets/account/brownRat.png',
    tag: 'ultra rare',
    price: 8.5,
  },
  {
    id: 2,
    title: '#12345678',
    image: 'src/assets/account/pinkRat.png',
    tag: 'rare',
    price: 8.5,
  },
  {
    id: 3,
    title: '#12345678',
    image: 'src/assets/account/slateRat.png',
    tag: 'epic',
    price: 8.5,
  },
];

function printValue(value: number) {
  if (value === 1) {
    return 'Low to High';
  } else if (value === 2) {
    return 'High to Low';
  }
}

export default function ListingSection({}: Props) {
  const [option, setOption] = React.useState<number>(1);
  const [isOpen, setIsOpen] = React.useState<boolean>(false);

  const optionsStyle = 'text-left text-lg p-2';

  return (
    <div className="lg:pt-10 py-8 lg:px-40 px-4 lg:pb-20 flex flex-col lg:gap-y-10 gap-y-6 items-center">
      <div className="max-w-[1260px] flex lg:flex-row flex-col gap-y-4 justify-between items-end w-full">
        <div className="w-full flex-1">
          <span className="font-ADLaM text-xl text-chocoBrown">
            Search by Token ID
          </span>
          <div className="mt-2 flex gap-x-2 items-center text-chocoBrown border-2 border-chocoBrown rounded-[4px] px-3 sm:py-2.5 py-1.5 font-commissioner max-h-11 w-full lg:max-w-[587px]">
            <SearchIcon />
            <input type="text" className="outline-none " />
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
      <div className="grid lg:grid-cols-4 grid-cols-2 max-[390px]:grid-cols-1 gap-x-11 gap-y-10">
        {[...nftCards, ...nftCards, ...nftCards]?.map((card) => (
          <NFTCard key={card?.id} data={card} />
        ))}
      </div>
    </div>
  );
}
