import { useEffect, useState } from 'react';
import { useAtomValue } from 'jotai';
import CapyCards from './CapyCards/CapyCards';

import styles from './Starring.module.css';
import { capybaraAtom } from '../../../store/atoms/capybaraAtom';
import { listCapybaras } from '../../../api/capybara';

const Starring = () => {
  // hooks
  const capybaraData = useAtomValue(capybaraAtom);

  // states
  const [loading, setLoading] = useState(false);

  // effects
  useEffect(() => {
    const fetchAllCapyData = async () => {
      setLoading(true);
      await listCapybaras()
        .then((res) => {
          if (res?.data?.length) {
            setLoading(false);
          }
        })
        .catch(() => {
          setLoading(false);
        });
    };

    if (capybaraData?.length === 0) {
      fetchAllCapyData();
    }
  }, []);

  return (
    <div className={styles.starringWrapper}>
      {!loading && capybaraData?.length ? (
        <>
          <h1>STARRING...</h1>

          <div className={styles.starringCapyCardsWrapper}>
            {capybaraData?.map((data, index) => {
              const count = 0;
              return (
                <CapyCards
                  data={{
                    ...data,
                    streamCount: count,
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
