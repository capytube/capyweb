import { useEffect, useState } from 'react';
import { useAtomValue } from 'jotai';
import CapyCards from './CapyCards/CapyCards';

import styles from './Starring.module.css';
import { CapybaraAtomType, capybaraAtom } from '../../../store/atoms/capybaraAtom';
import { livestreamPrivateAtom } from '../../../store/atoms/livestreamAtom';
import { listCapybaras } from '../../../api/capybara';
import { listPrivateLivestreams } from '../../../api/livestream';

interface CapyDataType extends CapybaraAtomType {
  stream_count?: number;
}

const Starring = () => {
  // hooks
  const capybaraData = useAtomValue(capybaraAtom);
  const privateStreamData = useAtomValue(livestreamPrivateAtom);

  // states
  const [isCapyDataLoading, setIsCapyDataLoading] = useState(false);
  const [isStreamDataLoading, setIsStreamDataLoading] = useState(false);
  const [updatedCapyData, setUpdatedCapyData] = useState<CapyDataType[]>([]);

  // variables
  const isLoading = isCapyDataLoading && isStreamDataLoading;

  // effects
  useEffect(() => {
    const fetchAllCapyData = async () => {
      setIsCapyDataLoading(true);
      await listCapybaras()
        .then((res) => {
          if (res?.data?.length) {
            setIsCapyDataLoading(false);
          }
        })
        .catch(() => {
          setIsCapyDataLoading(false);
        });
    };

    if (capybaraData?.length === 0) {
      fetchAllCapyData();
    }
  }, []);

  useEffect(() => {
    const fetchPrivateStreams = async () => {
      setIsStreamDataLoading(true);
      await listPrivateLivestreams()
        .then((res) => {
          if (res?.data?.length) {
            setIsStreamDataLoading(false);
          }
        })
        .catch(() => {
          setIsStreamDataLoading(false);
        });
    };

    if (privateStreamData?.length === 0) {
      fetchPrivateStreams();
    }
  }, []);

  useEffect(() => {
    if (capybaraData?.length && privateStreamData?.length) {
      const clonedData: CapyDataType[] = [...capybaraData];
      clonedData.forEach((capy) => {
        capy.stream_count = privateStreamData.reduce((count, stream) => {
          return count + (Array.isArray(stream.capybara_ids) && stream.capybara_ids.includes(capy.id) ? 1 : 0);
        }, 0);
      });

      setUpdatedCapyData(clonedData);
    }
  }, [capybaraData, privateStreamData]);

  return (
    <div className={styles.starringWrapper}>
      {!isLoading && updatedCapyData?.length ? (
        <>
          <h1>STARRING...</h1>

          <div className={styles.starringCapyCardsWrapper}>
            {updatedCapyData?.map((data, index) => {
              return (
                <CapyCards
                  data={{
                    ...data,
                    streamCount: data.stream_count ?? 0,
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
