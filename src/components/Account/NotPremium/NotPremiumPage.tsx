import { PencilIcon } from '../Icons';
import NftSection from '../NoLoginPage/NftSection';
import WalletSection from '../WalletSection/WalletSection';

type Props = {};

export default function NotPremiumPage({}: Props) {
  return (
    <div>
      <div className="bg-grassGreen md:pt-20 md:pb-16 py-8 md:px-0 px-4 flex flex-col justify-center items-center md:gap-y-6 gap-y-4">
        <h1 className="font-hanaleiFill md:text-titleSize text-titleSizeSM text-darkGreen">
          My account
        </h1>
        <div className="py-6 px-6 flex flex-col justify-center gap-y-2 md:w-fit w-full">
          <label
            htmlFor="name"
            className="text-chocoBrown md:text-xl text-xs font-ADLaM"
          >
            Display name
          </label>
          <div className="flex gap-x-4 items-center">
            <input
              name="name"
              type="text"
              className="border-2 border-chocoBrown rounded-[4px] outline-none px-3 sm:py-2.5 py-1.5 font-commissioner max-h-11 w-full lg:min-w-[316px] lg:max-w-[316px] max-w-[266px]"
            />
            <PencilIcon />
          </div>
        </div>
      </div>
      <NftSection />
      <WalletSection />
    </div>
  );
}
