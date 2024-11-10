import React from 'react';
import {
  CoinCurrency,
  MinusIcon,
  PhoneIcon,
  PlusIcon,
  QuestionMark,
} from '../Account/Icons';
import { ClockIcon } from './Icons';
import RulesPopup from './RulesPopup/RulesPopup';

type Props = {
  handleSubmit: Function;
};

const rulesContent = (
  <ul className="font-commissioner md:text-2xl text-base list-disc pl-10">
    <li>Pay with your coins to join. 💰</li>
    <li>
      Place your bid for a personalised video from Apple Vision Pro, made just
      for you!
    </li>
    <li>
      Win the auction and wait for the video recording to be sent your way for
      the unforgettable immersive experience.
    </li>
  </ul>
);

function CapySafariCard({ handleSubmit }: Props) {
  const [bid, setBid] = React.useState<number>(20);
  const [isOpen, setIsOpen] = React.useState<boolean>(false);

  return (
    <div className="bg-custard shadow-characterCard md:px-6 md:pt-6 md:pb-8 p-6 max-w-[744px]">
      <div className="flex gap-x-6 items-center justify-center gap-y-2">
        <PhoneIcon />
        <h2 className="md:text-5xl text-2xl font-dynapuff text-chocoBrown">
          Capy safari
        </h2>
      </div>
      <div className="flex gap-x-2 items-center justify-center pt-2">
        <ClockIcon />
        <span className="text-darkOrange text-2xl font-commissioner font-bold">
          ends in 2 h 23 m
        </span>
      </div>
      <div className="md:py-9 py-6 flex justify-center">
        <img
          src="/src/assets/play/capy-safari.png"
          alt="capy-table"
          className="md:max-w-max max-w-[262px]"
        />
      </div>
      <div
        id="description"
        className="flex md:flex-row flex-col items-center md:pb-10 pb-6 relative"
      >
        <p className="text-chocoBrown font-ADLaM md:text-[26px] md:leading-8 text-sm text-center font-semibold">
          Bid for a chance to be the safari guide and explore the world of
          capybaras from your screen!
        </p>
        <button
          type="button"
          aria-label="button"
          className="flex-1"
          onClick={() => setIsOpen(!isOpen)}
        >
          <QuestionMark className="md:max-w-max max-w-6" />
        </button>
        <RulesPopup
          isOpen={isOpen}
          setIsOpen={setIsOpen}
          content={rulesContent}
          clx="md:right-10 right-0 md:top-10 -top-20"
        />
      </div>
      <div className="pt-6 md:mt-6 mt-0 border-t-4 border-chocoBrown">
        <span className="flex text-chocoBrown font-commissioner md:text-2xl text-base font-semibold items-center gap-x-2">
          Current bid:{' '}
          <span className="md:text-titleSizeSM text-base">{1 * 20}</span>{' '}
          <CoinCurrency className="md:size-8 size-6" />{' '}
        </span>
      </div>
      <div
        id="submit"
        className="mt-6 flex md:items-center items-end justify-between"
      >
        <div className="flex md:flex-row flex-col md:items-center gap-x-12">
          <p className="md:text-2xl text-base font-commissioner font-[600] text-chocoBrown">
            Your bid:
          </p>
          <div className="flex gap-x-4 items-center pt-1.5">
            <button
              type="button"
              disabled={bid < 1}
              className={`${bid < 1 ? 'cursor-not-allowed' : ''}`}
              onClick={() => setBid((prevCount) => prevCount - 1)}
            >
              <MinusIcon />
            </button>
            <input
              disabled
              value={bid}
              className="max-w-20 py-1.5 text-center font-ADLaM md:text-[28px] text-xl outline-none border-2 border-chocoBrown rounded-lg bg-white"
            />
            <button
              type="button"
              onClick={() => setBid((prevCount) => prevCount + 1)}
            >
              <PlusIcon />
            </button>
          </div>
        </div>
        <button
          type="submit"
          className="text-white bg-darkOrange font-ADLaM font-bold md:text-3xl text-base rounded-lg shadow-buttonShadow md:py-2.5 py-1.5 px-4 hover:bg-chocoBrown hover:text-white"
          onClick={() => handleSubmit({ vType: 'bid', bType: 'safari' })}
        >
          Place your bid
        </button>
      </div>
    </div>
  );
}

export default CapySafariCard;
