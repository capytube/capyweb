import React from 'react';
import { useAccount } from 'wagmi';
import { useTokenBalances } from '@dynamic-labs/sdk-react-core';

import { CapyCoin, CoinCurrency, PencilIcon, UnLinkedIcon } from '../Icons';
import TopCrossRibbon from '../../ComingSoonRibbon/TopCrossRibbon';

function WalletSection({ premium = false }: { premium?: boolean }) {
  const { isConnected, address } = useAccount();
  const token = useTokenBalances();

  console.log('tokenBalances', token.tokenBalances);

  const [walletAddress, setWalletAddress] = React.useState<`0x${string}` | undefined>();
  const btnStyle =
    'sm:text-3xl text-base font-ADLaM text-white shadow-buttonShadow rounded-lg sm:py-2.5 py-1.5 sm:px-5 px-[18px]';

  React.useEffect(() => {
    if (isConnected) {
      setWalletAddress(address);
    }
  }, []);

  return (
    <div className="max-w-screen-lg mx-auto mb-10 sm:pt-10 pt-8 sm:pb-20 pb-20 sm:px-40 px-6 flex flex-col sm:gap-y-10 gap-y-6 justify-center items-center relative">
      <TopCrossRibbon glass_clsx="!backdrop-blur-[5px]" ribbon_clsx="!text-[17px] !top-[25px]" />
      <span className="font-hanaleiFill sm:text-titleSize text-titleSizeSM text-darkOrange">My capycoin wallet</span>
      <div className="flex sm:flex-row flex-col gap-x-14 sm:gap-y-0 gap-y-6 items-center md:w-max w-full">
        <CapyCoin />
        <div className="md:w-max w-full">
          <div className="flex gap-x-2 items-center md:justify-start justify-center">
            <CoinCurrency />
            <span className="sm:text-[64px] text-[45px] sm:leading-[76px] leading-[54px] font-ADLaM text-chocoBrown">
              {0}
            </span>
          </div>
          <div className="flex gap-x-2 items-center md:justify-start justify-center sm:mb-4 mb-3 mt-5">
            <span className="sm:text-2xl text-sm text-chocoBrown font-commissioner flex md:justify-start justify-center">
              Unclaimed Capy Coins
            </span>
            <button
              // disabled={(user?.totalEarnedCoins ?? 0) < 10}
              disabled
              className={`bg-siteGreen ${btnStyle} sm:text-xl sm:py-1.5 py-1 sm:px-3 px-[15px] disabled:cursor-not-allowed relative`}
            >
              {/* <CrossShadowRibbon clsx="text-[10px] sm:leading-7 leading-5 px-[5px]" /> */}
              Claim Now
            </button>
          </div>
          <div className="flex items-center sm:items-start flex-col gap-y-2 md:mt-4 mt-2 w-full leading">
            <label htmlFor="walletAddress" className="text-chocoBrown font-ADLaM sm:text-xl text-xs">
              Wallet address:
            </label>
            <div className="flex gap-x-4 items-center">
              <div className="flex gap-x-2 items-center border-2 border-chocoBrown rounded-[4px] text-chocoBrown outline-none px-3 sm:py-2.5 py-1.5 font-commissioner max-h-11 lg:min-w-[316px]">
                {!premium ? (
                  <>
                    <UnLinkedIcon />
                    <input
                      name="walletAddress"
                      type="text"
                      disabled={!premium}
                      defaultValue={(!premium && 'No wallet linked') || ''}
                      className="outline-none"
                    />
                  </>
                ) : (
                  <input
                    name="walletAddress"
                    type="text"
                    defaultValue={walletAddress}
                    disabled={!!walletAddress}
                    className="outline-none w-full"
                  />
                )}
              </div>
              <PencilIcon />
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center sm:gap-x-10 gap-x-4">
        <button type="button" disabled className={`bg-darkOrange ${btnStyle} disabled:cursor-not-allowed`}>
          {/* <CrossShadowRibbon clsx="text-[10px] sm:leading-7 leading-5 px-[5px]" /> */}
          Top up
        </button>
        <button type="button" disabled className={`bg-siteGreen ${btnStyle} disabled:cursor-not-allowed`}>
          {/* <CrossShadowRibbon clsx="text-[10px] sm:leading-7 leading-5 px-[5px]" /> */}
          Sell
        </button>
      </div>
    </div>
  );
}

export default WalletSection;
