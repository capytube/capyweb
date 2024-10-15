import React, { useState } from "react";
import { useParams } from "react-router-dom";
import LiveStream from "./LiveStream";
import CommentSection from "./CommentSection";
import EmojiSection from "./EmojiSection";
import mainLogo from "../../assets/main-logo.svg";

const FullScreenStream: React.FC = () => {
  const { streamId, streamTitle } = useParams<{
    streamId: string;
    streamTitle: string;
  }>();

  // State for comments and emojis
  const [comments, setComments] = useState<string[]>([]);
  const [emojiCounts, setEmojiCounts] = useState<{ [emoji: string]: number }>(
    {}
  );

  const emojis = ["👍", "❤️", "😂", "👏", "🔥"];

  // Handle adding a comment
  const handleAddComment = (streamId: string, comment: string) => {
    setComments((prevComments) => [...prevComments, comment]);
  };

  // Handle emoji click
  const handleEmojiClick = (streamId: string, emoji: string) => {
    setEmojiCounts((prevCounts) => ({
      ...prevCounts,
      [emoji]: (prevCounts[emoji] || 0) + 1,
    }));
  };

  return (
    <div style={styles.container}>
      {/* Stream Info Section */}
      <div style={styles.streamInfo}>
        <img src={mainLogo} alt="Logo" style={styles.logo} />
        <h1 style={styles.streamName}>{streamTitle}</h1>
      </div>

      {/* Main content wrapper for stream, emojis, and comments */}
      <div style={styles.contentWrapper}>
        {/* Live Stream Component */}
        <LiveStream
          streamId={streamId || ""}
          title={streamTitle || `Stream ${streamId}`}
          profilePic={mainLogo}
        />

        {/* Emoji Section */}
        <EmojiSection
          streamId={streamId || ""}
          emojis={emojis}
          emojiCounts={emojiCounts}
          onEmojiClick={handleEmojiClick}
        />

        {/* Comment Section */}
        <CommentSection
          streamId={streamId || ""}
          comments={comments}
          onAddComment={handleAddComment}
        />
      </div>

      {/* Back Button */}
      <button style={styles.backButton} onClick={() => window.history.back()}>
        Back
      </button>
    </div>
  );
};

const styles = {
  container: {
    display: "flex",
    flexDirection: "column" as "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
    backgroundColor: "#000",
    position: "relative",
    padding: "20px",
  },
  streamInfo: {
    display: "flex",
    flexDirection: "row" as "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "20px",
  },
  logo: {
    height: "50px",
    marginRight: "15px",
  },
  streamName: {
    color: "white",
    fontSize: "24px",
    fontWeight: "bold",
  },
  contentWrapper: {
    width: "100%",
    maxWidth: "800px", // Ensure the stream, emoji, and comment sections have a fixed max width
    backgroundColor: "#fff", // Optional: background color for the content
    padding: "10px",
    borderRadius: "10px",
    boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
  },
  backButton: {
    position: "absolute",
    top: "10px",
    left: "10px",
    backgroundColor: "#ff5733",
    color: "white",
    padding: "10px",
    borderRadius: "5px",
    border: "none",
    cursor: "pointer",
  },
};

export default FullScreenStream;
