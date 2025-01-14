import React, { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { Src } from '@livepeer/react';
import { useLocation } from 'react-router-dom';

import { Schema } from '../../amplify/data/resource';
import { generateClient } from 'aws-amplify/api';
import LiveStream from './Streaming/LiveStream';
import PauseStreamPopup from './Watch/WatchRoom/PauseStreamPopup/PauseStreamPopup';

import vidFrame from '../assets/vidFrame.svg';

interface LivepeerPlayerProps {
  streamId: string;
  title: string;
  setIsCapyCoinIncrementing?: React.Dispatch<React.SetStateAction<boolean>>;
  setIsVideoPlaying?: React.Dispatch<React.SetStateAction<boolean>>;
}

const LivepeerPlayer: React.FC<LivepeerPlayerProps> = ({
  streamId,
  title,
  setIsCapyCoinIncrementing,
  setIsVideoPlaying,
}) => {
  const { pathname } = useLocation();
  const isHomePage = pathname === '/';
  const { address, isConnected } = useAccount();
  const [vodSource, setVodSource] = useState<Src[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [viewerId, setViewerId] = useState('');
  const videoRef = React.useRef<any>(null);

  const [isResumeStreamConfirmation, setIsResumeStreamConfirmation] = useState<boolean>(false);

  const videoErrorMessage = () => {
    let msg = '';
    if (isLoading) msg = 'Loading stream...';
    else if (!isHomePage && !isConnected) msg = 'Please Login to Watch the Stream';
    else if (error) msg = error;

    return msg;
  };

  useEffect(() => {
    if (isConnected && address) {
      setViewerId(address);
    }
  }, [isConnected, address]);

  // useEffect(() => {
  //   if (isConnected && address) {
  //     const fetchData = async () => {
  //       const client = generateClient<Schema>();
  //       const response = (await client.queries.getViewership({ streamId }))
  //         .data!;

  //       console.log(
  //         "==========metrics",
  //         JSON.parse(String(response))?.data?.[0]
  //       );
  //     };

  //     fetchData();
  //   }
  // }, [isConnected, address, streamId]);

  useEffect(() => {
    const fetchSource = async () => {
      try {
        setIsLoading(true);
        const client = generateClient<Schema>();
        const getStreamRequest = await client.queries.getStream({ streamId });
        if (getStreamRequest?.data) {
          setIsLoading(false);
          const srcString = getStreamRequest.data;
          const source = JSON.parse(srcString) as Src[];
          setVodSource(source);
        } else {
          setIsLoading(false);
          setError('The Capybara streams isn´t available');
        }
      } catch (err) {
        setIsLoading(false);
        setError('Failed to load the stream. Please try again later.');
        console.error(err);
      }
    };

    fetchSource();
  }, [streamId]);

  useEffect(() => {
    const validatingVodSource = async () => {
      if (vodSource && vodSource?.length > 0) {
        const link = vodSource?.filter((vod) => vod?.type === 'webrtc' || vod?.type === 'video');
        const src = link?.[0]?.src;
        const response = await fetch(src);
        if (response?.status === 200) {
          setError(null);
        } else {
          setError('The Capybara streams isn´t available');
        }
      }
    };

    validatingVodSource();
  }, [vodSource]);

  return (
    <div>
      {(isHomePage || isConnected) && vodSource && !error ? (
        <LiveStream
          vodSource={vodSource}
          title={title}
          viewerId={viewerId}
          videoRef={videoRef}
          setIsCapyCoinIncrementing={setIsCapyCoinIncrementing}
          setIsResumeStreamConfirmation={setIsResumeStreamConfirmation}
          setIsVideoPlaying={setIsVideoPlaying}
        />
      ) : (
        <VideoFrameWithErrorMessage message={videoErrorMessage()} />
      )}

      {isResumeStreamConfirmation ? (
        <PauseStreamPopup
          isOpen={isResumeStreamConfirmation}
          setIsOpen={setIsResumeStreamConfirmation}
          videoRef={videoRef}
        />
      ) : null}
    </div>
  );
};

export default LivepeerPlayer;

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
