import React from 'react';
import ring from '/src/assets/ring.png';

type Props = {
  handleCapySelection: Function;
  data: {
    name: string;
    image: string;
    rotate: number;
  };
};

function CharacterCard({ data, handleCapySelection }: Props) {
  const [active, setActive] = React.useState(false);

  const rotate = () => {
    if (data?.name === 'Magnus') {
      return '-rotate-[3.38deg]';
    }

    if (data?.name === 'Elon') {
      return '-rotate-[11.56deg]';
    }
    return 'rotate-[4.36deg]';
  };

  return (
    <div
      className="flex flex-col justify-between items-center cursor-pointer relative"
      onClick={(e) => handleCapySelection(e, data)}
      onMouseOver={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
    >
      <img src={data?.image} alt={data?.name} className="relative z-10" />
      {active && (
        <div
          className={`absolute ${
            data?.name === 'Magnus' ? '-top-9' : ''
          } left-0 z-0`}
        >
          <img
            className={data?.name === 'Magnus' ? 'w-[500px] h-[300px]' : ''}
            src={ring}
            alt="ring"
          />
        </div>
      )}
      <div
        className={`border-4 border-chocoBrown bg-babyCronYellow rounded-lg md:text-5xl text-titleSizeSM text-chocoBrown font-dynapuff md:py-2.5 py-1 px-2 md:px-5 w-fit lg:mr-14 ${rotate()}`}
      >
        {data?.name}
      </div>
    </div>
  );
}

export default CharacterCard;
