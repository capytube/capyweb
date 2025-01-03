import { useEffect, useRef, useState } from 'react';
import { useAtomValue } from 'jotai';
import { useIsLoggedIn } from '@dynamic-labs/sdk-react-core';
import { TimeIcon } from '../../../Icons/Icons';
import { userAtom } from '../../../../store/atoms/userAtom';
import { createUsersWatchTimeOnce, getUsersWatchTime, updateUsersWatchTime } from '../../../../api/watchTimeInfo';

interface Props {
  isVideoPlaying: boolean;
}

const UserStreamCounter = ({ isVideoPlaying }: Props) => {
  // hooks
  const isLoggedIn = useIsLoggedIn();
  const userData = useAtomValue(userAtom);
  const userId = userData?.id ?? '';

  // states
  const [elapsedTimeInSeconds, setElapsedTimeInSeconds] = useState<number>(0); // Timer for UI part
  const elapsedTimeRef = useRef<number>(0); // Tracks time only for API updates

  // variables
  const hours = Math.floor(elapsedTimeInSeconds / 3600);
  const minutes = Math.floor((elapsedTimeInSeconds % 3600) / 60);
  const seconds = elapsedTimeInSeconds % 60;

  // effects
  // Fetch the initial elapsed time from the API
  useEffect(() => {
    const fetchInitialTime = async () => {
      if (isLoggedIn && userId) {
        try {
          // fetching watch time from the API first
          const response = await getUsersWatchTime(userId);

          if (response.data?.id) {
            const data = response?.data;
            const initialTimeInSeconds = data?.watchTime ?? 0;

            // Sync local state with API value
            setElapsedTimeInSeconds(initialTimeInSeconds); // UI
            elapsedTimeRef.current = initialTimeInSeconds; // API
          } else {
            // If user doesn't exist in the watchTime table, create an entry
            await createUsersWatchTimeOnce({ userId });
            setElapsedTimeInSeconds(0);
            elapsedTimeRef.current = 0;
          }
        } catch (error) {
          console.error('Failed to fetch watch time from API:', error);
          // Start from 0 if no valid data is available
          setElapsedTimeInSeconds(0);
          elapsedTimeRef.current = 0;
        }
      }
    };

    fetchInitialTime();
  }, [isLoggedIn, userId]);

  // incrementing timer counter state every second
  useEffect(() => {
    if (isLoggedIn && isVideoPlaying && userId) {
      const interval = setInterval(() => {
        // For UI
        setElapsedTimeInSeconds((prevElapsedTime) => prevElapsedTime + 1);
        // For API
        elapsedTimeRef.current += 1;
      }, 1000);

      return () => {
        clearInterval(interval);
      };
    }
  }, [isLoggedIn, isVideoPlaying, userId]);

  // updating the watch time in the backend every 1 minute
  useEffect(() => {
    if (isLoggedIn && isVideoPlaying && userId) {
      const updateServerInterval = setInterval(async () => {
        try {
          await updateUsersWatchTime({
            id: userId,
            watchTime: elapsedTimeRef.current,
            lastUpdated: new Date().getTime(),
          });
        } catch (error) {
          console.error('Failed to update watch time:', error);
        }
      }, 60000); // Call API every 60 seconds

      return () => clearInterval(updateServerInterval); // Cleanup
    }
  }, [isLoggedIn, isVideoPlaying, userId]);

  return (
    <div className="flex flex-col items-center justify-center pt-2 pb-8 sm:pb-12 px-6 text-center text-chocoBrown">
      <div className="flex gap-2 items-center mb-1">
        <TimeIcon />
        <span className="font-ADLaM text-xl">You have watched Capytube for a total of:</span>
        <div className="min-w-28 bg-white font-commissioner border border-chocoBrown rounded-md py-[2px] px-2">
          {hours}h {minutes}m {seconds}s
        </div>
      </div>
      <p className="font-commissioner">You may convert your collected time to coins when the airdrop event comes! </p>
    </div>
  );
};

export default UserStreamCounter;
