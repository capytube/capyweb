import styles from "./PublicStream.module.css";
import LivepeerPlayer from "../../LivepeerPlayer";

const PublicStream = () => {
  return (
    <div className={styles.publicStreamWrapper}>
      <h1>Public stream</h1>

      <div className={styles.publicStreamPlayerContainer}>
        <LivepeerPlayer streamId="fa7ahoikpf19u1e0" title="Magnus" />
      </div>
    </div>
  );
};

export default PublicStream;
