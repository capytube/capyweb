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
  const {address} = useAccount()
  console.log(address)
  return (
    <div style={styles.emojiContainer}>
      {emojis.map((emoji, index) => (
        <button
          key={index}
          style={styles.emojiButton}
          onClick={() => onEmojiClick(streamId, emoji)}
        >
          {emoji} {emojiCounts[emoji] || 0}
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
    fontSize: "24px",
    cursor: "pointer",
  },
};

export default EmojiSection;
