import React, { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { Src } from "@livepeer/react";
import { useLocation } from "react-router-dom";

import { Schema } from "../../amplify/data/resource";
import { generateClient } from "aws-amplify/api";
import LiveStream from "./Streaming/LiveStream";
import PauseStreamPopup from "./Watch/WatchRoom/PauseStreamPopup/PauseStreamPopup";

import vidFrame from "../assets/vidFrame.svg";

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
  const isHomePage = pathname === "/";
  const { address, isConnected } = useAccount();
  const [vodSource, setVodSource] = useState<Src[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewerId, setViewerId] = useState("");
  const videoRef = React.useRef<any>(null);

  const [isResumeStreamConfirmation, setIsResumeStreamConfirmation] =
    useState<boolean>(false);

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
        const client = generateClient<Schema>();
        const srcString = (await client.queries.getStream({ streamId })).data!;
        const source = JSON.parse(srcString) as Src[];
        setVodSource(source);
      } catch (err) {
        setError("Failed to load the stream. Please try again later.");
        console.error(err);
      }
    };

    fetchSource();
  }, [streamId]);

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  // Show loading message until the source is fetched
  if (!vodSource) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        Loading stream...
      </div>
    );
  }

  return (
    <div>
      {isHomePage || isConnected ? (
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
        <div style={{ position: "relative" }}>
          <img src={vidFrame} alt="frame" style={{ background: "black" }} />
          <span
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              color: "white",
              padding: "20px",
              borderRadius: "8px",
              textAlign: "center",
              fontFamily: "Mulish, sans-serif",
              fontSize: "20px",
              width: "100%",
            }}
          >
            Please Login to Watch the Stream
          </span>
        </div>
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
