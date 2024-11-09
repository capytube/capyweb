import { MouseEventHandler } from 'react';
import { ShareIcon, XIcon } from '../../Account/Icons';

type Props = {
  handleVoteAgain: MouseEventHandler<HTMLElement>;
};

function ThanksSection({ handleVoteAgain }: Props) {
  return (
    <div className="bg-babyCronYellow shadow-characterCard md:px-16 md:py-6  p-6 max-w-[744px]">
      <h2 className="md:text-5xl text-2xl font-dynapuff text-chocoBrown text-center">
        Thank you for your vote!
      </h2>
      <div className="md:py-12 py-6 flex justify-center">
        <img
          src="/src/assets/play/dineTable.png"
          alt="capy-table"
          className="md:max-w-max max-w-[194px]"
        />
      </div>
      <div
        id="description"
        className="flex flex-col items-center md:pb-10 pb-6 gap-y-6"
      >
        <p className="text-chocoBrown font-ADLaM md:text-[26px] md:leading-8 text-sm text-center font-semibold">
          You have voted ‘Carrots 🥕’ for Elon
        </p>
        <p className="text-chocoBrown font-commissioner md:text-2xl text-sm text-center">
          You may come back and watch your capy munching later at 9:00 AM
          tomorrow.
        </p>
        <button
          type="button"
          className="md:text-3xl text-sm py-2.5 font-ADLaM px-4 text-white bg-darkOrange rounded-lg shadow-buttonShadow"
          onClick={handleVoteAgain}
        >
          Vote again
        </button>
      </div>
      <div id="social-contacts" className="pt-2">
        <p className="font-commissioner md:text-2xl text-sm text-center text-chocoBrown pb-8">
          Share to your social media:
        </p>
        <div className="flex justify-center gap-x-7 items-center">
          <img
            src="/src/assets/play/fb.png"
            alt="facebook-icon"
            className="md:max-w-max max-w-8"
          />
          <XIcon />
          <img
            src="/src/assets/play/ig.png"
            alt="instagram-icon"
            className="md:max-w-max max-w-8"
          />
          <ShareIcon />
        </div>
      </div>
    </div>
  );
}

export default ThanksSection;
