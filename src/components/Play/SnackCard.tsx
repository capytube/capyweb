import React from 'react';
import {
  CoinCurrency,
  MinusIcon,
  PlusIcon,
  QuestionMark,
} from '../Account/Icons';
import { ClockIcon, OrangeIcon } from './Icons';
import RulesPopup from './RulesPopup/RulesPopup';

type Props = {
  handleSubmit: Function;
};

const foodCards = [
  {
    id: 1,
    name: 'Carrots 🥕',
    description: 'Sweet crunchy baby carrots imported from Australia',
  },
  {
    id: 2,
    name: 'Pandan leaf 🌱',
    description: 'Fresh organic pandan leave tips from Chiang Mai',
  },
  {
    id: 3,
    name: 'Watermelon 🍉',
    description:
      'Chilled sweet and juicy watermelon to quench the capy’s thirst  ',
  },
  {
    id: 4,
    name: 'Timothy grass 🌾',
    description: 'Luxurious grass that is exceptionally silky and aromatic ',
  },
  {
    id: 5,
    name: 'New request',
    description: '+ 20 ',
  },
];

const rulesContent = (
  <ul className="font-commissioner md:text-2xl text-base list-disc pl-10">
    <li>Pay with your coins to join. 💰</li>
    <li>Vote for the food you would like our capybaras to eat. 😋</li>
    <li>The most voted food will be fed on the next day’s stream! 🏆</li>
  </ul>
);

function SnackCard({ handleSubmit }: Props) {
  const [votes, setVotes] = React.useState<number>(1);
  const [popup, setPopUp] = React.useState<boolean>(false);
  const [selectedFood, setSelectedFood] = React.useState('Carrots 🥕');

  return (
    <div className="bg-babyCronYellow shadow-characterCard px-6 pt-6 pb-8 max-w-[744px]">
      <div className="flex gap-x-6 items-center justify-center gap-y-2">
        <OrangeIcon />
        <h2 className="md:text-5xl text-2xl font-dynapuff text-chocoBrown">
          Buy capy a snack
        </h2>
      </div>
      <div className="flex gap-x-2 items-center justify-center font-bold pt-2">
        <ClockIcon />
        <span className="text-darkOrange text-2xl font-commissioner">
          ends in 2 h 23 m
        </span>
      </div>
      <div className="md:py-12 py-6 flex justify-center">
        <img
          src="/src/assets/play/dineTable.png"
          alt="capy-table"
          className="md:max-w-max max-w-48"
        />
      </div>
      <div className="relative">
        <p className="flex justify-center gap-x-4 items-center font-ADLaM md:text-2xl text-sm text-chocoBrown text-center pb-4 font-[600]">
          Vote what capy should eat today?
          <button
            type="button"
            aria-label="button"
            onClick={() => setPopUp(!popup)}
          >
            <QuestionMark />
          </button>
        </p>
        <RulesPopup
          isOpen={popup}
          setIsOpen={setPopUp}
          content={rulesContent}
          clx="md:top-10 -top-20"
        />
      </div>
      <span className="flex items-center justify-center text-2xl text-chocoBrown font-commissioner">
        Vote: 5 <CoinCurrency className="max-h-8 " />
      </span>
      <div className="md:pt-11 pt-6">
        <div className="md:border-0 md:pt-0 pt-6 border-t-4 border-chocoBrown ">
          <p className="md:text-2xl text-base font-commissioner font-[600] text-chocoBrown">
            Number of votes:
          </p>
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
            <button
              type="button"
              onClick={() => setVotes((prevCount) => prevCount + 1)}
            >
              <PlusIcon />
            </button>
          </div>
        </div>
        <div className="pt-6 grid md:grid-cols-2 grid-cols-1 gap-4">
          {foodCards?.map((foodCard) => (
            <button
              type="button"
              key={foodCard?.id}
              onClick={() => setSelectedFood(foodCard?.name)}
              className={`border-[3px] rounded-2xl border-chocoBrown flex p-4 min-w-[340px] cursor-pointer ${
                selectedFood === foodCard?.name ? 'bg-white' : ''
              } ${
                foodCard?.name === 'New request'
                  ? 'col-span-2'
                  : 'lg:col-span-1 col-span-2'
              }`}
            >
              <input
                type="radio"
                id={foodCard?.name}
                name="food"
                value={selectedFood}
                checked={selectedFood === foodCard?.name}
                onChange={() => setSelectedFood(foodCard?.name)}
                className="mt-1 text-chocoBrown accent-chocoBrown size-7"
              />
              <label
                htmlFor={foodCard?.name}
                className="text-left flex flex-col ml-4 cursor-pointer w-full"
              >
                <h3 className="font-commissioner font-bold md:text-2xl text-base text-chocoBrown md:mb-2 mb-0">
                  {foodCard?.name}
                </h3>
                <p className="md:text-base text-xs font-commissioner text-chocoBrown">
                  {foodCard?.name === 'New request' ? (
                    <span className="inline-flex items-center gap-x-2">
                      {foodCard?.description}{' '}
                      <CoinCurrency className="size-6" />
                    </span>
                  ) : (
                    foodCard?.description
                  )}
                </p>
                {foodCard?.name === 'New request' ? (
                  <input
                    className="mt-2 outline-none border-chocoBrown border-2 rounded-[4px] py-2 px-3 font-commissioner text-sm text-chocoBrown max-w-[316px]"
                    placeholder="Name your capy food"
                  />
                ) : null}
              </label>
            </button>
          ))}
        </div>
        <div className="pt-6 mt-6 border-t-4 border-chocoBrown">
          <div className="flex md:flex-row flex-col md:items-center gap-x-2">
            <p className="md:text-2xl text-base font-commissioner font-[600] text-chocoBrown">
              No. of votes:
            </p>
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
              <button
                type="button"
                onClick={() => setVotes((prevCount) => prevCount + 1)}
              >
                <PlusIcon />
              </button>
            </div>
          </div>
        </div>
        <div id="submit" className="mt-6 flex items-center justify-between">
          <span className="flex text-chocoBrown font-commissioner md:text-2xl text-base font-semibold items-center gap-x-2">
            Total fee:{' '}
            <span className="tmd:ext-titleSizeSM text-base">{votes * 5}</span>{' '}
            <CoinCurrency className="md:size-8 size-6" />{' '}
          </span>
          <button
            type="submit"
            className="text-white bg-darkOrange font-ADLaM font-bold md:text-3xl text-base rounded-lg shadow-buttonShadow md:py-2.5 py-1.5 px-4 hover:bg-chocoBrown hover:text-white"
            onClick={() => handleSubmit({ vType: 'vote', bType: '' })}
          >
            Place your vote
          </button>
        </div>
      </div>
    </div>
  );
}

export default SnackCard;
