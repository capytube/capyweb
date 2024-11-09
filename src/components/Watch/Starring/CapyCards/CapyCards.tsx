import styles from "./CapyCards.module.css";
import { StarringData } from "../Starring";

interface CapyProfileProps {
  data: StarringData;
  customCardStyle: { transform: string };
}

const CapyProfile = (props: CapyProfileProps) => {
  const { data, customCardStyle } = props;

  return (
    <div className={styles.card} style={customCardStyle}>
      <img src={data?.image} alt={data?.name} className={styles.image} />
      <div className={styles.content}>
        <h2 className={styles.name}>{data?.name}</h2>
        <div className={styles.detail}>
          <p className={styles.bio}>{data?.bio}</p>
          <button className={styles.watchButton}>Watch</button>
        </div>
        <p className={styles.streamCount}>
          <div className={styles.greenCircle} /> {data?.streamCount} available
          streams
        </p>
        <button className={styles.watchButton__mobile}>Watch</button>
      </div>
    </div>
  );
};

export default CapyProfile;
