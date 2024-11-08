import { DownRightArrowIcon } from './Icons';

type Props = {};

function SelectedCharacterCard({}: Props) {
  return (
    <div className="bg-babyCronYellow pt-6 pb-8 px-12 shadow-characterCard max-w-[312px] flex flex-col gap-y-12">
      <div className="flex gap-x-2 items-center">
        <DownRightArrowIcon />{' '}
        <span className="text-[56px] font-hanaleiFill text-chocoBrown">
          ELON
        </span>
      </div>
      <img src="/src/assets/play/elon.png" alt="capy" />
      <button
        type="button"
        className="text-3xl bg-darkOrange rounded-lg px-4 py-2.5 text-white font-ADLaM shadow-buttonShadow"
      >
        Change capy
      </button>
    </div>
  );
}

export default SelectedCharacterCard;
