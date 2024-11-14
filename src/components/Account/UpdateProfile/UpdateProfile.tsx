import { useState } from 'react';
import { useAccount } from 'wagmi';
import { useAtom } from 'jotai';

import { userAtom } from '../../../atoms/atom';
import { updateUserProfile } from '../../../utils/api';

import styles from './updateProfile.module.css';

const UpdateProfile = ({ onClose }: { onClose: Function }) => {
  const { address, isConnected } = useAccount();

  const [user] = useAtom(userAtom);
  const [name, setName] = useState(user?.name || '');

  const updateProfile = async (name: string, walletId: string) => {
    const response = await updateUserProfile({ name, userId: walletId });
    console.log('response', response);
    if (response?.data) {
      onClose();
    }
  };

  const onSaveHandler = () => {
    if (isConnected && address) {
      updateProfile(name, address);
      setName('');
    }
  };

  return (
    <div className={styles.yourProfileContainer}>
      <h2>Your Profile</h2>
      <div className={styles.yourProfile__inputBox}>
        <p>Display name</p>
        <input
          type="text"
          placeholder="your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <button className={styles.profileSaveBtn} onClick={onSaveHandler}>
        Save
      </button>
    </div>
  );
};

export default UpdateProfile;
