import { useEffect, useState } from 'react';
import { useIsLoggedIn } from '@dynamic-labs/sdk-react-core';
import styles from './EmojiRating.module.css';
import capyangry from '../../../../assets/capyangry.svg';
import capyfire from '../../../../assets/capyfire.svg';
import capylike from '../../../../assets/capylike.svg';
import capylove from '../../../../assets/capylove.svg';
import capywow from '../../../../assets/capywow.svg';
import { LivestreamAtomType } from '../../../../store/atoms/livestreamAtom';
import { getLivestreamByID, listPrivateLivestreams, updateStreamWithRatings } from '../../../../api/livestream';
import { capitalizeWords } from '../../../../utils/function';

interface EmojiRatingProps {
  currentStreamData: LivestreamAtomType | null;
  setCurrentStreamData: React.Dispatch<React.SetStateAction<LivestreamAtomType | null>>;
}

const emojis = [
  { name: 'capylove', icon: capylove },
  { name: 'capylike', icon: capylike },
  { name: 'capywow', icon: capywow },
  { name: 'capyangry', icon: capyangry },
  { name: 'capyfire', icon: capyfire },
];

const EmojiRating = ({ currentStreamData, setCurrentStreamData }: EmojiRatingProps) => {
  const isLoggedIn = useIsLoggedIn();
  const streamId = currentStreamData?.id ?? '';

  const [emojiCounts, setEmojiCounts] = useState<{
    [streamId: string]: { [emojiName: string]: number };
  }>(() => {
    const ratings = localStorage.getItem('ratings');
    return ratings ? JSON.parse(ratings) : { [streamId]: {} };
  });

  const handleEmojiClick = async (streamId: string, emojiName: string) => {
    if (!isLoggedIn) return;

    await updateStreamWithRatings({
      streamId,
      ratingCounts: {
        ...currentStreamData?.ratingCounts,
        // @ts-ignore
        [emojiName]: currentStreamData?.ratingCounts?.[emojiName] + 1,
      },
    }).then(async () => {
      const updatedStreamData = await getLivestreamByID(streamId);
      if (updatedStreamData?.data?.id) {
        setCurrentStreamData(updatedStreamData?.data); // this updates the current tab stream local component state
        await listPrivateLivestreams(); // this updates all the streams to latest in global jotai state
      }
    });

    setEmojiCounts((prevCounts) => ({
      ...prevCounts,
      [streamId]: {
        ...prevCounts[streamId],
        [emojiName]: (prevCounts[streamId]?.[emojiName] || 0) + 1,
      },
    }));
  };

  useEffect(() => {
    const loadRatingsOnce = async () => {
      const ratingsData = currentStreamData?.ratingCounts;

      if (!ratingsData) {
        await updateStreamWithRatings({
          streamId: streamId,
          ratingCounts: {
            capylove: 0,
            capylike: 0,
            capywow: 0,
            capyangry: 0,
            capyfire: 0,
          },
        });
      }
    };

    if (isLoggedIn && streamId) {
      loadRatingsOnce();
    }
  }, [streamId]);

  // keeping track in storage, so that apply limit on ratings on one login session
  useEffect(() => {
    localStorage.setItem('ratings', JSON.stringify(emojiCounts));
  }, [emojiCounts]);

  return (
    <div className={styles.emojiRatingWrapper}>
      {emojis.map((emoji) => (
        <button
          title={capitalizeWords(emoji?.name?.replace('capy', ''))}
          key={emoji.name}
          className={`${styles.emojiRatingButton} disabled:cursor-not-allowed`}
          onClick={() => handleEmojiClick(streamId, emoji.name)}
          disabled={!isLoggedIn || emojiCounts?.[streamId]?.[emoji.name] >= 1}
        >
          <img src={emoji.icon} alt={emoji.name} className={styles.emojiIcon} />
          <span className={styles.emojiCount}>
            {/* @ts-ignore */}
            {(isLoggedIn ? currentStreamData?.ratingCounts?.[emoji?.name] : 0) ?? 0}
          </span>
        </button>
      ))}
    </div>
  );
};

export default EmojiRating;
