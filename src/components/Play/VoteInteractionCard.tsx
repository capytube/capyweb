import React, { useState } from 'react';
import { StorageImage } from '@aws-amplify/ui-react-storage';
import RulesPopup from './RulesPopup/RulesPopup';
import { ClockIcon } from './Icons';
import { CoinCurrency, MinusIcon, PlusIcon, QuestionMark } from '../Account/Icons';
import { InteractionsAtomType, VoteOptions } from '../../store/atoms/interactionsAtom';
import { calculateTimeDifference } from '../../utils/function';

export interface VotePayloadData {
  optionSelected: VoteOptions | null | undefined;
  number_of_votes: number;
  totalFee: number;
  is_custom_request: boolean;
  custom_request: string;
}

interface HandleSubmitProps {
  selectedInteractionData: InteractionsAtomType;
  selectedFood: string | null;
  votePayloadData?: VotePayloadData;
}

type Props = {
  data: InteractionsAtomType;
  handleSubmit: ({ selectedInteractionData, selectedFood, votePayloadData }: HandleSubmitProps) => Promise<void>;
};

const rulesContent = (data: InteractionsAtomType) => (
  <ul className="font-commissioner md:text-2xl text-base list-disc pl-10">
    {data?.rules?.map((rule) => (
      <li key={rule}>{rule}</li>
    ))}
  </ul>
);

function VoteInteractionCard({ data, handleSubmit }: Readonly<Props>) {
  // states
  const [votes, setVotes] = React.useState<number>(1);
  const [rulePopup, setRulePopup] = React.useState<boolean>(false);
  const [selectedOption, setSelectedOption] = React.useState(data?.options?.[0]);
  const [newFoodRequest, setNewFoodRequest] = useState<string>('');

  // variables
  const isCustomRequest = ['new', 'request']?.some((key) => selectedOption?.title?.toLowerCase()?.includes(key));
  const chosenFoodOption = isCustomRequest ? newFoodRequest : selectedOption?.title;
  const totalFee = votes * (data?.vote_cost ?? 1) + (isCustomRequest ? data?.custom_request_cost ?? 0 : 0);

  return (
    <div className="bg-babyCronYellow shadow-characterCard px-6 pt-6 pb-8 max-w-[744px]">
      <div className="flex gap-x-6 items-center justify-center gap-y-2">
        {data?.title_icon_url ? (
          <StorageImage alt="icon" path={data?.title_icon_url ?? ''} loading="lazy" className="max-w-11" />
        ) : null}
        <h2 className="md:text-5xl text-2xl font-dynapuff text-chocoBrown">{data?.title}</h2>
      </div>
      {calculateTimeDifference(data?.session_date ?? '') ? (
        <div className="flex gap-x-2 items-center justify-center font-bold pt-2">
          <ClockIcon />
          <span className="text-darkOrange text-2xl font-commissioner">
            ends in {calculateTimeDifference(data?.session_date ?? '')}
          </span>
        </div>
      ) : null}
      <div className="md:py-12 py-6 flex justify-center">
        {data?.image_url ? (
          <StorageImage
            alt="game image"
            path={data?.image_url ?? ''}
            loading="lazy"
            className="md:max-w-max max-w-48"
          />
        ) : null}
      </div>
      <div className="relative">
        <p className="flex justify-center gap-x-4 items-center font-ADLaM md:text-2xl text-sm text-chocoBrown text-center pb-4">
          {data?.description}
          <button type="button" aria-label="button" onClick={() => setRulePopup(!rulePopup)}>
            <QuestionMark />
          </button>
        </p>
        <RulesPopup isOpen={rulePopup} setIsOpen={setRulePopup} content={rulesContent(data)} clx="md:top-10 -top-20" />
      </div>
      <span className="flex items-center justify-center text-2xl text-chocoBrown font-commissioner">
        Vote: {data?.vote_cost} <CoinCurrency className="max-h-8 " />
      </span>
      <div className="md:pt-11 pt-6">
        <div className="pt-6 grid md:grid-cols-2 grid-cols-1 gap-4">
          {data?.options?.map((option) => (
            <button
              type="button"
              key={option?.id}
              onClick={() => setSelectedOption(option)}
              className={`border-[3px] rounded-2xl border-chocoBrown flex p-4 sm:min-w-[340px] min-w-full cursor-pointer ${
                selectedOption?.title === option?.title ? 'bg-white' : ''
              } ${option?.title === 'New request' ? 'col-span-2' : 'lg:col-span-1 col-span-2'}`}
            >
              <input
                type="radio"
                id={option?.title ?? ''}
                name="food"
                value={selectedOption?.title ?? ''}
                checked={selectedOption?.title === option?.title}
                onChange={() => setSelectedOption(option)}
                className="mt-1 text-chocoBrown accent-chocoBrown size-7"
              />
              <label htmlFor={option?.title ?? ''} className="text-left flex flex-col ml-4 cursor-pointer w-full">
                <h3 className="font-commissioner font-bold md:text-2xl text-base text-chocoBrown md:mb-2 mb-0">
                  {option?.title}
                </h3>
                <p className="md:text-base text-xs font-commissioner text-chocoBrown">
                  {['new', 'request']?.some((key) => option?.title?.toLowerCase()?.includes(key)) ? (
                    <span className="inline-flex items-center gap-x-2">
                      + {data?.custom_request_cost} <CoinCurrency className="size-6" />
                    </span>
                  ) : (
                    option?.description
                  )}
                </p>
                {['new', 'request']?.some((key) => option?.title?.toLowerCase()?.includes(key)) ? (
                  <input
                    className="mt-2 outline-none border-chocoBrown border-2 rounded-[4px] py-2 px-3 font-commissioner text-sm text-chocoBrown max-w-[316px]"
                    placeholder="Name your capy food"
                    value={newFoodRequest}
                    onChange={(e) => {
                      setNewFoodRequest(e.target.value);
                    }}
                  />
                ) : null}
              </label>
            </button>
          ))}
        </div>
        <div className="pt-6 mt-6 border-t-4 border-chocoBrown">
          <div className="flex md:flex-row flex-col md:items-center gap-x-2">
            <p className="md:text-2xl text-base font-commissioner font-[600] text-chocoBrown">No. of votes:</p>
            <div className="flex gap-x-4 items-center pt-1.5">
              <button
                type="button"
                disabled={votes < 1}
                className={`${votes < 1 ? 'cursor-not-allowed' : ''}`}
                onClick={() => setVotes((prevCount) => prevCount - 1)}
              >
                <MinusIcon />
              </button>
              <input
                disabled
                value={votes}
                className="max-w-20 py-1.5 text-center font-ADLaM md:text-[28px] text-xl outline-none border-2 border-chocoBrown rounded-lg bg-white"
              />
              <button type="button" onClick={() => setVotes((prevCount) => prevCount + 1)}>
                <PlusIcon />
              </button>
            </div>
          </div>
        </div>
        <div id="submit" className="mt-6 flex items-center justify-between">
          <span className="flex text-chocoBrown font-commissioner md:text-2xl text-base font-semibold items-center gap-x-2">
            Total fee: <span className="md:text-titleSizeSM text-base">{totalFee}</span>{' '}
            <CoinCurrency className="md:size-8 size-6" />{' '}
          </span>
          <button
            type="submit"
            disabled={votes === 0}
            className="text-white bg-darkOrange font-ADLaM font-bold md:text-3xl text-base rounded-lg shadow-buttonShadow md:py-2.5 py-1.5 px-4 hover:bg-chocoBrown hover:text-white disabled:cursor-not-allowed disabled:bg-buttonDisabled disabled:shadow-buttonDisabledShadow"
            onClick={() =>
              handleSubmit({
                selectedInteractionData: data,
                selectedFood: chosenFoodOption ?? '',
                votePayloadData: {
                  optionSelected: selectedOption,
                  number_of_votes: votes,
                  totalFee: totalFee,
                  is_custom_request: isCustomRequest,
                  custom_request: newFoodRequest,
                },
              })
            }
          >
            Place your vote
          </button>
        </div>
      </div>
    </div>
  );
}

export default VoteInteractionCard;
