import React from 'react';
import { CoinCurrency, MinusIcon, PlusIcon } from '../Account/Icons';
import { ClockIcon, OrangeIcon } from './Icons';

type Props = {};

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
];

function SnackCard({}: Props) {
  const [votes, setVotes] = React.useState<number>(1);
  const [selectedFood, setSelectedFood] = React.useState('');

  return (
    <div className="bg-babyCronYellow shadow-characterCard px-6 pt-6 pb-8 max-w-[744px]">
      <div className="flex gap-x-6 items-center justify-center gap-y-2">
        <OrangeIcon />
        <h2 className="text-5xl font-dynapuff text-chocoBrown">
          Buy capy a snack
        </h2>
      </div>
      <div className="flex gap-x-2 items-center justify-center">
        <ClockIcon />
        <span className="text-darkOrange text-2xl font-commissioner">
          ends in 2 h 23 m
        </span>
      </div>
      <div className="py-12 flex justify-center">
        <img src="/src/assets/play/dineTable.png" alt="capy-table" />
      </div>
      <p className="font-ADLaM text-2xl text-chocoBrown text-center pb-4 font-[600]">
        Vote what capy should eat today?
      </p>
      <span className="flex items-center justify-center text-2xl text-chocoBrown font-commissioner">
        Vote: 5 <CoinCurrency className="max-h-8 " />
      </span>
      <div className="pt-11">
        <div>
          <p className="text-2xl font-commissioner font-[600] text-chocoBrown">
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
              className="max-w-20 py-1.5 text-center font-ADLaM text-[28px] outline-none border-2 border-chocoBrown rounded-lg bg-white"
            />
            <button
              type="button"
              onClick={() => setVotes((prevCount) => prevCount + 1)}
            >
              <PlusIcon />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {foodCards?.map((foodCard) => (
            <button
              type="button"
              key={foodCard?.id}
              onClick={() => setSelectedFood(foodCard?.name)}
              className={`border-[3px] rounded-2xl border-chocoBrown flex p-4 min-w-[340px] cursor-pointer ${
                selectedFood === foodCard?.name ? 'bg-white' : ''
              } `}
            >
              <input
                type="radio"
                id={foodCard?.name}
                name="food"
                value={selectedFood}
                className="mt-3 text-chocoBrown"
              />
              <label
                htmlFor={foodCard?.name}
                className="text-left flex flex-col ml-4 cursor-pointer"
              >
                <h3 className="font-commissioner font-bold text-2xl text-chocoBrown mb-2">
                  {foodCard?.name}
                </h3>
                <p className="text-base font-commissioner text-chocoBrown">
                  {foodCard?.description}
                </p>
              </label>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default SnackCard;
