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
      {/* Stream Info Section */}
      <div style={styles.streamInfo}>
        <img src={mainLogo} alt="Logo" style={styles.logo} />
        <h1 style={styles.streamName}>{streamTitle}</h1>
      </div>

      {/* Main content wrapper for stream, emojis, and comments */}
      <div style={styles.contentWrapper}>
        {/* Live Stream Component */}
        <div style={styles.liveStreamWrapper}>
          <LiveStream
            streamId={streamId || ""}
            title={streamTitle || `Stream ${streamId}`}
            profilePic={mainLogo}
          />
        </div>

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
    flexDirection: "column" as const, // Ensure proper typing for flexDirection
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
    backgroundColor: "#000",
    position: "relative" as const, // Cast position to the correct type
    padding: "20px",
  },
  streamInfo: {
    display: "flex",
    flexDirection: "row" as const, // Ensure proper typing for flexDirection
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
    maxWidth: "800px", // Ensures the content does not exceed this width
    padding: "10px",
    backgroundColor: "#fff",
    borderRadius: "10px",
    boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
    display: "flex",
    flexDirection: "column" as const, // Cast flexDirection to proper type
    gap: "20px", // Adding some space between the sections
  },
  liveStreamWrapper: {
    display: "flex",
    justifyContent: "center",
    marginBottom: "10px",
  },
  backButton: {
    position: "absolute" as const, // Cast position to proper type
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
