import { StorageImage } from '@aws-amplify/ui-react-storage';
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
  return (
    <div className="w-fit min-w-[172px] flex flex-col gap-y-6 rounded-lg border border-chocoBrown p-8 max-w-[544px]">
      {data?.image_url ? (
        <StorageImage alt="image" path={data?.image_url ?? ''} loading="lazy" width={480} className="rounded-t-lg" />
      ) : null}
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
