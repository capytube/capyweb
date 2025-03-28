import { useEffect, useState } from 'react';
import { useAtomValue } from 'jotai';
import CharacterCard from './CharacterCard';
import { capybaraAtom } from '../../store/atoms/capybaraAtom';
import { listCapybaras } from '../../api/capybara';

type Props = {
  handleCapySelection: Function;
};

function ChooseCapySection({ handleCapySelection }: Readonly<Props>) {
  // hooks
  const capybaraData = useAtomValue(capybaraAtom);

  // states
  const [isCapyDataLoading, setIsCapyDataLoading] = useState(true);

  // effects
  useEffect(() => {
    const fetchAllCapyData = async () => {
      await listCapybaras()
        .then(() => {
          setIsCapyDataLoading(false);
        })
        .catch(() => {
          setIsCapyDataLoading(false);
        });
    };

    fetchAllCapyData();
  }, []);

  return (
    <div
      id="choose-capy"
      className="md:py-20 py-8 pb-24 md:px-40 px-10 flex flex-col justify-center items-center md:gap-y-10 gap-y-[18px]"
    >
      {!isCapyDataLoading ? (
        <>
          {capybaraData?.length > 0 ? (
            <>
              <div>
                <h2 className="uppercase md:text-titleSize text-titleSizeSM text-center text-chocoBrown font-hanaleiFill">
                  CHOOSE YOUR CAPY
                </h2>
                <p className="font-commissioner md:text-titleSizeSM text-sm text-center text-chocoBrown md:pt-4 pt-[18px]">
                  Click to choose your capybara
                </p>
              </div>
              <div className="md:flex gap-x-12 md:flex-nowrap md:gap-y-0 gap-y-[18px] justify-center">
                {[...capybaraData]
                  ?.sort((a, b) => (a?.name ?? '')?.localeCompare(b?.name ?? ''))
                  ?.map((character) => (
                    <CharacterCard key={character?.id} data={character} handleCapySelection={handleCapySelection} />
                  ))}
              </div>
            </>
          ) : (
            <div className="font-hanaleiFill text-chocoBrown md:text-4xl text-2xl text-center px-3">
              The Capybara data is not available right now,
              <br />
              Try again later sometime
            </div>
          )}
        </>
      ) : (
        <div className="animate-bounce font-hanaleiFill md:h-full h-[50dvh] text-chocoBrown md:text-7xl text-3xl flex justify-center items-center">
          loading...
        </div>
      )}
    </div>
  );
}

export default ChooseCapySection;
