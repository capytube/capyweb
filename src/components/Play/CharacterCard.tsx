import { useState } from 'react';
import { StorageImage } from '@aws-amplify/ui-react-storage';
import { Loader } from '@aws-amplify/ui-react';
import ring from '/src/assets/ring.png';
import { CapybaraAtomType } from '../../store/atoms/capybaraAtom';

type Props = {
  data: CapybaraAtomType;
  handleCapySelection: Function;
};

function CharacterCard({ data, handleCapySelection }: Props) {
  const [active, setActive] = useState<boolean>(false);
  const [isImageLoading, setIsImageLoading] = useState<boolean>(true);

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
      <div className="relative xl:w-[400px] xl:h-[300px] h-[200px]">
        {/* Loading Spinner */}
        {isImageLoading && (
          <div className="absolute w-full h-full rounded-3xl flex justify-center items-center">
            <Loader width="4rem" height="4rem" filledColor="#7a3f3e" />
          </div>
        )}
        {/* Actual Image */}
        {data?.profile_image_url ? (
          <StorageImage
            alt=""
            path={data?.profile_image_url ?? ''}
            loading="lazy"
            className="relative z-10"
            onLoad={() => setIsImageLoading(false)}
          />
        ) : null}
      </div>

      {active && !isImageLoading && (
        <div className={`absolute ${data?.name === 'Magnus' ? '-top-9' : ''} left-0 z-0`}>
          <img className={data?.name === 'Magnus' ? 'w-[500px] h-[300px]' : ''} src={ring} alt="ring" />
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
