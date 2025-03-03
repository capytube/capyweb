import React, { useEffect, useState } from 'react';
import { Src } from '@livepeer/react';
import { useLocation } from 'react-router-dom';
import { useDynamicContext, useIsLoggedIn } from '@dynamic-labs/sdk-react-core';

import { Schema } from '../../amplify/data/resource';
import { generateClient } from 'aws-amplify/api';
import LiveStream from './Streaming/LiveStream';

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
  const isLoggedIn = useIsLoggedIn();
  const { primaryWallet } = useDynamicContext();
  const walletAddress = primaryWallet?.address;
  const { pathname } = useLocation();
  const isHomePage = pathname === '/';
  const [vodSource, setVodSource] = useState<Src[] | null>(null);
  const [, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [viewerId, setViewerId] = useState('');
  const videoRef = React.useRef<any>(null);

  useEffect(() => {
    if (isLoggedIn && walletAddress) {
      setViewerId(walletAddress);
    }
  }, [isLoggedIn, walletAddress]);

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
      {(isHomePage || isLoggedIn) && vodSource && !error ? (
        <LiveStream
          vodSource={vodSource}
          title={title}
          viewerId={viewerId}
          videoRef={videoRef}
          setIsCapyCoinIncrementing={setIsCapyCoinIncrementing}
          // setIsResumeStreamConfirmation={setIsResumeStreamConfirmation}
          setIsVideoPlaying={setIsVideoPlaying}
        />
      ) : null}
    </div>
  );
};

export default LivepeerPlayer;
