import styles from "./PublicStream.module.css";
// import LiveStream from "../../Streaming/LiveStream";
// import magnuspic from "../../../assets/filled-magnus.svg";
import vidFrame from "../../../assets/vidFrame.svg";

const PublicStream = () => {
  return (
    <div className={styles.publicStreamWrapper}>
      <h1>Public stream</h1>

      <div className={styles.publicStreamPlayerContainer}>
        {/* <LiveStream
          streamId="fa7ahoikpf19u1e0"
          title="magstream1"
          profilePic={magnuspic}
        /> */}
        <img
          src={vidFrame}
          alt="frame"
          style={{ background: "black" }}
        />
      </div>
    </div>
  );
};

export default PublicStream;
