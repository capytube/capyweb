import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StorageImage } from '@aws-amplify/ui-react-storage';
import { Loader } from '@aws-amplify/ui-react';

import styles from './CapyCards.module.css';
import { CapybaraAtomType } from '../../../../store/atoms/capybaraAtom';

export interface CapyData extends CapybaraAtomType {
  streamCount: number;
}

interface CapyProfileProps {
  data: CapyData;
  customCardStyle: { transform: string };
}

const CapyProfile = (props: CapyProfileProps) => {
  const { data, customCardStyle } = props;
  const navigate = useNavigate();
  const [isImageLoading, setIsImageLoading] = useState<boolean>(true);

  const handleWatchStream = (capyId: string) => {
    navigate(`/stream/${capyId}`, { state: { capyData: JSON.stringify(data) } });
  };

  return (
    <div className={styles.card} style={customCardStyle}>
      <div className="relative">
        {/* Loading Spinner */}
        {isImageLoading && (
          <div className="absolute w-full h-full rounded-3xl flex justify-center items-center">
            <Loader width="2.5rem" height="2.5rem" filledColor="#7a3f3e" />
          </div>
        )}
        {/* Actual Image */}
        {data?.avatar_image_url ? (
          <StorageImage
            alt=""
            path={data?.avatar_image_url ?? ''}
            loading="lazy"
            className={styles.image}
            onLoad={() => setIsImageLoading(false)}
          />
        ) : null}
      </div>
      <div className={styles.content}>
        <h2 className={styles.name}>{data?.name}</h2>
        <div className={styles.detail}>
          <p className={styles.bio}>{data?.bio}</p>
          <button
            className={`${styles.watchButton} ${data?.streamCount === 0 && 'cursor-not-allowed'}`}
            disabled={data?.streamCount === 0}
            onClick={() => {
              if (data?.id && data?.name) handleWatchStream(data?.id);
            }}
          >
            Watch
          </button>
        </div>
        <p className={styles.streamCount}>
          <span className={styles.greenCircle} /> {data?.streamCount} available streams
        </p>
        <button
          className={`${styles.watchButton__mobile} ${data?.streamCount === 0 && 'cursor-not-allowed'}`}
          disabled={data?.streamCount === 0}
          onClick={() => {
            if (data?.id) handleWatchStream(data?.id);
          }}
        >
          Watch
        </button>
      </div>
    </div>
  );
};

export default CapyProfile;
