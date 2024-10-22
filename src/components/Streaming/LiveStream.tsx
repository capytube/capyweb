// src/components/LiveStream.tsx
import {
  PauseIcon,
  PlayIcon,
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
    <Player.Root src={vodSource}>
      <Player.Container className="h-full w-full overflow-hidden bg-gray-950">
        <Player.Video title="Live stream" className="h-full w-full" />
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
        {/* <Player.Controls className="flex items-center justify-center">
          <Player.PlayPauseTrigger className="w-10 h-10 hover:scale-105 flex-shrink-0">
            <Player.PlayingIndicator asChild matcher={false}>
              <PlayIcon className="w-full h-full" />
            </Player.PlayingIndicator>
            <Player.PlayingIndicator asChild>
              <PauseIcon className="w-full h-full" />
            </Player.PlayingIndicator>
          </Player.PlayPauseTrigger>
        </Player.Controls> */}
      </Player.Container>
    </Player.Root>
  );
};

export default LiveStream;
