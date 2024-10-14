import React, { useState } from "react";
import LiveStream from "./LiveStream";
import magnuspic from "../../assets/filled-magnus.svg";

interface StreamingHomeProps {
  title: string;
}

const StreamingHome: React.FC<StreamingHomeProps> = ({ title }) => {
  const [zoomedStreamId, setZoomedStreamId] = useState<string | null>(null);
  const [comments, setComments] = useState<{ [key: string]: string[] }>({});
  const [newComment, setNewComment] = useState<string>("");
  const [emojiCounts, setEmojiCounts] = useState<{
    [key: string]: { [emoji: string]: number };
  }>({});

  const emojis = ["👍", "❤️", "😂", "👏", "🔥"];

  // Handle adding comments
  const handleAddComment = (streamId: string) => {
    if (!newComment) return;
    setComments((prevComments) => ({
      ...prevComments,
      [streamId]: [...(prevComments[streamId] || []), newComment],
    }));
    setNewComment(""); // Clear the input
  };

  // Handle zooming into the stream
  const handleZoom = (streamId: string) => {
    setZoomedStreamId(streamId === zoomedStreamId ? null : streamId);
  };

  // Handle emoji click and increment the count
  const handleEmojiClick = (streamId: string, emoji: string) => {
    setEmojiCounts((prevCounts) => ({
      ...prevCounts,
      [streamId]: {
        ...prevCounts[streamId],
        [emoji]: (prevCounts[streamId]?.[emoji] || 0) + 1,
      },
    }));
  };

  const renderStream = (
    streamId: string,
    title: string,
    profilePic: string
  ) => (
    <div
      style={{
        ...styles.gridItem,
        ...(zoomedStreamId === streamId ? styles.zoomedItem : {}),
      }}
      onClick={() => handleZoom(streamId)}
    >
      <LiveStream streamId={streamId} title={title} profilePic={profilePic} />
      {zoomedStreamId === streamId && (
        <div
          style={styles.commentSection as React.CSSProperties}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Emoji Reactions */}
          <div style={styles.emojiContainer as React.CSSProperties}>
            {emojis.map((emoji, index) => (
              <button
                key={index}
                style={styles.emojiButton as React.CSSProperties}
                onClick={() => handleEmojiClick(streamId, emoji)}
              >
                {emoji} {emojiCounts[streamId]?.[emoji] || 0}
              </button>
            ))}
          </div>

          {/* Comment Section */}
          <div>
            <h4 style={{ fontWeight: "bold" }}>Comments</h4>
            <div style={styles.commentsList as React.CSSProperties}>
              {(comments[streamId] || []).map((comment, index) => (
                <p key={index}>{comment}</p>
              ))}
            </div>
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment"
              style={styles.commentInput as React.CSSProperties}
            />
            <button
              onClick={() => handleAddComment(streamId)}
              style={styles.addButton as React.CSSProperties}
            >
              Add Comment
            </button>
          </div>
        </div>
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
    gridTemplateColumns: "repeat(2, 1fr)", // Define how many columns you want
    gap: "10px", // Gap between grid items
    padding: "10px",
  },
  gridItem: {
    backgroundColor: "#585d65",
    padding: "10px",
    borderRadius: "10px",
    boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
    cursor: "pointer", // Make it clear that it's clickable
  },
  zoomedItem: {
    gridColumn: "span 2", // Make the zoomed stream take full width
    gridRow: "span 2", // Make it expand height
    position: "relative" as React.CSSProperties["position"], // Fix TypeScript error
  },
  commentSection: {
    marginTop: "10px",
    backgroundColor: "#f4f4f4",
    padding: "10px",
    borderRadius: "8px",
    color: "black",
  },
  emojiContainer: {
    display: "flex",
    gap: "10px",
    marginBottom: "10px",
  },
  emojiButton: {
    background: "none",
    border: "none",
    fontSize: "24px",
    cursor: "pointer",
  },
  commentsList: {
    marginBottom: "10px",
    maxHeight: "100px",
    overflowY: "auto", // Scroll when there are many comments
  },
  commentInput: {
    width: "100%",
    padding: "8px",
    marginBottom: "10px",
    borderRadius: "4px",
    border: "1px solid #ccc",
    color: "black",
  },
  addButton: {
    backgroundColor: "#007bff",
    color: "white",
    padding: "5px 10px",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
  },
};

export default StreamingHome;
