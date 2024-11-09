import React from 'react';
import { DropdownIcon } from './Icons';
// import Footer from '../Footer/Footer';
import ChooseCapySection from './ChooseCapySection';
import GameSection from './GameSection';
import Footer from '../Footer/Footer';

type Props = {};

function index({}: Props) {
  const [selection, setSelection] = React.useState(1);
  const [openMenu, setOpenMenu] = React.useState(false);
  const [section, setSection] = React.useState(1);

  const optionsStyle = 'text-left text-lg p-2';

  const handleSection = (e: any, selection: string) => {
    e.preventDefault();
    console.log(selection);
    setSection(2);
  };

  return (
    <div>
      <div className="md:py-10 py-8 flex flex-col md:gap-y-6 gap-y-[18px] bg-grassGreen justify-center items-center">
        <h1 className="md:text-titleSize text-titleSizeSM font-hanaleiFill text-darkGreen">
          Play with Capy
        </h1>
        <p className="text-chocoBrown font-commissioner md:text-titleSizeSM text-sm">
          Spend your coins to play with our capybaras!
        </p>
        <div className="relative">
          <button
            type="button"
            className="flex bg-white md:py-2.5 py-1.5 px-4 border-2 border-chocoBrown rounded-lg items-center"
            onClick={() => setOpenMenu(!openMenu)}
          >
            <input
              type="text"
              value={selection}
              disabled
              className="pr-3 outline-none md:max-w-[210px] max-w-44 text-chocoBrown font-ADLaM md:text-[28px] text-base"
            />
            <DropdownIcon className={`${openMenu ? 'rotate-180' : ''}`} />
          </button>
          {openMenu ? (
            <div className="absolute flex flex-col bg-white w-full text-chocoBrown top-[70px] rounded-lg p-2">
              <button
                type="button"
                className={optionsStyle}
                onClick={() => {
                  setSelection(1);
                  setOpenMenu(!openMenu);
                }}
              >
                option 1
              </button>
              <button
                type="button"
                className={optionsStyle}
                onClick={() => {
                  setSelection(2);
                  setOpenMenu(!openMenu);
                }}
              >
                option 2
              </button>
              <button
                type="button"
                className={optionsStyle}
                onClick={() => {
                  setSelection(3);
                  setOpenMenu(!openMenu);
                }}
              >
                option 3
              </button>
            </div>
          ) : null}
        </div>
      </div>
      {section !== 2 ? (
        <ChooseCapySection handleCapySelection={handleSection} />
      ) : (
        <GameSection handleSectionChange={() => setSection(1)} />
      )}

      <Footer />
    </div>
  );
}

export default index;
