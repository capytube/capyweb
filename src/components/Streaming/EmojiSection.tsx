import React from "react";
import { useAccount } from "wagmi";
import capyangry from "../../assets/capyangry.svg";
import capyfire from "../../assets/capyfire.svg";
import capylike from "../../assets/capylike.svg";
import capylove from "../../assets/capylove.svg";
import capywow from "../../assets/capywow.svg";

interface EmojiSectionProps {
  streamId: string;
  emojiCounts: { [emoji: string]: number };
  onEmojiClick: (streamId: string, emoji: string) => void;
}

const EmojiSection: React.FC<EmojiSectionProps> = ({
  streamId,
  emojiCounts,
  onEmojiClick,
}) => {
  const { address } = useAccount();
  console.log(address);

  const emojis = [
    { name: "capyangry", icon: capyangry },
    { name: "capyfire", icon: capyfire },
    { name: "capylike", icon: capylike },
    { name: "capylove", icon: capylove },
    { name: "capywow", icon: capywow },
  ];

  return (
    <div style={styles.emojiContainer}>
      {emojis.map((emoji) => (
        <button
          key={emoji.name}
          style={styles.emojiButton}
          onClick={() => onEmojiClick(streamId, emoji.name)}
        >
          <img src={emoji.icon} alt={emoji.name} style={styles.emojiIcon} />
          <span style={styles.emojiCount}>{emojiCounts[emoji.name] || 0}</span>
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
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
  },
  emojiIcon: {
    width: "24px",
    height: "24px",
    marginRight: "4px",
  },
  emojiCount: {
    fontSize: "12px",
  },
};

export default EmojiSection;
