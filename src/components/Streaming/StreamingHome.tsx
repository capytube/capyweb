import React, { useState } from "react";
import magnuspic from "../../assets/filled-magnus.svg";
import Stream from "./Stream";

interface StreamingHomeProps {
  title: string;
}

const StreamingHome: React.FC<StreamingHomeProps> = ({ title }) => {
  const [zoomedStreamId, setZoomedStreamId] = useState<string | null>(null);
  const [comments, setComments] = useState<{ [key: string]: string[] }>({});
  const [emojiCounts, setEmojiCounts] = useState<{
    [key: string]: { [emoji: string]: number };
  }>({});
  console.log(title);

  const emojis = ["👍", "❤️", "😂", "👏", "🔥"];

  // Handle adding comments for individual streams
  const handleAddComment = (streamId: string, comment: string) => {
    setComments((prevComments) => ({
      ...prevComments,
      [streamId]: [...(prevComments[streamId] || []), comment],
    }));
  };

  // Handle emoji click and increment the count for individual streams
  const handleEmojiClick = (streamId: string, emoji: string) => {
    setEmojiCounts((prevCounts) => ({
      ...prevCounts,
      [streamId]: {
        ...prevCounts[streamId],
        [emoji]: (prevCounts[streamId]?.[emoji] || 0) + 1,
      },
    }));
  };

  // Handle zooming into the stream by clicking the stream
  const handleZoom = (streamId: string) => {
    setZoomedStreamId(streamId);
  };

  // Handle zoom out using the back button
  const handleZoomOut = (event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent zoom-in behavior when clicking the back button
    setZoomedStreamId(null);
  };

  const renderStream = (
    streamId: string,
    title: string,
    profilePic: string
  ) => (
    <div
      style={
        {
          ...styles.gridItem,
          ...(zoomedStreamId === streamId ? styles.zoomedItem : {}),
        } as React.CSSProperties
      }
      onClick={() => handleZoom(streamId)} // Clicking the stream zooms in
    >
      <Stream
        streamId={streamId}
        title={title}
        profilePic={profilePic}
        comments={comments[streamId] || []}
        onAddComment={handleAddComment}
        emojis={emojis}
        emojiCounts={emojiCounts[streamId] || {}}
        onEmojiClick={handleEmojiClick}
      />

      {/* Show back button only when zoomed */}
      {zoomedStreamId === streamId && (
        <button onClick={handleZoomOut} style={styles.backButton}>
          Back
        </button>
      )}
    </div>
  );

  return (
    <div style={styles.gridContainer as React.CSSProperties}>
      {renderStream("fa7ahoikpf19u1e0", "magstream1", magnuspic)}
      {renderStream("fa7ahoikpf19u1e0", "magstream2", magnuspic)}
      {renderStream("3ad581cgj5ahdc7z", "magstream3", magnuspic)}
      {renderStream("3ad581cgj5ahdc7z", "magstream4", magnuspic)}
    </div>
  );
};

const styles = {
  gridContainer: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "10px",
    padding: "10px",
  } as React.CSSProperties,
  gridItem: {
    backgroundColor: "#585d65",
    padding: "10px",
    borderRadius: "10px",
    boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
    cursor: "pointer",
    position: "relative",
  } as React.CSSProperties,
  zoomedItem: {
    gridColumn: "span 2",
    gridRow: "span 2",
    position: "relative",
  } as React.CSSProperties,
  backButton: {
    position: "absolute",
    top: "10px",
    left: "10px",
    backgroundColor: "#ff5733",
    color: "white",
    padding: "5px 10px",
    borderRadius: "5px",
    border: "none",
    cursor: "pointer",
  } as React.CSSProperties,
};

export default StreamingHome;
