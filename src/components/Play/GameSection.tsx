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
  const [voteType, setVoteType] = React.useState<boolean>(false);
  const [bidType, setBidType] = React.useState<string>('');

  const handleSubmit = ({ vType, bType }: { vType: string; bType: string }) => {
    if (vType === 'vote') {
      setVoteType(true);
    } else {
      setVoteType(false);
    }
    setBidType(bType);
    setThanksActive(true);
  };

  const handleVoteAgain = () => {
    setThanksActive(false);
  };

  const handleScrollTop = () => {
    const ele = document.getElementById('game-section');
    ele?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  React.useEffect(() => {
    handleScrollTop();
    return () => {
      handleScrollTop();
    };
  }, []);

  return (
    <div id="game-section" className="lg:py-20 py-0 pb-24 lg:px-0 p-4">
      <div className="max-w-[1100px] my-0 mx-auto flex gap-x-10 lg:flex-row flex-col justify-center">
        {!thanksActive ? (
          <>
            <div className="sticky h-fit top-0">
              <SelectedCharacterCard handleClick={handleSectionChange} />
            </div>
            <div className="flex flex-col gap-y-10 lg:pt-0 pt-10">
              <SnackCard handleSubmit={handleSubmit} />
              <CapySafariCard handleSubmit={handleSubmit} />
              <CapyVisionProCard handleSubmit={handleSubmit} />
            </div>
          </>
        ) : (
          <div className="md:pb-0 pb-10">
            <ThanksSection
              voteType={voteType}
              bidType={bidType}
              handleVoteAgain={handleVoteAgain}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default GameSection;
