import { useAtom } from 'jotai';
import { capyListAtom } from '../../../atoms/atom';
import CapyCards from './CapyCards/CapyCards';

import starringMagnus from '../../../assets/starringMagnus.jpg';
import starringElon from '../../../assets/magst1.jpeg';
import starringEinstein from '../../../assets/magst2.jpeg';

import styles from './Starring.module.css';

export interface StarringData {
  id: string | null;
  streamId?: string;
  image: string;
  name: string | null;
  bio: string | null;
  url: string;
  streamCount: number | null;
}

const capyData: StarringData[] = [
  {
    id: '1',
    streamId: 'fa7ahoikpf19u1e0',
    image: starringMagnus,
    name: 'Magnus',
    bio: 'Watch our biggest naughty boy munching and chasing his little brother',
    url: '#',
    streamCount: 3,
  },
  {
    id: '2',
    streamId: 'fa7ahoikpf19u1e0',
    image: starringElon,
    name: 'Elon',
    bio: 'This fearless bad boy doesn’t afraid of anything. Chatty and full of energy. A truely socialised capy.',
    url: '#',
    streamCount: 3,
  },
  {
    id: '3',
    streamId: 'fa7ahoikpf19u1e0',
    image: starringEinstein,
    name: 'Einstein',
    bio: 'The youngest and shy baby loves to plan a prison break. Brainy of the boys. The mastermind capy lord.',
    url: '#',
    streamCount: 3,
  },
];

const Starring = () => {
  const [capybaraList] = useAtom(capyListAtom);

  return (
    <div className={styles.starringWrapper}>
      {capybaraList?.[0]?.id ? (
        <>
          <h1>STARRING...</h1>

          <div className={styles.starringCapyCardsWrapper}>
            {capybaraList?.map((data, index) => {
              const count = Object.values(data?.availableCameras ?? {})?.filter((value) => value !== '')?.length ?? 0;
              return (
                <CapyCards
                  data={{
                    id: data?.id,
                    name: data?.capyName,
                    bio: data?.capyDescription,
                    streamCount: count,
                    url: '#',
                    image: capyData[index]?.image,
                  }}
                  key={data.id}
                  customCardStyle={{
                    transform: `rotate(${index % 2 === 0 ? '-1deg' : '1deg'})`,
                  }}
                />
              );
            })}
          </div>
        </>
      ) : (
        <div className="animate-bounce font-hanaleiFill md:h-full h-[50dvh] text-chocoBrown md:text-7xl text-3xl flex justify-center items-center">
          loading...
        </div>
      )}
    </div>
  );
};

export default Starring;
