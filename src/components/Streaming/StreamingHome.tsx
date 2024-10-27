import React, { useState } from "react";
import { useNavigate } from "react-router-dom"; // Import useNavigate from react-router-dom
import magnuspic from "../../assets/filled-magnus.svg";
import Stream from "./Stream";

const StreamingHome: React.FC = () => {
  const [comments, setComments] = useState<{ [key: string]: string[] }>({});
  const [emojiCounts, setEmojiCounts] = useState<{
    [key: string]: { [emoji: string]: number };
  }>({});

  const emojis = ["👍", "❤️", "😂", "👏", "🔥"];
  const navigate = useNavigate(); // Hook to navigate between routes

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

  // Navigate to full-screen view when the video is clicked
  const openStreamInFullScreen = (
    streamId: string,
    title: string,
    e: React.MouseEvent
  ) => {
    // Check if the clicked target is the video container itself
    const clickedElement = e.target as HTMLElement;
    if (clickedElement.closest(".video-container")) {
      navigate(`/stream/${streamId}/${title}`);
    }
  };

  const renderStream = (
    streamId: string,
    title: string,
    profilePic: string
  ) => (
    <div
      style={{
        ...styles.gridItem,
        backgroundColor: "#FFFCC8", // Set the background color here
      }}
      onClick={(e) => openStreamInFullScreen(streamId, title, e)}
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
    </div>
  );

  return (
    <div style={styles.gridContainer}>
      {renderStream("fa7ahoikpf19u1e0", "magstream1", magnuspic)}
      {renderStream("3ad581cgj5ahdc7z", "magstream3", magnuspic)}
    </div>
  );
};

const styles = {
  gridContainer: {
    display: "grid",
    gridTemplateColumns: "repeat(1, 1fr)",
    gap: "10px",
    padding: "10px",
    background: "#FFFCC8", // Set the overall background color
  } as React.CSSProperties,
  gridItem: {
    padding: "10px",
    borderRadius: "10px",
    // boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)", // This line is removed
    cursor: "pointer",
    position: "relative",
  } as React.CSSProperties,
};

export default StreamingHome;
