import { Link, useLocation } from 'react-router-dom';
import { CoinCurrency } from './Icons';

type Props = {
  data: {
    image: string;
    title: string;
    id: number;
    price: number;
    tag: string;
  };
};

function getTagBG(value: string) {
  if (value === 'rare') {
    return 'bg-[#7542AB]';
  } else if (value === 'epic') {
    return 'bg-tomatoRed';
  } else {
    return 'bg-siteGreen';
  }
}

function NFTCard({ data }: Props) {
  const pathName = useLocation()?.pathname?.slice(1);

  return (
    <div className="w-fit min-w-[172px] flex flex-col rounded-lg">
      <img
        className="border-2 border-b-0 border-persimmon rounded-t-lg"
        src={data?.image}
        width={282}
        alt="image"
      />
      <div className="bg-white flex flex-col md:items-start items-center p-4 gap-y-4 rounded-b-lg border-2 border-persimmon">
        <div>
          <p className="font-commissioner text-base text-chocoBrown font-normal mb-3.5">
            {data?.title}
          </p>
          <span
            className={`${getTagBG(
              data?.tag
            )} py-1.5 px-2 text-sm text-white rounded-lg capitalize font-bold`}
          >
            {data?.tag}
          </span>
        </div>
        <span className="flex items-center font-bold text-chocoBrown text-2xl font-Mulish">
          <CoinCurrency className="max-h-8" />
          {data?.price}
        </span>
        {pathName === 'shop' ? (
          <Link
            to="/shop/1"
            className="border-4 max-w-[106px] md:self-end self-center border-chocoBrown rounded-lg shadow-buttonShadow bg-babyCronYellow font-ADLaM sm:py-2 py-1 px-4 text-chocoBrown sm:text-3xl text-base max-h-[57px]"
          >
            Buy
          </Link>
        ) : (
          <button
            type="button"
            className="border-4 max-w-[106px] md:self-end self-center border-chocoBrown rounded-lg shadow-buttonShadow bg-babyCronYellow font-ADLaM sm:py-2 py-1 px-4 text-chocoBrown sm:text-3xl text-base max-h-[57px]"
          >
            View
          </button>
        )}
      </div>
    </div>
  );
}

export default NFTCard;
