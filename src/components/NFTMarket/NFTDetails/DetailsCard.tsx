import { useState } from 'react';
import { StorageImage } from '@aws-amplify/ui-react-storage';
import { Loader } from '@aws-amplify/ui-react';
import { NftAtomType } from '../../../store/atoms/nftAtom';

type Props = {
  data: NftAtomType | null;
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

function NFTDetailsCard({ data }: Readonly<Props>) {
  const [isImageLoading, setIsImageLoading] = useState<boolean>(true);

  return (
    <div className="w-fit min-w-[172px] flex flex-col gap-y-6 rounded-lg border border-chocoBrown p-8 max-w-[544px]">
      <div className="relative lg:min-h-96 min-h-64">
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
            width={480}
            className="rounded-t-lg"
            onLoad={() => setIsImageLoading(false)}
          />
        ) : null}
      </div>
      {data?.rarity ? (
        <span
          className={`${getTagBG(
            'ultra rare',
          )} py-1.5 px-2 text-sm text-white rounded-lg capitalize font-bold max-w-fit`}
        >
          {data?.rarity?.replace('_', ' ')}
        </span>
      ) : null}

      <div>
        <span className="text-[28px] leading-8 font-ADLaM text-chocoBrown">Properties</span>
        {data?.properties?.map((prop) => {
          return (
            <p key={prop?.key} className="font-commissioner text-base text-chocoBrown font-normal mb-4 mt-6">
              <strong>{prop?.key}:</strong> {prop?.value}
            </p>
          );
        })}
      </div>
    </div>
  );
}

export default NFTDetailsCard;
