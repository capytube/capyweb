import { MouseEventHandler, useEffect, useState } from 'react';
import { useAtomValue } from 'jotai';
import SelectedCharacterCard from './SelectedCharacterCard';
import ThanksSection from './ThanksSection/ThanksSection';
import { InteractionsAtomType, interactionsAtom } from '../../store/atoms/interactionsAtom';
import { listAllInteractionsByCapyId } from '../../api/interactions';
import VoteInteractionCard from './VoteInteractionCard';
import BidInteractionCard from './BidInteractionCard';

type Props = {
  capy: { id: string; name: string; image: string };
  handleSectionChange: MouseEventHandler<HTMLElement>;
};

function GameSection({ capy, handleSectionChange }: Readonly<Props>) {
  // hooks
  const interactionsData = useAtomValue(interactionsAtom);

  // states
  const [isListInteractionsLoading, setIsListInteractionsLoading] = useState(false);
  const [voteTypeInteractionsList, setVoteTypeInteractionsList] = useState<InteractionsAtomType[]>([]);
  const [bidTypeInteractionsList, setBidTypeInteractionsList] = useState<InteractionsAtomType[]>([]);
  const [thanksActive, setThanksActive] = useState<boolean>(false);
  const [finalInteractedData, setFinalInteractedData] = useState<InteractionsAtomType | null>(null);
  const [capySelectedFood, setCapySelectedFood] = useState<string | null>(null);

  // functions
  const handleSubmit = ({
    selectedData,
    selectedFood,
  }: {
    selectedData: InteractionsAtomType;
    selectedFood: string | null;
  }) => {
    setFinalInteractedData(selectedData);
    setCapySelectedFood(selectedFood);
    setThanksActive(true);
  };

  const handleVoteAgain = () => {
    setThanksActive(false);
  };

  const handleScrollTop = () => {
    const ele = document.getElementById('game-section');
    ele?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  // effects
  useEffect(() => {
    handleScrollTop();
    return () => {
      handleScrollTop();
    };
  }, []);

  useEffect(() => {
    const fetchAllAvailableInteractions = async () => {
      setIsListInteractionsLoading(true);
      await listAllInteractionsByCapyId({ capyId: capy?.id })
        .then((res) => {
          if (res?.data?.length) {
            setIsListInteractionsLoading(false);
          }
        })
        .catch(() => {
          setIsListInteractionsLoading(false);
        });
    };

    if (capy?.id) {
      fetchAllAvailableInteractions();
    }
  }, []);

  useEffect(() => {
    if (interactionsData?.length) {
      const voteTypeInteractions = interactionsData.filter((i) => i.interaction_type === 'vote');
      setVoteTypeInteractionsList(voteTypeInteractions);

      const bidTypeInteractions = interactionsData.filter((i) => i.interaction_type === 'bid');
      setBidTypeInteractionsList(bidTypeInteractions);
    }
  }, [interactionsData?.length]);

  return (
    <div id="game-section" className="lg:py-20 py-0 pb-24 lg:px-0 p-4">
      <div className="max-w-[1100px] my-0 mx-auto flex gap-x-10 lg:flex-row flex-col justify-center">
        {!thanksActive ? (
          <>
            <div className="sticky z-10 h-fit top-0">
              <SelectedCharacterCard capy={capy} handleClick={handleSectionChange} />
            </div>
            {!isListInteractionsLoading && interactionsData?.length ? (
              <div className="flex flex-col gap-y-10 lg:pt-0 pt-10">
                {voteTypeInteractionsList?.length
                  ? voteTypeInteractionsList?.map((data) => {
                      return <VoteInteractionCard key={data?.id} data={data} handleSubmit={handleSubmit} />;
                    })
                  : null}
                {bidTypeInteractionsList?.length
                  ? bidTypeInteractionsList?.map((data) => {
                      return <BidInteractionCard key={data?.id} data={data} handleSubmit={handleSubmit} />;
                    })
                  : null}
              </div>
            ) : (
              <div className="animate-bounce font-hanaleiFill md:h-full h-[50dvh] text-chocoBrown md:text-7xl text-3xl flex justify-center items-center">
                loading...
              </div>
            )}
          </>
        ) : (
          <div className="md:pb-0 pb-10">
            <ThanksSection
              finalInteractedData={finalInteractedData}
              capySelectedFood={capySelectedFood}
              capyData={capy}
              handleVoteAgain={handleVoteAgain}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default GameSection;
