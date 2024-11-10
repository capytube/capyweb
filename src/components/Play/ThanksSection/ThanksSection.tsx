import React, { MouseEventHandler } from 'react';
import { ShareIcon, XIcon } from '../../Account/Icons';

type Props = {
  handleVoteAgain: MouseEventHandler<HTMLElement>;
  voteType?: boolean;
  bidType?: string;
};

function ThanksSection({
  voteType,
  handleVoteAgain,
  bidType = 'safari',
}: Props) {
  const bgColor = () => {
    if (voteType) {
      return 'bg-babyCronYellow';
    } else {
      if (bidType === 'safari') {
        return 'bg-custard';
      } else if (bidType === 'vision') {
        return 'bg-cream';
      }
    }
  };

  const handleScrollTop = () => {
    const ele = document.getElementById('thanks-section');
    ele?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  React.useEffect(() => {
    handleScrollTop();
    return () => {
      handleScrollTop();
    };
  }, []);

  return (
    <div
      id="thanks-section"
      className={`${bgColor()} shadow-characterCard md:px-16 md:py-6  p-6 max-w-[744px]`}
    >
      {voteType ? (
        <>
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
        </>
      ) : (
        <>
          <h2 className="md:text-5xl text-2xl font-dynapuff text-chocoBrown text-center">
            Thank you for your bid!
          </h2>
          <div className="md:py-12 py-6 flex justify-center">
            <img
              src={
                bidType === 'safari'
                  ? '/src/assets/play/capy-safari.png'
                  : '/src/assets/play/visionCat.png'
              }
              alt="capy-table"
              className="md:max-w-max max-w-[194px]"
            />
          </div>
          <div
            id="description"
            className="flex flex-col items-center md:pb-10 pb-6 gap-y-6"
          >
            <p className="text-chocoBrown font-ADLaM md:text-[26px] md:leading-8 text-sm text-center font-semibold">
              What’s next?
            </p>
            <p className="text-chocoBrown font-commissioner md:text-2xl text-sm text-center">
              Keep an eye out for updates—we’ll notify you if your bid wins!
            </p>
            <button
              type="button"
              className="mt-4 md:text-3xl text-sm py-2.5 font-ADLaM px-4 text-white bg-darkOrange rounded-lg shadow-buttonShadow"
              onClick={handleVoteAgain}
            >
              Place a bid again
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
        </>
      )}
    </div>
  );
}

export default ThanksSection;
