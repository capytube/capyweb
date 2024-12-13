import { useState } from 'react';
import { useAccount } from 'wagmi';

import { generateClient } from 'aws-amplify/api';
import { Schema } from '../../../../amplify/data/resource';
import styles from './YourProfile.module.css';

const YourProfile = ({ onClose }: { onClose: Function }) => {
  const client = generateClient<Schema>();
  const { address, isConnected } = useAccount();

  const [name, setName] = useState('');

  const createProfile = async (name: string, walletId: string) => {
    const response = await client.models.UserOld.create({
      id: walletId,
      name: name,
      createdAt: new Date().getTime(),
    });
    if (response?.data?.name) {
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
