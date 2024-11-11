import React, { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { Src } from "@livepeer/react";
import { generateClient } from "aws-amplify/api";
import LiveStream from "./Streaming/LiveStream";
import { Schema } from "../../amplify/data/resource";
import vidFrame from "../assets/vidFrame.svg";
// import { getViewershipData } from "../utils/livepeerService";

interface LivepeerPlayerProps {
  streamId: string;
  title: string;
}

const LivepeerPlayer: React.FC<LivepeerPlayerProps> = ({ streamId, title }) => {
  const { address, isConnected } = useAccount();
  const [vodSource, setVodSource] = useState<Src[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewerId, setViewerId] = useState("");

  // const [watchTime, setWatchTime] = useState(0); // in minutes
  // const [earnedCoins, setEarnedCoins] = useState(0);
  // const [viewCount, setViewCount] = useState(0);

  // // Fetch viewership data when connected and streamId or address changes
  // useEffect(() => {
  //   if (isConnected && address) {
  //     const fetchData = async () => {
  //       const metrics = await getViewershipData(streamId);

  //       console.log("==========metrics", metrics);
  //       if (metrics) {
  //         const playbackData = metrics.find(
  //           (metric) => metric.viewerId === address
  //         );
  //         if (playbackData) {
  //           setWatchTime(playbackData.playtimeMins);
  //           setViewCount(playbackData.viewCount);

  //           // Calculate earned coins based on watch time, up to daily limit
  //           const calculatedCoins = Math.min(
  //             playbackData.playtimeMins,
  //             dailyCoinLimit
  //           );
  //           setEarnedCoins(calculatedCoins);
  //         }
  //       }
  //     };

  //     fetchData();
  //   }
  // }, [isConnected, address, streamId]);

  //   // Handle CapyCoin collection
  //   const handleCollectCoins = () => {
  //     if (earnedCoins >= dailyCoinLimit) {
  //       // Trigger smart contract function to update CapyCoin balance in wallet
  //       // (e.g., using a Wagmi contract write function)
  //       console.log("Collecting CapyCoins...");
  //       // Reset daily cap to simulate a new day or reset after collection
  //       setEarnedCoins(0);
  //     }
  //   };

  useEffect(() => {
    if (isConnected && address) {
      setViewerId(address);
    }
  }, [isConnected, address]);

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
      {isConnected ? (
        <LiveStream vodSource={vodSource} title={title} viewerId={viewerId} />
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
    </div>
  );
};

export default LivepeerPlayer;
