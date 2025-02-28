import { MouseEventHandler, useEffect, useState } from 'react';
import { useAtomValue } from 'jotai';
import { useIsLoggedIn } from '@dynamic-labs/sdk-react-core';
import toast from 'react-hot-toast';

import SelectedCharacterCard from './SelectedCharacterCard';
import ThanksSection from './ThanksSection/ThanksSection';
import VoteInteractionCard, { VotePayloadData } from './VoteInteractionCard';
import BidInteractionCard, { BidPayloadData } from './BidInteractionCard';
import LoginPopup from '../LoginPopup';

import { InteractionsAtomType, interactionsAtom } from '../../store/atoms/interactionsAtom';
import { userAtom } from '../../store/atoms/userAtom';
import { listAllInteractionsByCapyId } from '../../api/interactions';
import { createUserVotes } from '../../api/userVotes';
import { createUserBids } from '../../api/userBids';
import { createTokenTransaction } from '../../api/tokenTransaction';
import { updateUserTotalBalance } from '../../api/user';
import { useSendCAPYL } from '../../utils/useSendCapyl';
import { MASTER_SOL_RECIPIENT_WALLET_ADDRESS } from '../../utils/constants';
import { useSolanaTransactions } from '../../utils/useSolanaTransactions';

type Props = {
  capy: { id: string; name: string; image: string };
  handleSectionChange: MouseEventHandler<HTMLElement>;
};

function GameSection({ capy, handleSectionChange }: Readonly<Props>) {
  // hooks
  const isLoggedIn = useIsLoggedIn();
  const interactionsData = useAtomValue(interactionsAtom);
  const userData = useAtomValue(userAtom);
  const { sendCAPYL } = useSendCAPYL();
  const { fetchTransactions } = useSolanaTransactions({ page: 'play' });

  // states
  const [isListInteractionsLoading, setIsListInteractionsLoading] = useState(false);
  const [voteTypeInteractionsList, setVoteTypeInteractionsList] = useState<InteractionsAtomType[]>([]);
  const [bidTypeInteractionsList, setBidTypeInteractionsList] = useState<InteractionsAtomType[]>([]);
  const [thanksActive, setThanksActive] = useState<boolean>(false);
  const [finalInteractedData, setFinalInteractedData] = useState<InteractionsAtomType | null>(null);
  const [capySelectedFood, setCapySelectedFood] = useState<string | null>(null);
  const [isLoginPopupVisible, setIsLoginPopupVisible] = useState<boolean>(false);

  // functions
  const handleSubmit = async ({
    selectedInteractionData,
    selectedFood,
    votePayloadData,
    bidPayloadData,
  }: {
    selectedInteractionData: InteractionsAtomType;
    selectedFood: string | null;
    votePayloadData?: VotePayloadData;
    bidPayloadData?: BidPayloadData;
  }) => {
    if (!isLoggedIn) {
      setIsLoginPopupVisible(true);
      return;
    }

    let isLowBalance = false;
    const voteFee = votePayloadData?.totalFee ?? 0;
    const bidFee = bidPayloadData?.bidAmount ?? 0;
    const userBalance = userData?.balance ?? 0;
    if (voteFee > userBalance || bidFee > userBalance) {
      isLowBalance = true;
    }

    if (isLowBalance) {
      toast.error(`You do not have enough coins to place your ${selectedInteractionData?.interaction_type}.`, {
        id: 'low-balance',
      });
      return;
    }

    setFinalInteractedData(selectedInteractionData);
    setCapySelectedFood(selectedFood);

    const createTransaction = async (amount: number | null, relatedId: string) => {
      try {
        // deducting coins from user's account
        if (userData?.id && userData?.balance && amount) {
          const leftOverBalance = userData?.balance - amount;
          await updateUserTotalBalance({
            userId: userData?.id,
            totalBalance: leftOverBalance,
          });
        }

        // hitting the transactional api
        let tokenTransactionResponse;
        if (userData?.id) {
          const transactionPayload = {
            user_id: userData?.id,
            transaction_type: selectedInteractionData?.interaction_type,
            amount,
            related_id: relatedId,
            related_type: selectedInteractionData?.interaction_type,
          };
          tokenTransactionResponse = await createTokenTransaction(transactionPayload);
        }
        if (tokenTransactionResponse?.data?.id) {
          setThanksActive(true);
          fetchTransactions(); // reloads recent transaction list on the account page
        }
      } catch (error) {
        console.error('Error creating token transaction:', error);
      }
    };

    const isVoteTypeInteracted = selectedInteractionData?.interaction_type === 'vote';

    let capylAmount = 0;
    if (isVoteTypeInteracted && votePayloadData) {
      capylAmount = votePayloadData?.totalFee;
    } else if (bidPayloadData) {
      capylAmount = bidPayloadData?.bidAmount;
    }

    const txSignature = await sendCAPYL(MASTER_SOL_RECIPIENT_WALLET_ADDRESS, capylAmount); // Sending CAPYL tokens first
    if (!txSignature) return;

    if (isVoteTypeInteracted && votePayloadData && selectedInteractionData?.id && userData?.id) {
      const userVotePayload = {
        interaction_id: selectedInteractionData?.id,
        user_id: userData?.id,
        option_id: votePayloadData?.optionSelected?.id,
        number_of_votes: votePayloadData?.number_of_votes,
        cost: votePayloadData?.totalFee,
        is_custom_request: votePayloadData?.is_custom_request || null,
        custom_request: votePayloadData?.custom_request || null,
        approved: false,
      };

      try {
        const response = await createUserVotes(userVotePayload);
        if (response?.data?.id) {
          await createTransaction(response?.data?.cost, response?.data?.id);
        }
      } catch (error) {
        console.error('Error creating user vote:', error);
        return;
      }
    } else if (bidPayloadData && selectedInteractionData?.id && userData?.id) {
      const userBidPayload = {
        interaction_id: selectedInteractionData?.id,
        user_id: userData?.id,
        bid_amount: bidPayloadData?.bidAmount,
      };

      try {
        const response = await createUserBids(userBidPayload);
        if (response?.data?.id) {
          await createTransaction(response?.data?.bid_amount, response?.data?.id);
        }
      } catch (error) {
        console.error('Error creating user bid:', error);
        return;
      }
    }
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
        .then(() => {
          setIsListInteractionsLoading(false);
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
            {(() => {
              if (isListInteractionsLoading) {
                return (
                  <div className="animate-bounce font-hanaleiFill md:h-full h-[50dvh] text-chocoBrown md:text-7xl text-3xl flex justify-center items-center">
                    loading...
                  </div>
                );
              } else if (interactionsData?.length > 0) {
                return (
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
                );
              } else {
                return (
                  <div className="font-hanaleiFill text-chocoBrown md:text-4xl text-2xl text-center px-3 sm:py-16 py-32">
                    The interactive games aren´t available right now
                  </div>
                );
              }
            })()}
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
      {isLoginPopupVisible ? (
        <LoginPopup
          isOpen={isLoginPopupVisible}
          setIsOpen={setIsLoginPopupVisible}
          message={`Please log in first, to place your vote/bid.`}
        />
      ) : null}
    </div>
  );
}

export default GameSection;
