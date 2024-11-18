import { useEffect, useState } from "react";
import { useIsLoggedIn } from "@dynamic-labs/sdk-react-core";
import { useAtom } from "jotai";
import styles from "./EmojiRating.module.css";
import capyangry from "../../../../assets/capyangry.svg";
import capyfire from "../../../../assets/capyfire.svg";
import capylike from "../../../../assets/capylike.svg";
import capylove from "../../../../assets/capylove.svg";
import capywow from "../../../../assets/capywow.svg";
import { getRatings, updateRatings } from "../../../../utils/api";
import { ratingsAtom } from "../../../../atoms/atom";

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
  const isLoggedIn = useIsLoggedIn();

  const [savedRatings] = useAtom(ratingsAtom);

  const [emojiCounts, setEmojiCounts] = useState<{
    [streamId: string]: { [emojiName: string]: number };
  }>(() => {
    const ratings = localStorage.getItem("ratings");
    return ratings ? JSON.parse(ratings) : { [streamId]: {} };
  });

  const handleEmojiClick = async (streamId: string, emojiName: string) => {
    if (!isLoggedIn) return;

    await updateRatings(streamId, {
      ...savedRatings.ratingCounts,
      // @ts-ignore
      [emojiName]: savedRatings?.ratingCounts?.[emojiName] + 1,
    });

    setEmojiCounts((prevCounts) => ({
      [streamId]: {
        ...prevCounts[streamId],
        [emojiName]: (prevCounts[streamId]?.[emojiName] || 0) + 1,
      },
    }));
  };

  useEffect(() => {
    const fetchRatingsOnce = async () => {
      await getRatings(streamId);
    };

    if (isLoggedIn && streamId) {
      fetchRatingsOnce();
    }
  }, []);

  // keeping track in storage, so that apply limit on ratings on one login session
  useEffect(() => {
    localStorage.setItem("ratings", JSON.stringify(emojiCounts));
  }, [emojiCounts]);

  return (
    <div className={styles.emojiRatingWrapper}>
      {emojis.map((emoji) => (
        <button
          key={emoji.name}
          className={`${styles.emojiRatingButton} disabled:cursor-not-allowed`}
          onClick={() => handleEmojiClick(streamId, emoji.name)}
          disabled={
            /* @ts-ignore */
            !isLoggedIn || emojiCounts[streamId][emoji.name] >= 1
          }
        >
          <img src={emoji.icon} alt={emoji.name} className={styles.emojiIcon} />
          <span className={styles.emojiCount}>
            {/* @ts-ignore */}
            {(isLoggedIn ? savedRatings?.ratingCounts?.[emoji?.name] : 0) ?? 0}
          </span>
        </button>
      ))}
    </div>
  );
};

export default EmojiRating;
