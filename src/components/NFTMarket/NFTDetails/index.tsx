import NFTDetailsCard from './DetailsCard';
import NftDetails from './NftDetails';

type Props = {};

export default function index({}: Props) {
  return (
    <div className="flex lg:flex-row flex-col gap-y-10 gap-x-12 lg:pb-20 lg:pt-10 py-8 px-4 lg:px-40 lg:justify-start justify-center lg:items-start items-center">
      <NFTDetailsCard />
      <NftDetails />
    </div>
  );
}
