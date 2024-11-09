import React, { MouseEventHandler } from 'react';
import CapySafariCard from './CapySafariCard';
import CapyVisionProCard from './CapyVisionProCard';
import SelectedCharacterCard from './SelectedCharacterCard';
import SnackCard from './SnackCard';
import ThanksSection from './ThanksSection/ThanksSection';

type Props = {
  handleSectionChange: MouseEventHandler<HTMLElement>;
};

function GameSection({ handleSectionChange }: Props) {
  const [thanksActive, setThanksActive] = React.useState<boolean>(false);

  const handleVoteSubmit = () => {
    setThanksActive(true);
  };

  const handleVoteAgain = () => {
    setThanksActive(false);
  };

  return (
    <div id="game-section" className="lg:py-20 py-0 lg:px-0 p-4">
      <div className="max-w-[1100px] my-0 mx-auto flex gap-x-10 lg:flex-row flex-col justify-center">
        {!thanksActive ? (
          <>
            <div className="sticky h-fit top-0">
              <SelectedCharacterCard handleClick={handleSectionChange} />
            </div>
            <div className="flex flex-col gap-y-10 lg:pt-0 pt-10">
              <SnackCard handleSubmit={handleVoteSubmit} />
              <CapySafariCard />
              <CapyVisionProCard />
            </div>
          </>
        ) : (
          <div className="md:pb-0 pb-10">
            <ThanksSection handleVoteAgain={handleVoteAgain} />
          </div>
        )}
      </div>
    </div>
  );
}

export default GameSection;
