import { MouseEventHandler, useEffect } from 'react';
import { StorageImage } from '@aws-amplify/ui-react-storage';
import Fb from '/src/assets/play/fb.png';
import Ig from '/src/assets/play/ig.png';
import { ShareIcon, XIcon } from '../../Account/Icons';
import { InteractionsAtomType } from '../../../store/atoms/interactionsAtom';
import { capitalizeWords } from '../../../utils/function';

type Props = {
  finalInteractedData: InteractionsAtomType | null;
  capySelectedFood: string | null;
  capyData: { id: string; name: string; image: string };
  handleVoteAgain: MouseEventHandler<HTMLElement>;
};

function ThanksSection({ finalInteractedData, capySelectedFood, capyData, handleVoteAgain }: Readonly<Props>) {
  // variables
  const isVoteType = finalInteractedData?.interaction_type === 'vote';
  const isBidType = finalInteractedData?.interaction_type === 'bid';

  // functions
  const bgColor = () => {
    if (isVoteType) {
      return 'bg-babyCronYellow';
    } else if (isBidType) {
      if (finalInteractedData?.title?.includes('safari')) {
        return 'bg-custard';
      } else {
        return 'bg-cream';
      }
    }
  };

  const handleScrollTop = () => {
    const ele = document.getElementById('thanks-section');
    ele?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  // effects
  useEffect(() => {
    handleScrollTop();
    return () => {
      handleScrollTop();
    };
  }, []);

  return (
    <div id="thanks-section" className={`${bgColor()} shadow-characterCard md:px-16 md:py-6  p-6 max-w-[744px]`}>
      <h2 className="md:text-5xl text-2xl font-dynapuff text-chocoBrown text-center">
        Thank you for your {isVoteType ? 'vote!' : 'bid!'}
      </h2>
      <div className="md:py-12 py-6 flex justify-center">
        {finalInteractedData?.image_url ? (
          <StorageImage
            alt="image"
            path={finalInteractedData?.image_url ?? ''}
            loading="lazy"
            className="md:max-w-max max-w-[194px]"
          />
        ) : null}
      </div>
      <div id="description" className="flex flex-col items-center md:pb-10 pb-6 gap-y-6">
        {isVoteType ? (
          <>
            <p className="text-chocoBrown font-ADLaM md:text-[26px] md:leading-8 text-sm text-center font-semibold">
              You have voted ‘{capySelectedFood}’ for {capitalizeWords(capyData?.name ?? '')}
            </p>
            <p className="text-chocoBrown font-commissioner md:text-2xl text-sm text-center">
              You may come back and watch your capy munching later at 9:00 AM tomorrow.
            </p>
          </>
        ) : null}

        {isBidType ? (
          <>
            <p className="text-chocoBrown font-ADLaM md:text-[26px] md:leading-8 text-sm text-center font-semibold">
              What’s next?
            </p>
            <p className="text-chocoBrown font-commissioner md:text-2xl text-sm text-center">
              Keep an eye out for updates—we’ll notify you if your bid wins!
            </p>
          </>
        ) : null}
        <button
          type="button"
          className="md:text-3xl text-sm py-2.5 font-ADLaM px-4 text-white bg-darkOrange rounded-lg shadow-buttonShadow"
          onClick={handleVoteAgain}
        >
          {isVoteType ? 'Vote again' : 'Place a bid again'}
        </button>
      </div>
      <div id="social-contacts" className="pt-2">
        <p className="font-commissioner md:text-2xl text-sm text-center text-chocoBrown lg:pb-8 pb-4">
          Share to your social media:
        </p>
        <div className="flex justify-center gap-x-7 items-center">
          <img src={Fb} alt="facebook-icon" className="md:max-w-14 max-w-8" />
          <XIcon />
          <img src={Ig} alt="instagram-icon" className="md:max-w-14 max-w-8" />
          <ShareIcon />
        </div>
      </div>
    </div>
  );
}

export default ThanksSection;
