// src/components/LiveStream.tsx
import { PauseIcon, PlayIcon } from "@livepeer/react/assets";
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

  // Fetch the source for the playback ID on component mount
  useEffect(() => {
    const fetchSource = async () => {
      try {
        console.log("input streamId in livepper is :", streamId);
        const client = generateClient<Schema>();
        const srcString = (
          await client.queries.getStream({ streamId: streamId })
        ).data!;
        console.log("src string form server is", srcString);
        const source = JSON.parse(srcString) as Src[];
        // const source = await
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
      <div style={styles.titleAndImageContainer}>
        <h1 style={styles.title}>{title}</h1>
        <img src={profilePic} alt="Profile" style={styles.profilePic} />
      </div>
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

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "20px",
  },
  title: {
    display: "flex",
    fontSize: "24px",
    fontWeight: "bold",
    marginBottom: "10px",
  },
  profilePic: {
    width: "40px",
    height: "40px",
    borderRadius: "50%", // Makes the image circular
  },
  titleAndImageContainer: {
    display: "flex",
    alignItems: "center", // Aligns items vertically in the center
    marginBottom: "5px",
    justifyContent: "space-between", // Pushes the title to the left and image to the right
  },
  streamContainer: {
    width: "100%",
    maxWidth: "800px",
    backgroundColor: "#f0f0f0",
    padding: "10px",
    borderRadius: "10px",
    boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
  },
};
