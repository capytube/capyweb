import { useEffect, useState } from 'react';
import { useAtomValue } from 'jotai';
import { Placeholder } from '@aws-amplify/ui-react';
import CapyProfile from './CapyProfile/CapyProfile';
import styles from './OurCapybaras.module.css';
import fruitIcon from '../../../assets/fruit.svg';
import flowerIcon from '../../../assets/flower.svg';
import { listCapybaras } from '../../../api/capybara';
import { capybaraAtom } from '../../../store/atoms/capybaraAtom';

const OurCapybaras = () => {
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
    <div className={styles.ourCapybarasWrapper}>
      <h1>
        <img src={fruitIcon} alt="orange" /> Our Capybaras <img src={flowerIcon} alt="flower" />
      </h1>

      <div className={styles.ourCapybarasProfilesCards}>
        {!loading && capybaraData?.length ? (
          <>
            {capybaraData?.map((data, index) => {
              return (
                <CapyProfile
                  data={data}
                  key={data.id}
                  customCardStyle={{
                    transform: `rotate(${index % 2 === 0 ? '-1deg' : '1deg'})`,
                  }}
                />
              );
            })}
          </>
        ) : (
          <>
            <Placeholder height="300px" width="550px" className="rounded-lg" />
            <Placeholder height="300px" width="550px" className="rounded-lg" />
            <Placeholder height="300px" width="550px" className="rounded-lg" />
          </>
        )}
      </div>
    </div>
  );
};

export default OurCapybaras;
