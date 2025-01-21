import { useEffect, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
// import { useIsLoggedIn } from '@dynamic-labs/sdk-react-core';
import { useAtomValue } from 'jotai';

import Footer from '../../Footer/Footer';
import ChatRoom from './ChatRoom/ChatRoom';
import EmojiRating from './EmojiRating/EmojiRating';
import UserStreamCounter from './UserStreamCounter';

// import coinIcon from '../../../assets/icons/coin.svg';
// import fbIcon from '../../../assets/icons/fb.svg';
// import twitterIcon from '../../../assets/icons/twitter.svg';
// import instaIcon from '../../../assets/icons/insta.svg';
// import shareIcon from '../../../assets/icons/share.svg';
import styles from './WatchRoom.module.css';
import { LivestreamAtomType, livestreamPrivateAtom } from '../../../store/atoms/livestreamAtom';
import { listPrivateLivestreams } from '../../../api/livestream';
import VideoPlayer from '../../VideoPlayer';
// import TopCrossRibbon from '../../ComingSoonRibbon/TopCrossRibbon';

// const dailyLimit = 10;

const WatchRoom = () => {
  // hooks
  // const navigate = useNavigate();
  const { capyId } = useParams<{
    capyId: string;
  }>();
  const location = useLocation();
  // const isLoggedIn = useIsLoggedIn();
  const privateStreamData = useAtomValue(livestreamPrivateAtom);

  // useStates
  const [isMobile, setIsMobile] = useState(window.innerWidth < 500);
  const [, setIsCapyCoinIncrementing] = useState<boolean>(false);
  // const [isCapyCoinIncrementing, setIsCapyCoinIncrementing] = useState<boolean>(false);
  const [activeCam, setActiveCam] = useState(0);
  const [isStreamDataLoading, setIsStreamDataLoading] = useState(false);
  const [livestreamData, setLivestreamData] = useState<LivestreamAtomType[]>([]);
  const [videoStreamAddress, setVideoStreamAddress] = useState('');
  const [currentStreamData, setCurrentStreamData] = useState<LivestreamAtomType | null>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState<boolean>(false);

  // variables
  const currCapyData = JSON.parse(location?.state?.capyData ?? null);

  // functions
  // const watchCoins =
  //   (() => {
  //     if (isLoggedIn) {
  //       if (user?.todayEarnedCoins) {
  //         return user?.todayEarnedCoins?.coins;
  //       }
  //     }
  //     return 0;
  //   })() ?? 0;

  // effects
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 500);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const fetchPrivateStreams = async () => {
      setIsStreamDataLoading(true);
      await listPrivateLivestreams()
        .then((res) => {
          if (res?.data?.length) {
            setIsStreamDataLoading(false);
          }
        })
        .catch(() => {
          setIsStreamDataLoading(false);
        });
    };

    fetchPrivateStreams();
  }, []);

  useEffect(() => {
    const filterStreamsByCapyId = (streamData: typeof privateStreamData, capyId: string) => {
      return streamData?.filter(
        (stream) => Array.isArray(stream?.capybara_ids) && stream?.capybara_ids?.includes(capyId),
      );
    };

    if (privateStreamData?.length) {
      const filteredStreams = filterStreamsByCapyId(privateStreamData, capyId ?? '');

      // sorting
      const sortOrder = ['main', 'food', 'bedroom'];
      const getOrder = (title: string | null) => {
        const match = sortOrder.find((key) => title?.includes(key));
        return match ? sortOrder.indexOf(match) : sortOrder.length;
      };
      const sortedData = [...filteredStreams].sort((a, b) => getOrder(a.title) - getOrder(b.title));

      if (sortedData?.length) {
        setLivestreamData(sortedData);
        setVideoStreamAddress(sortedData?.[0]?.streaming_address ?? '');
        setCurrentStreamData(sortedData?.[0]);
      }
    }
  }, [privateStreamData, capyId]);

  return (
    <>
      <div className={styles.watchRoomWrapper}>
        {!isStreamDataLoading && videoStreamAddress ? (
          <>
            <h1>{currCapyData?.name}’ ROOM</h1>
            <div className={styles.watchRoomContent}>
              <div className={styles.roomCamsContainer}>
                {livestreamData?.map((data, index) => {
                  const streamAddr = data?.streaming_address ?? '';
                  return (
                    <button
                      key={data?.id}
                      className={`${activeCam === index ? styles.selected : ''} ${
                        !streamAddr && 'cursor-not-allowed hidden'
                      }`}
                      disabled={!streamAddr}
                      onClick={() => {
                        if (streamAddr) {
                          setActiveCam(index);
                          setVideoStreamAddress(streamAddr);
                          setCurrentStreamData(data);
                        }
                      }}
                    >
                      <span className={styles.hideInMobile}>{currCapyData?.name}’ </span>
                      {''}
                      {data?.title}
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
                  {/* <LivepeerPlayer
                    streamId={videoStreamAddress ?? ''}
                    title={currCapyData?.name ?? ''}
                    setIsCapyCoinIncrementing={setIsCapyCoinIncrementing}
                    setIsVideoPlaying={setIsVideoPlaying}
                  /> */}
                  <VideoPlayer
                    streamId={currentStreamData?.id ?? ''}
                    videoUrl={videoStreamAddress}
                    setIsCapyCoinIncrementing={setIsCapyCoinIncrementing}
                    setIsVideoPlaying={setIsVideoPlaying}
                  />
                </div>
                <div className={styles.commentSection}>
                  <div className={styles.emojiRatingWrapper__mobile}>
                    <EmojiRating streamId={videoStreamAddress ?? ''} />
                    <UserStreamCounter isVideoPlaying={isVideoPlaying} />
                  </div>
                  <ChatRoom streamId={currentStreamData?.id ?? ''} />
                </div>
              </div>
              <div className={styles.emojiRatingWrapper}>
                <EmojiRating streamId={videoStreamAddress ?? ''} />
                <UserStreamCounter isVideoPlaying={isVideoPlaying} />
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
