import React from 'react';
import { StorageImage } from '@aws-amplify/ui-react-storage';
import { Loader } from '@aws-amplify/ui-react';
import { CoinCurrency, MinusIcon, PlusIcon, QuestionMark } from '../Account/Icons';
import { ClockIcon } from './Icons';
import RulesPopup from './RulesPopup/RulesPopup';
import { InteractionsAtomType } from '../../store/atoms/interactionsAtom';
import { calculateTimeDifference } from '../../utils/function';

export interface BidPayloadData {
  bidAmount: number;
}
interface HandleSubmitProps {
  selectedInteractionData: InteractionsAtomType;
  selectedFood: string | null;
  bidPayloadData: BidPayloadData;
}

type Props = {
  data: InteractionsAtomType;
  handleSubmit: ({ selectedInteractionData, selectedFood, bidPayloadData }: HandleSubmitProps) => Promise<void>;
  isProcessingPayment: boolean;
  processingPayItemId: string | null;
};

const rulesContent = (data: InteractionsAtomType) => (
  <ul className="font-commissioner md:text-2xl text-base list-disc pl-10">
    {data?.rules?.map((rule) => (
      <li key={rule}>{rule}</li>
    ))}
  </ul>
);

function BidInteractionCard({ data, handleSubmit, isProcessingPayment, processingPayItemId }: Readonly<Props>) {
  const [bid, setBid] = React.useState<number>((data?.current_bid ?? 1) + 1);
  const [isOpen, setIsOpen] = React.useState<boolean>(false);
  const [isImageLoading, setIsImageLoading] = React.useState<boolean>(true);

  return (
    <div
      className={`${
        data?.title?.includes('safari') ? 'bg-custard' : 'bg-cream'
      } shadow-characterCard md:px-6 md:pt-6 md:pb-8 p-6 max-w-[744px]`}
    >
      <div className="flex gap-x-6 items-center justify-center gap-y-2">
        {data?.title_icon_url ? (
          <StorageImage alt="" path={data?.title_icon_url ?? ''} loading="lazy" className="max-w-11 min-w-11" />
        ) : null}
        <h2 className="md:text-5xl text-2xl font-dynapuff text-chocoBrown">{data?.title}</h2>
      </div>
      {calculateTimeDifference(data?.session_date ?? '') ? (
        <div className="flex gap-x-2 items-center justify-center pt-2">
          <ClockIcon />
          <span className="text-darkOrange text-2xl font-commissioner font-bold">
            ends in {calculateTimeDifference(data?.session_date ?? '')}
          </span>
        </div>
      ) : null}
      <div className="md:py-9 py-6 flex justify-center">
        <div className="relative min-h-[254px]">
          {/* Loading Spinner */}
          {isImageLoading && (
            <div className="absolute w-full h-full rounded-3xl flex justify-center items-center">
              <Loader width="3rem" height="3rem" filledColor="#7a3f3e" />
            </div>
          )}
          {/* Actual Image */}
          {data?.image_url ? (
            <StorageImage
              alt=""
              path={data?.image_url ?? ''}
              loading="lazy"
              className="md:max-w-max max-w-[262px]"
              onLoad={() => setIsImageLoading(false)}
            />
          ) : null}
        </div>
      </div>
      <div id="description" className="flex md:flex-row flex-col items-center md:pb-10 pb-6 relative">
        <p className="text-chocoBrown font-ADLaM md:text-[26px] md:leading-8 text-sm text-center font-semibold">
          {data?.description}
        </p>
        <button type="button" aria-label="button" className="flex-1" onClick={() => setIsOpen(!isOpen)}>
          <QuestionMark className="md:max-w-max max-w-6" />
        </button>
        <RulesPopup
          isOpen={isOpen}
          setIsOpen={setIsOpen}
          content={rulesContent(data)}
          clx="md:right-10 right-0 md:top-10 -top-20"
        />
      </div>
      <p className="text-chocoBrown font-commissioner md:text-2xl text-sm text-center">{data?.device_required}</p>
      <div className="pt-6 md:mt-6 mt-0 border-t-4 border-chocoBrown">
        <span className="flex text-chocoBrown font-commissioner md:text-2xl text-base font-semibold items-center gap-x-2">
          Current bid: <span className="md:text-titleSizeSM text-base">{data?.current_bid}</span>{' '}
          <CoinCurrency className="md:size-8 size-6" />{' '}
        </span>
      </div>
      <div id="submit" className="mt-6 flex md:items-center items-end justify-between">
        <div className="flex md:flex-row flex-col md:items-center gap-x-12">
          <p className="md:text-2xl text-base font-commissioner font-[600] text-chocoBrown">Your bid:</p>
          <div className="flex gap-x-4 items-center pt-1.5">
            <button
              type="button"
              disabled={bid <= (data?.current_bid ?? 1)}
              className={`${bid <= (data?.current_bid ?? 1) ? 'cursor-not-allowed' : ''}`}
              onClick={() => setBid((prevCount) => prevCount - 1)}
            >
              <MinusIcon />
            </button>
            <input
              disabled
              value={bid}
              className="max-w-20 py-1.5 text-center font-ADLaM md:text-[28px] text-xl outline-none border-2 border-chocoBrown rounded-lg bg-white"
            />
            <button type="button" onClick={() => setBid((prevCount) => prevCount + 1)}>
              <PlusIcon />
            </button>
          </div>
        </div>
        <button
          type="submit"
          disabled={bid === data?.current_bid || isProcessingPayment}
          className="text-white bg-darkOrange font-ADLaM font-bold md:text-3xl text-base rounded-lg shadow-buttonShadow md:py-2.5 py-1.5 px-4 hover:bg-chocoBrown hover:text-white disabled:cursor-not-allowed disabled:bg-buttonDisabled disabled:shadow-buttonDisabledShadow"
          onClick={() =>
            handleSubmit({
              selectedInteractionData: data,
              selectedFood: '',
              bidPayloadData: {
                bidAmount: bid,
              },
            })
          }
        >
          {processingPayItemId === data.id ? 'Processing...' : 'Place your bid'}
        </button>
      </div>
    </div>
  );
}

export default BidInteractionCard;
