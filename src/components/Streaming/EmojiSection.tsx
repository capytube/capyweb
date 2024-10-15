import React from "react";
import { useAccount } from "wagmi";

interface EmojiSectionProps {
  streamId: string;
  emojis: string[];
  emojiCounts: { [emoji: string]: number };
  onEmojiClick: (streamId: string, emoji: string) => void;
}

const EmojiSection: React.FC<EmojiSectionProps> = ({
  streamId,
  emojis,
  emojiCounts,
  onEmojiClick,
}) => {
  const { address } = useAccount();
  console.log(address);
  return (
    <div style={styles.emojiContainer}>
      {emojis.map((emoji, index) => (
        <button
          key={index}
          style={styles.emojiButton}
          onClick={() => onEmojiClick(streamId, emoji)}
        >
          <span>{emoji}</span>
          <span style={styles.emojiCount}>{emojiCounts[emoji] || 0}</span>
        </button>
      ))}
    </div>
  );
};

const styles = {
  emojiContainer: {
    display: "flex",
    gap: "10px",
    marginBottom: "10px",
  },
  emojiButton: {
    background: "none",
    border: "none",
    fontSize: "24px", // Keep the emoji size large
    cursor: "pointer",
    color: "#000", // Adjust color if needed
    display: "flex",
    alignItems: "center",
  },
  emojiCount: {
    fontSize: "16px", // Smaller size for the counter
    marginLeft: "5px", // Add some space between the emoji and the count
  },
};

export default EmojiSection;
