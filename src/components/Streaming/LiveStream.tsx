// src/components/LiveStream.tsx
import {
  EnterFullscreenIcon,
  ExitFullscreenIcon,
} from "@livepeer/react/assets";
import { Src } from "@livepeer/react";
import * as Player from "@livepeer/react/player";
import "./LiveStream.css"; // Optional: Create this file for component-specific styles
import { useState, useEffect } from "react";
import { generateClient } from "aws-amplify/api";
import type { Schema } from "../../../amplify/data/resource"; // Assuming your schema is defined in a separate file

interface LiveStreamProps {
  streamId: string;
  title: string;
  profilePic: string;
}

const LiveStream: React.FC<LiveStreamProps> = ({
  streamId,
  title,
  profilePic,
}) => {
  const [vodSource, setVodSource] = useState<Src[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  console.log(
    "streamId in livepeer is :",
    streamId,
    "title is :",
    title,
    "profilePic is :",
    profilePic
  );

  // Fetch the source for the playback ID on component mount
  useEffect(() => {
    const fetchSource = async () => {
      try {
        console.log("input streamId in livepeer is :", streamId);
        const client = generateClient<Schema>();
        const srcString = (
          await client.queries.getStream({ streamId: streamId })
        ).data!;
        console.log("src string from server is", srcString);
        const source = JSON.parse(srcString) as Src[];
        setVodSource(source);
      } catch (err) {
        setError("Failed to load the stream. Please try again later.");
        console.error(err); // Log error for debugging
      }
    };

    fetchSource();
  }, [streamId]);

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  // Show loading message until the source is fetched
  if (!vodSource) {
    return <div>Loading stream...</div>;
  }
  return (
    <Player.Root src={vodSource} autoPlay volume={0}>
      <Player.Container>
        <Player.Video
          title="Agent 327"
          style={{ height: "100%", width: "100%" }}
        />
        <Player.FullscreenTrigger
          style={{
            position: "absolute",
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
      </Player.Container>
    </Player.Root>
  );
};

export default LiveStream;
