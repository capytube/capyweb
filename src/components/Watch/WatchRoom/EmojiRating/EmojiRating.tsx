import styles from "./EmojiRating.module.css";
import capyangry from "../../../../assets/capyangry.svg";
import capyfire from "../../../../assets/capyfire.svg";
import capylike from "../../../../assets/capylike.svg";
import capylove from "../../../../assets/capylove.svg";
import capywow from "../../../../assets/capywow.svg";

const EmojiRating = () => {
  const emojis = [
    { name: "capyangry", icon: capyangry },
    { name: "capyfire", icon: capyfire },
    { name: "capylike", icon: capylike },
    { name: "capylove", icon: capylove },
    { name: "capywow", icon: capywow },
  ];

  return (
    <div className={styles.emojiRatingWrapper}>
      {emojis.map((emoji) => (
        <button key={emoji.name} className={styles.emojiRatingButton}>
          <img src={emoji.icon} alt={emoji.name} className={styles.emojiIcon} />
          <span className={styles.emojiCount}>0</span>
        </button>
      ))}
    </div>
  );
};

export default EmojiRating;
