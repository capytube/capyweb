import { CoinCurrency, ShareIcon, XIcon } from '../../Account/Icons';
import Fb from '/src/assets/play/fb.png';
import IG from '/src/assets/play/ig.png';

type Props = {};

function NftDetails({}: Props) {
  return (
    <div className="lg:w-fit w-full">
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
        <button className="bg-darkGreen text-white lg:shadow-loginShadow shadow-buttonShadow rounded-lg text-3xl lg:py-2 lg:px-4 max-w-[158px]">
          Buy now
        </button>
        <div className="flex gap-x-6">
          <button className="bg-avacadoCream border border-darkGreen text-chocoBrown lg:shadow-loginShadow shadow-buttonShadow rounded-lg text-3xl lg:py-2 lg:px-4 ">
            Make an offer
          </button>
          <button className="bg-avacadoCream border border-darkGreen text-chocoBrown lg:shadow-loginShadow shadow-buttonShadow rounded-lg text-3xl lg:py-2 lg:px-4 ">
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
              className="md:max-w-max max-w-8"
              width={56}
            />
            <XIcon />
            <img
              src={IG}
              alt="instagram-icon"
              className="md:max-w-max max-w-8"
              width={56}
            />
            <ShareIcon />
          </div>
        </div>
      </div>
      <div>
        <h3 className="text-chocoBrown font-ADLaM text-[28px] leading-8">
          Activity
        </h3>
        <h3 className="text-chocoBrown font-ADLaM text-[28px] leading-8">
          Offers
        </h3>
      </div>
    </div>
  );
}

export default NftDetails;
