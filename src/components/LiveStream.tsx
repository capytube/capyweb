// src/components/LiveStream.tsx
import { PauseIcon, PlayIcon } from "@livepeer/react/assets";
import { getSrc } from "@livepeer/react/external";
import { Src } from "@livepeer/react";
import * as Player from "@livepeer/react/player";
import { Livepeer } from "livepeer";
import "./LiveStream.css"; // Optional: Create this file for component-specific styles
import { useState, useEffect } from "react";

interface LiveStreamProps {
  streamId: string;
}

const livepeer = new Livepeer({
  apiKey: import.meta.env.VITE_LIVEPEER_API_KEY!,
});

export async function getSourceForPlaybackId(playbackId: string) {
  const response = await livepeer.playback.get(playbackId);

  // the return value can be passed directly to the Player as `src`
  return getSrc(response.playbackInfo);
}

const LiveStream: React.FC<LiveStreamProps> = ({ streamId }) => {
  const [vodSource, setVodSource] = useState<Src[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch the source for the playback ID on component mount
  useEffect(() => {
    const fetchSource = async () => {
      try {
        const source = await getSourceForPlaybackId(streamId);
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

        <Player.Controls className="flex items-center justify-center">
          <Player.PlayPauseTrigger className="w-10 h-10 hover:scale-105 flex-shrink-0">
            <Player.PlayingIndicator asChild matcher={false}>
              <PlayIcon className="w-full h-full" />
            </Player.PlayingIndicator>
            <Player.PlayingIndicator asChild>
              <PauseIcon className="w-full h-full" />
            </Player.PlayingIndicator>
          </Player.PlayPauseTrigger>
        </Player.Controls>
      </Player.Container>
    </Player.Root>
  );
};

export default LiveStream;
