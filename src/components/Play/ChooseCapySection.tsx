import CharacterCard from './CharacterCard';

import Elon from '/src/assets/play/elon.png';
import Einstein from '/src/assets/play/einstien.png';
import Magnus from '/src/assets/play/magnus.png';

type Props = {
  handleCapySelection: Function;
};

const characters = [
  { id: 1, name: 'Elon', image: Elon, rotate: 356.62 },
  {
    id: 2,
    name: 'Einstein',
    image: Einstein,
    rotate: 4,
  },
  {
    id: 3,
    name: 'Magnus',
    image: Magnus,
    rotate: 356.62,
  },
];

function ChooseCapySection({ handleCapySelection }: Props) {
  return (
    <div
      id="choose-capy"
      className="md:py-20 py-8 pb-24 md:px-40 px-10 flex flex-col justify-center items-center md:gap-y-10 gap-y-[18px]"
    >
      <div>
        <h2 className="uppercase md:text-titleSize text-titleSizeSM text-center text-chocoBrown font-hanaleiFill">
          CHOOSE YOUR CAPY
        </h2>
        <p className="font-commissioner md:text-titleSizeSM text-sm text-center text-chocoBrown md:pt-4 pt-[18px]">
          Click to choose your capybara
        </p>
      </div>
      <div className="flex gap-x-12 md:flex-nowrap flex-wrap md:gap-y-0 gap-y-[18px] justify-center">
        {characters?.map((character) => (
          <CharacterCard
            key={character?.id}
            data={character}
            handleCapySelection={handleCapySelection}
          />
        ))}
      </div>
    </div>
  );
}

export default ChooseCapySection;
