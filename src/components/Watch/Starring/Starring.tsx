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
  const [isCapyDataLoading, setIsCapyDataLoading] = useState(true);
  const [isStreamDataLoading, setIsStreamDataLoading] = useState(true);
  const [updatedCapyData, setUpdatedCapyData] = useState<CapyDataType[]>([]);

  // variables
  const isLoading = isCapyDataLoading && isStreamDataLoading;

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

  useEffect(() => {
    const fetchPrivateStreams = async () => {
      await listPrivateLivestreams()
        .then(() => {
          setIsStreamDataLoading(false);
        })
        .catch(() => {
          setIsStreamDataLoading(false);
        });
    };

    fetchPrivateStreams();
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
      {(() => {
        if (isLoading) {
          return (
            <div className="animate-bounce font-hanaleiFill md:h-full h-[50dvh] text-chocoBrown md:text-7xl text-3xl flex justify-center items-center py-16">
              loading...
            </div>
          );
        } else if (updatedCapyData?.length) {
          return (
            <>
              <h1>STARRING...</h1>
              <div className={styles.starringCapyCardsWrapper}>
                {updatedCapyData.map((data, index) => (
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
                ))}
              </div>
            </>
          );
        } else {
          return (
            <div className="font-hanaleiFill text-chocoBrown md:text-4xl text-2xl text-center px-3 sm:py-16 py-32">
              The Capybara streams are not available right now,
              <br />
              Try again later sometime
            </div>
          );
        }
      })()}
    </div>
  );
};

export default Starring;
