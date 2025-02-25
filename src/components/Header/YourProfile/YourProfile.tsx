import { useState } from 'react';
import { useDynamicContext, useIsLoggedIn } from '@dynamic-labs/sdk-react-core';

import styles from './YourProfile.module.css';
import { createUser } from '../../../api/user';

const YourProfile = ({ onClose }: { onClose: Function }) => {
  const isLoggedIn = useIsLoggedIn();
  const { user: allUserData, primaryWallet } = useDynamicContext();
  const authUserId = allUserData?.userId;
  const walletAddress = primaryWallet?.address;

  const [email, setEmail] = useState(allUserData?.email ?? '');
  const [name, setName] = useState('');
  const [errors, setErrors] = useState({ email: '', name: '' });
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const createProfile = async () => {
    if (authUserId && walletAddress) {
      try {
        setIsLoading(true);
        const response = await createUser({
          id: authUserId,
          userName: name,
          wallet_address: walletAddress,
          email_address: email,
        });
        if (response?.data?.username) {
          onClose();
          setIsLoading(false);
        }
      } catch (error) {
        console.log('error', error);
        setIsLoading(false);
      }
    }
  };

  const onSaveHandler = () => {
    if (isLoggedIn && walletAddress) {
      if (!name) {
        setErrors((prev) => ({ ...prev, name: 'Required' }));
      }

      if (name && email) {
        createProfile();
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
