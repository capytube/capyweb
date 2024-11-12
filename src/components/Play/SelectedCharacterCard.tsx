import { MouseEventHandler } from 'react';
import { DownRightArrowIcon } from './Icons';
import Elon from '/src/assets/play/elon.png';

type Props = {
  handleClick: MouseEventHandler<HTMLElement>;
};

function SelectedCharacterCard({ handleClick }: Props) {
  return (
    <div className="bg-babyCronYellow md:pt-6 pt-4 md:pb-8 pb-4 md:px-12 px-4 shadow-characterCard lg:max-w-[312px] flex lg:flex-col flex-row items-center gap-y-12 md:gap-x-0 gap-x-2 h-fit">
      <div className="flex gap-x-2 items-center">
        <DownRightArrowIcon clx="md:max-w-auto max-w-[34px]" />
        <span className="md:text-[56px] text-titleSizeSM font-hanaleiFill text-chocoBrown">
          ELON
        </span>
      </div>
      <img src={Elon} alt="capy" className="md:max-w-[192px] max-w-[106px] " />
      <button
        type="button"
        className="md:text-3xl text-base bg-darkOrange rounded-lg md:px-4 px-3.5 md:py-2.5 py-1.5 max-h-fit text-white font-ADLaM shadow-buttonShadow"
        onClick={handleClick}
      >
        Change capy
      </button>
    </div>
  );
}

export default SelectedCharacterCard;
