import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import styles from "./WatchRoom.module.css";
import LiveStream from "../../Streaming/LiveStream";
import ChatRoom from "./ChatRoom/ChatRoom";
import EmojiRating from "./EmojiRating/EmojiRating";
import Footer from "../../Footer/Footer";

import coinIcon from "../../../assets/icons/coin.svg";
import fbIcon from "../../../assets/icons/fb.svg";
import twitterIcon from "../../../assets/icons/twitter.svg";
import instaIcon from "../../../assets/icons/insta.svg";
import shareIcon from "../../../assets/icons/share.svg";
import magnuspic from "../../../assets/filled-magnus.svg";

const WatchRoom = () => {
  const { streamId, streamTitle } = useParams<{
    streamId: string;
    streamTitle: string;
  }>();

  const [isMobile, setIsMobile] = useState(window.innerWidth < 500);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 500);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <>
      <div className={styles.watchRoomWrapper}>
        <h1>{streamTitle}’ ROOM</h1>
        <div className={styles.watchRoomContent}>
          <div className={styles.roomCamsContainer}>
            <button className={styles.selected}>{streamTitle}’ main cam</button>
            <button>{streamTitle}’ food cam</button>
            <button>{streamTitle}’ bedroom cam</button>
          </div>

          <div className={styles.streamToolbarContainer}>
            <div className={styles.coinsStatus}>
              <span className={styles.coinsStatus__title}>Watch-to-earn:</span>
              <img src={coinIcon} alt="coin" />
              <span className={styles.coinsStatus__value}>8/10</span>
            </div>

            <div className={styles.progressContainer}>
              <div
                className={styles.progressBar}
                style={{ width: `${50}%` }}
              ></div>
            </div>

            <button className={styles.collectButton}>Collect</button>

            <div className={styles.streamShareIcons}>
              <img src={fbIcon} alt="fb" />
              <img src={twitterIcon} alt="X" />
              <img src={instaIcon} alt="Insta" />
              <img src={shareIcon} alt="Share" />
            </div>
          </div>
        </div>

        <div className={styles.videoMainContainer}>
          <div className={styles.videoAndCommentSection}>
            <div className={styles.videoSection}>
              <LiveStream
                streamId={streamId ?? "fa7ahoikpf19u1e0"}
                title={streamTitle ?? "magstream1"}
                profilePic={magnuspic}
              />
            </div>
            <div className={styles.commentSection}>
              <ChatRoom />
            </div>
          </div>
          <EmojiRating />
        </div>
      </div>
      {!isMobile && <Footer />}
    </>
  );
};

export default WatchRoom;
