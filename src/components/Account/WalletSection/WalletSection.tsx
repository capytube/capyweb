import React from 'react';
import { CapyCoin, CoinCurrency, PencilIcon, UnLinkedIcon } from '../Icons';
import { useAccount } from 'wagmi';
import { useTokenBalances } from '@dynamic-labs/sdk-react-core';

function WalletSection({ premium = false }: { premium?: boolean }) {
  const { isConnected, address } = useAccount();
  const token = useTokenBalances();

  console.log("tokenBalances", token.tokenBalances)

  const [walletAddress, setWalletAddress] = React.useState<
    `0x${string}` | undefined
  >();
  const btnStyle =
    'sm:text-3xl text-base font-ADLaM text-white shadow-buttonShadow rounded-lg sm:py-2.5 py-1.5 sm:px-5 px-[18px]';

  React.useEffect(() => {
    if (isConnected) {
      setWalletAddress(address);
    }
  }, []);

  return (
    <div className="sm:pt-10 pt-8 sm:pb-20 pb-20 sm:px-40 px-6 flex flex-col sm:gap-y-10 gap-y-6 justify-center items-center">
      <span className="font-hanaleiFill sm:text-titleSize text-titleSizeSM text-darkOrange">
        My capycoin wallet
      </span>
      <div className="flex sm:flex-row flex-col gap-x-14 sm:gap-y-0 gap-y-6 items-center md:w-max w-full">
        <CapyCoin />
        <div className="md:w-max w-full">
          <div className="flex items-center md:justify-start justify-center sm:mb-4 mb-2">
            <CoinCurrency />
            <span className="sm:text-[64px] text-[45px] sm:leading-[76px] leading-[54px] font-ADLaM text-chocoBrown">
              15
            </span>
          </div>
          <span className="sm:text-2xl text-sm text-chocoBrown font-commissioner flex md:justify-start justify-center">
            My current balance
          </span>
          <div className="flex flex-col gap-y-2 md:mt-4 mt-2 w-full">
            <label
              htmlFor="walletAddress"
              className="text-chocoBrown font-ADLaM sm:text-xl text-xs"
            >
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
                      value={(!premium && 'No wallet linked') || ''}
                      className="outline-none"
                    />
                  </>
                ) : (
                  <input
                    name="walletAddress"
                    type="text"
                    value={walletAddress}
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
        <button type="button" className={`bg-darkOrange ${btnStyle}`}>
          Top up
        </button>
        <button
          type="button"
          className={`bg-siteGreen ${btnStyle} max-w-[84px]`}
        >
          Sell
        </button>
      </div>
    </div>
  );
}

export default WalletSection;
