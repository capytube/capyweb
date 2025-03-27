import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactPlayer from 'react-player';
import { useLocation } from 'react-router-dom';
import { useIsLoggedIn } from '@dynamic-labs/sdk-react-core';
import styles from './VideoPlayer.module.css';
import PauseStreamPopup from '../Watch/WatchRoom/PauseStreamPopup/PauseStreamPopup';
import vidFrame from '../../assets/vidFrame.svg';

interface VideoPlayerProps {
  streamId: string;
  videoUrl: string;
  setIsCapyCoinIncrementing?: React.Dispatch<React.SetStateAction<boolean>>;
  setIsVideoPlaying?: React.Dispatch<React.SetStateAction<boolean>>;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  streamId,
  videoUrl,
  setIsCapyCoinIncrementing,
  setIsVideoPlaying,
}) => {
  // hooks
  const { pathname } = useLocation();
  const isLoggedIn = useIsLoggedIn();
  const playerRef = useRef<ReactPlayer>(null);

  // states
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isVideoError, setIsVideoError] = useState<boolean>(false);
  const [isResumeStreamConfirmation, setIsResumeStreamConfirmation] = useState<boolean>(false);
  const [isReady, setIsReady] = useState<boolean>(false);
  const [playTime, setPlayTime] = useState<number>(() => {
    const savedPlayTime = localStorage.getItem('playTime');
    return savedPlayTime ? parseInt(savedPlayTime, 10) : 0;
  });

  // variables
  const isHomePage = pathname === '/';
  const isPlayPage = pathname?.includes('play');
  const playerInstance = playerRef.current?.getInternalPlayer();
  const resumeSeconds = sessionStorage.getItem(`progress-${streamId}`);
  const savedTimestampSeconds = resumeSeconds ? parseFloat(resumeSeconds) : 0;

  const dailyLimit = 10;
  const coins = 0;
  const isCoinUpdateEnabled = false;
  console.log('playTime', playTime);

  // functions
  const handlePlay = () => {
    setIsPlaying(true);
    if (playerInstance) {
      playerInstance.play();
    }
  };

  const handlePause = () => {
    setIsPlaying(false);
    if (playerInstance) {
      playerInstance.pause();
    }
  };

  const onReady = useCallback(() => {
    if (!isReady) {
      if (playerRef?.current) {
        playerRef?.current?.seekTo(savedTimestampSeconds, 'seconds');
      }
      setIsReady(true);
    }
  }, [isReady]);

  const videoErrorMessage = () => {
    let msg = '';
    if (!isHomePage && !isLoggedIn) msg = 'Please Login to Watch the Stream';
    else msg = 'The Capybara streams is not available';
    return msg;
  };

  const handleTimeUpdate = () => {
    if (isLoggedIn && playerInstance && isPlaying && !isHomePage && !isPlayPage) {
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

  // effects
  useEffect(() => {
    const canPlay = ReactPlayer.canPlay(videoUrl);
    if (canPlay) {
      setIsVideoError(false);
    } else {
      setIsVideoError(true);
    }
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isPlaying && playerInstance && !isHomePage && isLoggedIn) {
        handlePause();
        setIsResumeStreamConfirmation(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isPlaying, playerInstance, isHomePage, isLoggedIn]);

  return (
    <div className={styles.videoWrapper}>
      <div className={styles.playerWrapper}>
        {!isVideoError && (isHomePage || (!isHomePage && isLoggedIn)) ? (
          <ReactPlayer
            width="100%"
            height="100%"
            ref={playerRef}
            url={videoUrl}
            playing={isPlaying}
            loop
            volume={0}
            muted
            controls={false} // Disable default controls
            className={styles.reactPlayer}
            onError={() => {
              setIsVideoError(true);
            }}
            onProgress={(progress) => {
              handleTimeUpdate();
              sessionStorage.setItem(`progress-${streamId}`, JSON.stringify(progress?.playedSeconds));
              setIsVideoError(false);
            }}
            onReady={onReady}
          />
        ) : (
          <VideoFrameWithErrorMessage message={videoErrorMessage()} />
        )}
      </div>

      {/* Display play button only when the video is paused */}
      {playerInstance && !isPlaying && !isVideoError && !isHomePage && (
        <button className={styles.customControl}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="white">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
      )}

      {/* Resume Modal */}
      {isResumeStreamConfirmation ? (
        <PauseStreamPopup
          isOpen={isResumeStreamConfirmation}
          setIsOpen={setIsResumeStreamConfirmation}
          handlePlay={handlePlay}
        />
      ) : null}
    </div>
  );
};

export default VideoPlayer;

export const VideoFrameWithErrorMessage = ({ message }: { message: string }) => {
  return (
    <div style={{ position: 'relative' }}>
      <img src={vidFrame} alt="frame" style={{ background: 'black' }} />
      <span
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: 'white',
          padding: '20px',
          borderRadius: '8px',
          textAlign: 'center',
          fontFamily: 'Mulish, sans-serif',
          fontSize: '20px',
          width: '100%',
        }}
      >
        {message}
      </span>
    </div>
  );
};
