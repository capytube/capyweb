import { useState } from 'react';
import { useAccount } from 'wagmi';

import styles from './YourProfile.module.css';
import { createUser } from '../../../api/user';

const YourProfile = ({ onClose }: { onClose: Function }) => {
  const { address, isConnected } = useAccount();

  const [name, setName] = useState('');

  const createProfile = async (name: string, walletId: string) => {
    const response = await createUser({ userName: name, wallet_address: walletId });
    if (response?.data?.username) {
      onClose();
    }
  };

  const onSaveHandler = () => {
    if (isConnected && address) {
      createProfile(name, address);
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

      <button className={styles.profileSaveBtn} onClick={onSaveHandler}>
        Save
      </button>
    </div>
  );
};

export default YourProfile;
