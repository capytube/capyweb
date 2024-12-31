import { useEffect, useState } from 'react';
import { useAtomValue } from 'jotai';
import styles from './PublicStream.module.css';
import LivepeerPlayer from '../../LivepeerPlayer';
import { livestreamPublicAtom } from '../../../store/atoms/livestreamAtom';
import { listPublicLivestreams } from '../../../api/livestream';

const PublicStream = () => {
  // hooks
  const publicStreamData = useAtomValue(livestreamPublicAtom);

  // states
  const [isStreamDataLoading, setIsStreamDataLoading] = useState(false);

  // effects
  useEffect(() => {
    const fetchPublicStreams = async () => {
      setIsStreamDataLoading(true);
      await listPublicLivestreams()
        .then((res) => {
          if (res?.data?.length) {
            setIsStreamDataLoading(false);
          }
        })
        .catch(() => {
          setIsStreamDataLoading(false);
        });
    };

    if (publicStreamData?.length === 0) {
      fetchPublicStreams();
    }
  }, []);

  return (
    <div className={styles.publicStreamWrapper}>
      <h1>Public stream</h1>

      {!isStreamDataLoading && publicStreamData?.length > 0 ? (
        <div className={styles.publicStreamPlayerContainer}>
          <LivepeerPlayer streamId={publicStreamData?.[0]?.streaming_address ?? ''} title="Magnus" />
        </div>
      ) : (
        'Loading stream...'
      )}
    </div>
  );
};

export default PublicStream;
