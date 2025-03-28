import { useState } from 'react';
import { useAtom } from 'jotai';
import { useDynamicContext, useIsLoggedIn } from '@dynamic-labs/sdk-react-core';

import { userAtom } from '../../../store/atoms/userAtom';
import { updateUserDetails } from '../../../api/user';

import styles from './updateProfile.module.css';

const UpdateProfile = ({ onClose }: { onClose: Function }) => {
  const isLoggedIn = useIsLoggedIn();
  const { primaryWallet } = useDynamicContext();
  const walletAddress = primaryWallet?.address;
  const [user] = useAtom(userAtom);
  const [name, setName] = useState<string>(user?.username ?? '');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const updateProfile = async (userId: string, name: string) => {
    try {
      setIsLoading(true);
      const response = await updateUserDetails({ userId: userId, userName: name });
      if (response?.data) {
        onClose();
        setIsLoading(false);
      }
    } catch (error) {
      console.log('error', error);
      setIsLoading(false);
    }
  };

  const onSaveHandler = () => {
    if (isLoggedIn && walletAddress && user?.id) {
      updateProfile(user?.id, name);
      setName('');
    }
  };

  return (
    <div className={styles.yourProfileContainer}>
      <h2>Your Profile</h2>
      <div className={styles.yourProfile__inputBox}>
        <p>Display name</p>
        <input type="text" placeholder="your name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <button className={styles.profileSaveBtn} disabled={user?.username === name} onClick={onSaveHandler}>
        {isLoading ? 'Loading...' : 'Save'}
      </button>
    </div>
  );
};

export default UpdateProfile;
