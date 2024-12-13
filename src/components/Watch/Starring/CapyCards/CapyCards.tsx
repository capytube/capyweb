import { useNavigate } from 'react-router-dom';
import { StorageImage } from '@aws-amplify/ui-react-storage';

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

  const handleWatchStream = (capyId: string) => {
    navigate(`/stream/${capyId}`);
  };

  return (
    <div className={styles.card} style={customCardStyle}>
      {data?.avatar_image_url ? (
        <StorageImage
          alt={data?.name ?? 'capybara'}
          path={data?.avatar_image_url ?? ''}
          loading="lazy"
          className={styles.image}
        />
      ) : null}
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
