import { CapyCoin, CoinCurrency } from './Icons';

function WalletSection() {
  const btnStyle =
    'sm:text-3xl text-base font-ADLaM text-white shadow-buttonShadow rounded-lg sm:py-2.5 py-1.5 sm:px-5 px-[18px]';

  return (
    <div className="sm:pt-10 pt-8 sm:pb-20 pb-8 sm:px-40 px-6 flex flex-col sm:gap-y-10 gap-y-6 justify-center items-center">
      <span className="font-hanaleiFill sm:text-titleSize text-titleSizeSM text-darkOrange">
        My capycoin wallet
      </span>
      <div className="flex sm:flex-row flex-col gap-x-14 sm:gap-y-0 gap-y-6 items-center">
        <CapyCoin />
        <div>
          <div className="flex items-center sm:mb-4 mb-0 justify-center">
            <CoinCurrency />
            <span className="sm:text-[64px] text-[45px] sm:leading-[76px] leading-[54px] font-ADLaM text-chocoBrown">
              15
            </span>
          </div>
          <span className="sm:text-2xl text-sm text-chocoBrown font-commissioner">
            My current balance
          </span>
        </div>
      </div>
      <div className="flex items-center sm:gap-x-10 gap-x-4">
        <button type="button" className={`bg-darkOrange ${btnStyle}`}>
          Top up
        </button>
        <button type="button" className={`bg-siteGreen ${btnStyle} max-w-[84px]`}>
          Sell
        </button>
      </div>
    </div>
  );
}

export default WalletSection;
