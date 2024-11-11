import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import styles from "./WatchRoom.module.css";
import LivepeerPlayer from "../../LivepeerPlayer";
import ChatRoom from "./ChatRoom/ChatRoom";
import EmojiRating from "./EmojiRating/EmojiRating";
import Footer from "../../Footer/Footer";

import coinIcon from "../../../assets/icons/coin.svg";
import fbIcon from "../../../assets/icons/fb.svg";
import twitterIcon from "../../../assets/icons/twitter.svg";
import instaIcon from "../../../assets/icons/insta.svg";
import shareIcon from "../../../assets/icons/share.svg";

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
            <button className={styles.selected}>
              <span className={styles.hideInMobile}>{streamTitle}’ </span>
              {""}
              main cam
            </button>
            <button>
              <span className={styles.hideInMobile}>{streamTitle}’ </span>
              {""}
              food cam
            </button>
            <button>
              <span className={styles.hideInMobile}>{streamTitle}’ </span>
              {""}
              bedroom cam
            </button>
          </div>

          <div className={styles.streamToolbarContainer}>
            <div className={styles.coinsStatus}>
              <span className={styles.coinsStatus__title}>Watch-to-earn:</span>
              <div className={styles.coinsStatus__value__div}>
                <img src={coinIcon} alt="coin" />
                <span className={styles.coinsStatus__value}>8/10</span>
              </div>
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
              <LivepeerPlayer
                streamId={streamId ?? "fa7ahoikpf19u1e0"}
                title={streamTitle ?? "magstream1"}
              />
            </div>
            <div className={styles.commentSection}>
              <div className={styles.emojiRatingWrapper__mobile}>
                <EmojiRating />
              </div>
              <ChatRoom />
            </div>
          </div>
          <div className={styles.emojiRatingWrapper}>
            <EmojiRating />
          </div>
        </div>
      </div>
      {!isMobile && <Footer />}
    </>
  );
};

export default WatchRoom;
