import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import LiveStream from "./LiveStream";
import CommentSection from "./CommentSection";
import EmojiSection from "./EmojiSection";

const FullScreenStream: React.FC = () => {
  const { streamId, streamTitle } = useParams<{
    streamId: string;
    streamTitle: string;
  }>();
  const navigate = useNavigate();

  // State for comments and emojis
  const [comments, setComments] = useState<string[]>([]);
  const [emojiCounts, setEmojiCounts] = useState<{ [emoji: string]: number }>(
    {}
  );

  // Handle adding a comment (removed unused streamId parameter)
  const handleAddComment = (_: string, comment: string) => {
    setComments((prevComments) => [...prevComments, comment]);
  };

  // Handle emoji click (removed unused streamId parameter)
  const handleEmojiClick = (_: string, emoji: string) => {
    setEmojiCounts((prevCounts) => ({
      ...prevCounts,
      [emoji]: (prevCounts[emoji] || 0) + 1,
    }));
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.streamName}>{streamTitle}</h1>
        <button style={styles.backButton} onClick={() => navigate("/")}>
          Back
        </button>
      </div>
      <div style={styles.contentWrapper}>
        <div style={styles.liveStreamWrapper}>
          <LiveStream
            streamId={streamId || ""}
            title={streamTitle || `Stream ${streamId}`}
            profilePic=""
          />
        </div>
        <EmojiSection
          streamId={streamId || ""}
          emojiCounts={emojiCounts}
          onEmojiClick={handleEmojiClick}
        />
        <CommentSection
          streamId={streamId || ""}
          comments={comments}
          onAddComment={handleAddComment}
        />
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    minHeight: "100vh",
    backgroundColor: "#FFFCC8",
    padding: "20px",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: "20px",
  },
  streamName: {
    color: "#7A3F3E",
    fontSize: "24px",
    fontWeight: "bold",
    fontFamily: "'AdLaM Display', sans-serif",
  },
  contentWrapper: {
    width: "100%",
    maxWidth: "800px",
    backgroundColor: "#FFFCC8",
    borderRadius: "10px",
    overflow: "hidden",
  },
  liveStreamWrapper: {
    width: "100%",
    marginBottom: "20px",
  },
  backButton: {
    backgroundColor: "#7A3F3E",
    color: "white",
    padding: "8px 16px", // Reduced padding to make the button smaller
    borderRadius: "5px",
    border: "none",
    cursor: "pointer",
    fontFamily: "'AdLaM Display', sans-serif",
    fontSize: "14px", // Reduced font size
    transform: "rotate(15deg)", // Rotate the button by 15 degrees
    boxShadow: "2px 2px 5px rgba(0, 0, 0, 0.3)", // Add shadow
  },
};

export default FullScreenStream;
