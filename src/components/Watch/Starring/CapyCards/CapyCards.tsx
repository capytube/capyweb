import { useNavigate } from 'react-router-dom';

import { StarringData } from '../Starring';
import styles from './CapyCards.module.css';

interface CapyProfileProps {
  data: StarringData;
  customCardStyle: { transform: string };
}

const CapyProfile = (props: CapyProfileProps) => {
  const { data, customCardStyle } = props;
  const navigate = useNavigate();

  const handleWatchStream = (streamId: string) => {
    navigate(`/stream/${streamId}`);
  };

  return (
    <div className={styles.card} style={customCardStyle}>
      <img src={data?.image} alt={data?.name ?? 'capybara'} className={styles.image} />
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
          className={styles.watchButton__mobile}
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
