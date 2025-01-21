import { useEffect, useState } from 'react';
import { useAtomValue } from 'jotai';
import styles from './PublicStream.module.css';
import { livestreamPublicAtom } from '../../../store/atoms/livestreamAtom';
import { listPublicLivestreams } from '../../../api/livestream';
import VideoPlayer, { VideoFrameWithErrorMessage } from '../../VideoPlayer';

const PublicStream = () => {
  // hooks
  const publicStreamData = useAtomValue(livestreamPublicAtom);

  // states
  const [isStreamDataLoading, setIsStreamDataLoading] = useState(true);

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

      <div className={styles.publicStreamPlayerContainer}>
        {publicStreamData?.length > 0 ? (
          <VideoPlayer
            streamId={publicStreamData?.[0]?.id ?? ''}
            videoUrl={publicStreamData?.[0]?.streaming_address ?? ''}
          />
        ) : (
          <VideoFrameWithErrorMessage
            message={isStreamDataLoading ? 'Loading stream...' : 'The Capybara streams isn´t available'}
          />
        )}
      </div>
    </div>
  );
};

export default PublicStream;
