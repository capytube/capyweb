import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useIsLoggedIn } from '@dynamic-labs/sdk-react-core';
import { useAtom } from 'jotai';
import styles from './WatchRoom.module.css';
import LivepeerPlayer from '../../LivepeerPlayer';
import ChatRoom from './ChatRoom/ChatRoom';
import EmojiRating from './EmojiRating/EmojiRating';
import Footer from '../../Footer/Footer';
import { userAtom } from '../../../atoms/atom';

import coinIcon from '../../../assets/icons/coin.svg';
import fbIcon from '../../../assets/icons/fb.svg';
import twitterIcon from '../../../assets/icons/twitter.svg';
import instaIcon from '../../../assets/icons/insta.svg';
import shareIcon from '../../../assets/icons/share.svg';

const dailyLimit = 10;

const WatchRoom = () => {
  const navigate = useNavigate();
  const { streamId, streamTitle } = useParams<{
    streamId: string;
    streamTitle: string;
  }>();
  const isLoggedIn = useIsLoggedIn();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 500);
  const [isCapyCoinIncrementing, setIsCapyCoinIncrementing] = useState<boolean>(false);

  const [user] = useAtom(userAtom);
  const watchCoins =
    (() => {
      if (isLoggedIn) {
        if (user?.todayEarnedCoins) {
          return user?.todayEarnedCoins?.coins;
        }
      }
      return 0;
    })() ?? 0;

  const [activeCam, setActiveCam] = useState(0);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 500);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <>
      <div className={styles.watchRoomWrapper}>
        <h1>{streamTitle}’ ROOM</h1>
        <div className={styles.watchRoomContent}>
          <div className={styles.roomCamsContainer}>
            {[
              { camName: 'main', streamId: 'fa7ahoikpf19u1e0' },
              { camName: 'food', streamId: 'fa7ahoikpf19u1e0' },
              { camName: 'bedroom', streamId: 'fa7ahoikpf19u1e0' },
            ].map(({ camName, streamId }, index) => (
              <button
                key={camName}
                className={activeCam === index ? styles.selected : ''}
                onClick={() => {
                  setActiveCam(index);
                  navigate(`/stream/${streamId}/${streamTitle}`, { replace: true });
                }}
              >
                <span className={styles.hideInMobile}>{streamTitle}’ </span>
                {''}
                {camName} cam
              </button>
            ))}
          </div>

          <div className={styles.streamToolbarContainer}>
            <div className={styles.coinsStatus}>
              <span className={styles.coinsStatus__title}>Watch-to-earn:</span>
              <div className={styles.coinsStatus__value__div}>
                <img src={coinIcon} alt="coin" />
                <span className={styles.coinsStatus__value}>
                  {watchCoins}/{dailyLimit}
                </span>
              </div>
            </div>
            <div className="flex flex-col md:flex-row items-center gap-2">
              <div className={styles.progressContainer}>
                <div className={isCapyCoinIncrementing ? styles.progressBarWrapper : ''} />
                <div className={styles.progressBar} style={{ width: `${(watchCoins / dailyLimit) * 100}%` }} />
              </div>
              {watchCoins === dailyLimit ? (
                <span className="font-commissioner text-lg text-chocoBrown font-normal">daily limit reached!</span>
              ) : null}
            </div>

            {/* <button
              disabled={watchCoins < dailyLimit}
              className={`${styles.collectButton} ${
                watchCoins === 10
                  ? "animate-pulse"
                  : "bg-siteGreen cursor-not-allowed"
              }`}
            >
              {watchCoins === dailyLimit ? "Collect now" : "Collect"}
            </button> */}

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
                streamId={streamId ?? ''}
                title={streamTitle ?? ''}
                setIsCapyCoinIncrementing={setIsCapyCoinIncrementing}
              />
            </div>
            <div className={styles.commentSection}>
              <div className={styles.emojiRatingWrapper__mobile}>
                <EmojiRating streamId={streamId ?? ''} />
              </div>
              <ChatRoom streamId={streamId ?? ''} />
            </div>
          </div>
          <div className={styles.emojiRatingWrapper}>
            <EmojiRating streamId={streamId ?? ''} />
          </div>
        </div>
      </div>
      {!isMobile && <Footer />}
    </>
  );
};

export default WatchRoom;
