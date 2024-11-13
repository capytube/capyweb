import { CoinCurrency, ShareIcon, XIcon } from '../../Account/Icons';
import ActivityTable from './ActivityTable';
import OfferTable from './OfferTable';
import Fb from '/src/assets/play/fb.png';
import IG from '/src/assets/play/ig.png';

type Props = {};

function NftDetails({}: Props) {
  return (
    <div className="lg:w-fit w-full flex flex-col gap-y-12">
      <div className="flex flex-col gap-y-6 border-b pb-12 border-chocoBrown">
        <span className="font-dynapuff text-[44px] leading-[52px] text-chocoBrown">
          Capy #1234
        </span>
        <span className="text-siteGreen text-2xl font-commissioner">
          Available to buy
        </span>
        <p className="flex flex-col gap-y-2 text-chocoBrown text-2xl">
          <strong>Owned by</strong>
          <span>03fksd0fl...2fg4</span>
        </p>
        <span className="flex items-center font-bold text-chocoBrown text-2xl font-Mulish">
          <CoinCurrency className="max-h-8" />
          8.5 ($100.00)
        </span>
        <button className="bg-darkGreen font-ADLaM text-white lg:shadow-loginShadow shadow-buttonShadow rounded-lg lg:text-3xl text-2xl lg:py-2 lg:px-4 py-2 max-w-[158px]">
          Buy now
        </button>
        <div className="flex gap-x-6">
          <button className="bg-avacadoCream font-ADLaM border border-darkGreen text-chocoBrown lg:shadow-loginShadow shadow-buttonShadow rounded-lg lg:text-3xl text-2xl lg:py-2 lg:px-4 p-2">
            Make an offer
          </button>
          <button className="bg-avacadoCream font-ADLaM border border-darkGreen text-chocoBrown lg:shadow-loginShadow shadow-buttonShadow rounded-lg lg:text-3xl text-2xl lg:py-2 lg:px-4 p-2">
            Offer a trade
          </button>
        </div>
        <div id="social-contacts" className="pt-2">
          <p className="font-commissioner md:text-2xl text-sm text-chocoBrown pb-4">
            Share to your social media:
          </p>
          <div className="flex justify-start gap-x-7 items-center">
            <img
              src={Fb}
              alt="facebook-icon"
              className="md:max-w-14 max-w-8"
              width={56}
            />
            <XIcon clx="max-w-14" />
            <img
              src={IG}
              alt="instagram-icon"
              className="md:max-w-14 max-w-8"
              width={56}
            />
            <ShareIcon clx="max-w-14" />
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <h3 className="text-chocoBrown font-ADLaM text-[28px] leading-8 mb-6">
          Activity
        </h3>
        <ActivityTable />
      </div>
      <div className="overflow-x-auto md:pb-0 pb-12">
        <h3 className="text-chocoBrown font-ADLaM text-[28px] leading-8 mb-6">
          Offers
        </h3>
        <OfferTable />
      </div>
    </div>
  );
}

export default NftDetails;
