import React, { useEffect, useState } from 'react';
import { EnterFullscreenIcon, ExitFullscreenIcon, PauseIcon, PlayIcon } from '@livepeer/react/assets';
import { Src } from '@livepeer/react';
import { useLocation } from 'react-router-dom';
import { useIsLoggedIn } from '@dynamic-labs/sdk-react-core';

import * as Player from '@livepeer/react/player';
// import { updateUserCoins } from '../../utils/api';
// import { isFirstDateBeforeSecond } from '../../utils/function';

import './LiveStream.css';

interface LiveStreamProps {
  vodSource: Src[];
  title: string;
  viewerId: string;
  videoRef: React.MutableRefObject<any>;
  setIsCapyCoinIncrementing?: React.Dispatch<React.SetStateAction<boolean>>;
  setIsResumeStreamConfirmation?: React.Dispatch<React.SetStateAction<boolean>>;
  setIsVideoPlaying?: React.Dispatch<React.SetStateAction<boolean>>;
}

const dailyLimit = 10;

const LiveStream = ({
  vodSource,
  title,
  viewerId,
  videoRef,
  setIsCapyCoinIncrementing,
  setIsResumeStreamConfirmation,
  setIsVideoPlaying,
}: LiveStreamProps) => {
  const { pathname } = useLocation();
  const isHomePage = pathname === '/';
  const isloggedIn = useIsLoggedIn();

  // const [previousDay, setPreviousDay] = useState(false);

  const [playTime, setPlayTime] = useState<number>(() => {
    const savedPlayTime = localStorage.getItem('playTime');
    return savedPlayTime ? parseInt(savedPlayTime, 10) : 0;
  });

  // const coins = (user?.todayEarnedCoins ? user?.todayEarnedCoins?.coins : 0) ?? 0;
  const coins = 0;

  console.log('time', playTime);
  const isCoinUpdateEnabled = false;

  const handleTimeUpdate = () => {
    if (isloggedIn && videoRef.current && !videoRef.current.paused && !isHomePage && !pathname?.includes('play')) {
      setIsVideoPlaying?.(true);

      if (coins < dailyLimit && isCoinUpdateEnabled) {
        setPlayTime((prev) => prev + 1); // Increment playTime by 1 second
        setIsCapyCoinIncrementing?.(true);
      } else {
        setIsCapyCoinIncrementing?.(false);
      }
    } else {
      setIsVideoPlaying?.(false);
    }
  };

  // useEffect(() => {
  //   if (playTime >= 180 && coins < dailyLimit && isloggedIn) {
  //     // Increment coins per minute watched
  //     updateUserCoins({
  //       userId: viewerId,
  //       timeStamp: new Date().getTime(),
  //       earnedCoins: coins + 1,
  //       totalCoins: (user?.totalEarnedCoins ?? 0) + 1,
  //     });

  //     setPlayTime(0); // Reset playTime after earning a coin
  //   }
  // }, [playTime]);

  // useEffect(() => {
  //   if (user?.todayEarnedCoins?.coins && user?.todayEarnedCoins?.timeStamp) {
  //     const isPreviousDay = isFirstDateBeforeSecond(user?.todayEarnedCoins?.timeStamp, new Date().getTime());
  //     setPreviousDay(isPreviousDay);
  //   }
  // }, [user]);

  // useEffect(() => {
  //   if (previousDay && user?.totalEarnedCoins) {
  //     updateUserCoins({
  //       userId: viewerId,
  //       earnedCoins: 0,
  //       totalCoins: user?.totalEarnedCoins,
  //       timeStamp: new Date().getTime(),
  //     });
  //   }
  // }, [previousDay]);

  useEffect(() => {
    const handlePauseVid = () => {
      if (document.hidden && videoRef?.current && !videoRef.current.paused && !isHomePage) {
        videoRef.current.pause();
        setIsResumeStreamConfirmation?.(true);
      }
    };
    document.addEventListener('visibilitychange', handlePauseVid);

    return () => {
      document.removeEventListener('visibilitychange', handlePauseVid);
    };
  }, [isHomePage, pathname]);

  return (
    <Player.Root src={vodSource} autoPlay volume={0} viewerId={viewerId}>
      <Player.Container>
        <Player.Video
          ref={videoRef}
          title={title}
          style={{ height: '100%', width: '100%' }}
          onTimeUpdate={handleTimeUpdate}
        />
        <Player.FullscreenTrigger
          style={{
            position: 'absolute',
            left: 20,
            bottom: 20,
            width: 25,
            height: 25,
          }}
        >
          <Player.FullscreenIndicator asChild matcher={false}>
            <EnterFullscreenIcon />
          </Player.FullscreenIndicator>
          <Player.FullscreenIndicator asChild>
            <ExitFullscreenIcon />
          </Player.FullscreenIndicator>
        </Player.FullscreenTrigger>
        {!isHomePage ? (
          <Player.Controls
            style={{
              background: 'linear-gradient(to bottom, rgba(90, 90, 90, 0.2), rgba(82, 82, 82, 0.365))',
            }}
            className="py-2 px-4 flex flex-col-reverse gap-5 justify-center items-center inset-0"
          >
            <Player.PlayPauseTrigger className="pt-4">
              <Player.PlayingIndicator asChild matcher={false}>
                <PlayIcon className="size-20 text-cream" />
              </Player.PlayingIndicator>
              <Player.PlayingIndicator asChild>
                <PauseIcon className="size-20 text-cream" />
              </Player.PlayingIndicator>
            </Player.PlayPauseTrigger>
          </Player.Controls>
        ) : null}
      </Player.Container>
    </Player.Root>
  );
};

export default LiveStream;
