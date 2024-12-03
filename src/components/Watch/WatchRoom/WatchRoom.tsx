import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
// import { useIsLoggedIn } from '@dynamic-labs/sdk-react-core';
import { useAtom } from 'jotai';

import { capybaraAtom } from '../../../atoms/atom';
// import { capybaraAtom, userAtom } from '../../../atoms/atom';
import { getCapybara } from '../../../utils/api';

import Footer from '../../Footer/Footer';
import ChatRoom from './ChatRoom/ChatRoom';
import LivepeerPlayer from '../../LivepeerPlayer';
import EmojiRating from './EmojiRating/EmojiRating';

// import coinIcon from '../../../assets/icons/coin.svg';
// import fbIcon from '../../../assets/icons/fb.svg';
// import twitterIcon from '../../../assets/icons/twitter.svg';
// import instaIcon from '../../../assets/icons/insta.svg';
// import shareIcon from '../../../assets/icons/share.svg';
import styles from './WatchRoom.module.css';
// import TopCrossRibbon from '../../ComingSoonRibbon/TopCrossRibbon';

// const dailyLimit = 10;

const WatchRoom = () => {
  // const navigate = useNavigate();
  const { capyId } = useParams<{
    capyId: string;
  }>();

  // const isLoggedIn = useIsLoggedIn();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 500);
  const [, setIsCapyCoinIncrementing] = useState<boolean>(false);
  // const [isCapyCoinIncrementing, setIsCapyCoinIncrementing] = useState<boolean>(false);

  // const [user] = useAtom(userAtom);
  const [capybara] = useAtom(capybaraAtom);

  // const watchCoins =
  //   (() => {
  //     if (isLoggedIn) {
  //       if (user?.todayEarnedCoins) {
  //         return user?.todayEarnedCoins?.coins;
  //       }
  //     }
  //     return 0;
  //   })() ?? 0;

  const [activeCam, setActiveCam] = useState(0);
  const [streamId, setStreamId] = useState('');

  const getCapy = async () => {
    const response = await getCapybara(capyId ?? '');
    if (response?.data?.availableCameras?.mainCam) {
      setStreamId(response?.data?.availableCameras?.mainCam);
    }
  };

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 500);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    getCapy();
  }, []);

  const availableCams = capybara?.availableCameras
    ? // @ts-ignore
      Object.keys(capybara?.availableCameras).filter((key) => capybara?.availableCameras[key])
    : [];

  return (
    <>
      <div className={styles.watchRoomWrapper}>
        {capybara?.capyName && streamId ? (
          <>
            <h1>{capybara?.capyName}’ ROOM</h1>
            <div className={styles.watchRoomContent}>
              <div className={styles.roomCamsContainer}>
                {availableCams?.map((camName, index) => {
                  // @ts-ignore
                  const stream = capybara?.availableCameras[camName];
                  return (
                    <button
                      key={camName}
                      className={`${activeCam === index ? styles.selected : ''} ${
                        !stream && 'cursor-not-allowed hidden'
                      }`}
                      disabled={!stream}
                      onClick={() => {
                        if (capybara?.availableCameras) {
                          setActiveCam(index);
                          // @ts-ignore
                          setStreamId(stream);
                        }
                      }}
                    >
                      <span className={styles.hideInMobile}>{capybara?.capyName}’ </span>
                      {''}
                      {camName?.slice(0, -3)} cam
                    </button>
                  );
                })}
              </div>

          {/*<div className={`${styles.streamToolbarContainer} sm:px-24 px-8 py-4 relative overflow-hidden`}>*/}
          {/*  <TopCrossRibbon />*/}
          {/*  <div className={styles.coinsStatus}>*/}
          {/*    <span className={styles.coinsStatus__title}>Watch-to-earn:</span>*/}
          {/*    <div className={styles.coinsStatus__value__div}>*/}
          {/*      <img src={coinIcon} alt="coin" />*/}
          {/*      <span className={styles.coinsStatus__value}>*/}
          {/*        {watchCoins}/{dailyLimit}*/}
          {/*      </span>*/}
          {/*    </div>*/}
          {/*  </div>*/}
          {/*  <div className="flex flex-col md:flex-row items-center gap-2">*/}
          {/*    <div className={styles.progressContainer}>*/}
          {/*      <div className={isCapyCoinIncrementing ? styles.progressBarWrapper : ''} />*/}
          {/*      <div className={styles.progressBar} style={{ width: `${(watchCoins / dailyLimit) * 100}%` }} />*/}
          {/*    </div>*/}
          {/*    {watchCoins === dailyLimit ? (*/}
          {/*      <span className="font-commissioner text-lg text-chocoBrown font-normal">daily limit reached!</span>*/}
          {/*    ) : null}*/}
          {/*  </div>*/}

          {/*      /!* <button*/}
          {/*    disabled={watchCoins < dailyLimit}*/}
          {/*    className={`${styles.collectButton} ${*/}
          {/*      watchCoins === 10*/}
          {/*        ? "animate-pulse"*/}
          {/*        : "bg-siteGreen cursor-not-allowed"*/}
          {/*    }`}*/}
          {/*  >*/}
          {/*    {watchCoins === dailyLimit ? "Collect now" : "Collect"}*/}
          {/*  </button> *!/*/}

          {/*      <div className={styles.streamShareIcons}>*/}
          {/*        <img src={fbIcon} alt="fb" />*/}
          {/*        <img src={twitterIcon} alt="X" />*/}
          {/*        <img src={instaIcon} alt="Insta" />*/}
          {/*        <img src={shareIcon} alt="Share" />*/}
          {/*      </div>*/}
          {/*    </div>*/}
            </div>

            <div className={styles.videoMainContainer}>
              <div className={styles.videoAndCommentSection}>
                <div className={styles.videoSection}>
                  <LivepeerPlayer
                    streamId={streamId ?? ''}
                    title={capybara?.capyName ?? ''}
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
          </>
        ) : (
          <div className="animate-bounce font-hanaleiFill text-chocoBrown text-7xl md:h-[37dvh] h-[80dvh] flex justify-center items-center">
            loading...
          </div>
        )}
      </div>
      {!isMobile && <Footer />}
    </>
  );
};

export default WatchRoom;
