import { Link } from 'react-router-dom';
import NFTCard from './NFTCard';

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
    tag: 'ultra rare',
    price: 8.5,
  },
  {
    id: 3,
    title: '#12345678',
    image: 'src/assets/account/slateRat.png',
    tag: 'ultra rare',
    price: 8.5,
  },
];

export default function NftSection() {
  const btnStyle =
    'sm:text-3xl text-base font-ADLaM text-white shadow-buttonShadow rounded-lg py-2 px-4';

  return (
    <div
      className="sm:pt-10 pt-8 sm:pb-20 pb-8 md:px-[152px] px-4 -mt-[1px]"
      style={{
        background: 'linear-gradient(180deg, #D0E591 0%, #FFFFFF 100%)',
      }}
    >
      <h1 className="uppercase text-chocoBrown font-hanaleiFill text-titleSizeSM md:text-titleSize sm:pb-10 pb-6 text-center">
        MY NFT
      </h1>
      <div className="sm:flex grid auto-cols-smallCard grid-cols-2 sm:gap-x-10 sm:gap-y-10 gap-x-4 gap-y-4 justify-center pb-10">
        {nftCards?.map((card) => (
          <NFTCard key={card?.id} data={card} />
        ))}
      </div>
      <div className="flex sm:gap-x-10 gap-x-4 justify-center items-center">
        <Link
          to="/shop"
          className={`bg-darkGreen lg:shadow-loginShadow ${btnStyle}`}
        >
          Go to NFT Marketplace
        </Link>
      </div>
    </div>
  );
}
