import { MouseEventHandler, useState } from 'react';
import { StorageImage } from '@aws-amplify/ui-react-storage';
import { Loader } from '@aws-amplify/ui-react';
import { DownRightArrowIcon } from './Icons';
// import Elon from '/src/assets/play/elon.png';

type Props = {
  capy: { name: string; image: string };
  handleClick: MouseEventHandler<HTMLElement>;
};

function SelectedCharacterCard({ capy, handleClick }: Props) {
  const [isImageLoading, setIsImageLoading] = useState<boolean>(true);

  return (
    <div className="bg-babyCronYellow md:pt-6 pt-4 md:pb-8 pb-4 md:px-12 px-4 shadow-characterCard lg:max-w-[312px] flex lg:flex-col flex-row items-center md:gap-y-12 gap-y-6 md:gap-x-0 gap-x-2 h-fit sm:flex-nowrap flex-wrap md:justify-between justify-center">
      <div className="flex gap-x-2 items-center">
        <DownRightArrowIcon clx="md:max-w-auto max-w-[34px]" />
        <span className="md:text-[56px] md:mr-0 mr-6 text-titleSizeSM font-hanaleiFill text-chocoBrown uppercase">
          {capy?.name}
        </span>
      </div>
      <div className="relative">
        {/* Loading Spinner */}
        {isImageLoading && (
          <div className="absolute w-full h-full rounded-3xl flex justify-center items-center">
            <Loader width="2rem" height="2rem" filledColor="#7a3f3e" />
          </div>
        )}
        {/* Actual Image */}
        {capy?.image ? (
          <StorageImage
            alt=""
            path={capy?.image ?? ''}
            loading="lazy"
            className="md:max-w-[192px] max-w-[106px]"
            onLoad={() => setIsImageLoading(false)}
          />
        ) : null}
      </div>
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
