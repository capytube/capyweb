import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { StorageImage } from '@aws-amplify/ui-react-storage';
import { Loader } from '@aws-amplify/ui-react';
import { CoinCurrency } from './Icons';
import { NftAtomType } from '../../store/atoms/nftAtom';

type Props = {
  data: NftAtomType;
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

function NFTCard({ data }: Readonly<Props>) {
  const pathName = useLocation()?.pathname?.slice(1);
  const [isImageLoading, setIsImageLoading] = useState<boolean>(true);

  return (
    <div className="w-fit min-w-[172px] flex flex-col rounded-lg">
      <div className="md:min-w-[282px] md:h-[282px] h-auto border-2 border-b-0 border-persimmon rounded-t-lg ">
        <div className="relative w-full h-full">
          {/* Loading Spinner */}
          {isImageLoading && (
            <div className="absolute w-full h-full rounded-3xl flex justify-center items-center">
              <Loader width="3rem" height="3rem" filledColor="#7a3f3e" />
            </div>
          )}
          {/* Actual Image */}
          {data?.image_url ? (
            <StorageImage
              alt=""
              path={data?.image_url ?? ''}
              className="h-full"
              onLoad={() => setIsImageLoading(false)}
            />
          ) : null}
        </div>
      </div>
      <div className="bg-white flex flex-col md:items-start items-center p-4 gap-y-4 rounded-b-lg border-2 border-persimmon">
        <div>
          <p className="font-commissioner text-base text-chocoBrown font-normal mb-3.5">{data?.name}</p>
          <span
            className={`${getTagBG(data?.rarity ?? '')} py-1.5 px-2 text-sm text-white rounded-lg capitalize font-bold`}
          >
            {data?.rarity?.replace('_', ' ')}
          </span>
        </div>
        <span className="flex items-center font-bold text-chocoBrown text-2xl font-Mulish">
          <CoinCurrency className="max-h-8" />
          {data?.price}
        </span>
        {pathName?.includes('shop') ? (
          <Link
            to={`/shop/${data?.id}`}
            className="border-4 max-w-[106px] md:self-end self-center border-chocoBrown rounded-lg shadow-buttonShadow bg-babyCronYellow font-ADLaM sm:py-2 py-1 px-4 text-chocoBrown sm:text-3xl text-base max-h-[57px]"
          >
            Buy
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className="border-4 max-w-[106px] md:self-end self-center border-chocoBrown rounded-lg shadow-buttonShadow bg-babyCronYellow font-ADLaM sm:py-2 py-1 px-4 text-chocoBrown sm:text-3xl text-base max-h-[57px] disabled:cursor-not-allowed"
          >
            View
          </button>
        )}
      </div>
    </div>
  );
}

export default NFTCard;
