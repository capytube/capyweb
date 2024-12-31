import { useState } from 'react';
import { useAccount } from 'wagmi';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';

import styles from './YourProfile.module.css';
import { createUser } from '../../../api/user';

const YourProfile = ({ onClose }: { onClose: Function }) => {
  const { address, isConnected } = useAccount();
  const { user: allUserData } = useDynamicContext();

  const [email, setEmail] = useState(allUserData?.email ?? '');
  const [name, setName] = useState('');
  const [errors, setErrors] = useState({ email: '', name: '' });
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const createProfile = async (name: string, walletId: string) => {
    try {
      setIsLoading(true);
      const response = await createUser({ userName: name, wallet_address: walletId, email_address: email });
      if (response?.data?.username) {
        onClose();
        setIsLoading(false);
      }
    } catch (error) {
      console.log('error', error);
      setIsLoading(false);
    }
  };

  const onSaveHandler = () => {
    if (isConnected && address) {
      if (!name) {
        setErrors((prev) => ({ ...prev, name: 'Required' }));
      }

      if (name && email) {
        createProfile(name, address);
        setName('');
      }
    }
  };

  return (
    <div className={styles.yourProfileContainer}>
      <h2>Your Profile</h2>
      <div className={styles.yourProfile__inputBox}>
        <p>Email</p>
        <input
          type="text"
          placeholder="your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled
          className="disabled:cursor-not-allowed"
        />
      </div>

      <div className={styles.yourProfile__inputBox}>
        <p>Display name</p>
        <input
          type="text"
          placeholder="your name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setErrors({ email: '', name: '' });
          }}
        />
        {errors.name && <span className="text-tomatoRed text-xs">{errors.name}</span>}
      </div>

      <button className={styles.profileSaveBtn} onClick={onSaveHandler}>
        {isLoading ? 'Loading...' : 'Save'}
      </button>
    </div>
  );
};

export default YourProfile;
