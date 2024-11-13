import { useState } from "react";
import styles from "./EmojiRating.module.css";
import capyangry from "../../../../assets/capyangry.svg";
import capyfire from "../../../../assets/capyfire.svg";
import capylike from "../../../../assets/capylike.svg";
import capylove from "../../../../assets/capylove.svg";
import capywow from "../../../../assets/capywow.svg";

interface EmojiRatingProps {
  streamId: string;
}

const emojis = [
  { name: "capylove", icon: capylove },
  { name: "capylike", icon: capylike },
  { name: "capywow", icon: capywow },
  { name: "capyangry", icon: capyangry },
  { name: "capyfire", icon: capyfire },
];

const EmojiRating = ({ streamId }: EmojiRatingProps) => {
  const [emojiCounts, setEmojiCounts] = useState<{
    [streamId: string]: { [emojiName: string]: number };
  }>({ [streamId]: {} });

  const handleEmojiClick = (streamId: string, emojiName: string) => {
    setEmojiCounts((prevCounts) => ({
      ...prevCounts,
      [streamId]: {
        ...prevCounts[streamId],
        [emojiName]: (prevCounts[streamId]?.[emojiName] || 0) + 1,
      },
    }));
  };

  return (
    <div className={styles.emojiRatingWrapper}>
      {emojis.map((emoji) => (
        <button
          key={emoji.name}
          className={styles.emojiRatingButton}
          onClick={() => handleEmojiClick(streamId, emoji.name)}
        >
          <img src={emoji.icon} alt={emoji.name} className={styles.emojiIcon} />
          <span className={styles.emojiCount}>
            {emojiCounts[streamId][emoji.name] || 0}
          </span>
        </button>
      ))}
    </div>
  );
};

export default EmojiRating;
