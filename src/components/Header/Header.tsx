import { useEffect, useState } from 'react';
import { DynamicWidget, useDynamicContext, useIsLoggedIn } from '@dynamic-labs/sdk-react-core';
import { Link } from 'react-router-dom';
import { useAtom } from 'jotai';

import styles from './Header.module.css';
import capytube from '../../assets/capytube.svg';
import capyOnlyLogo from '../../assets/footerlogo.svg';
import loginIcon from '../../assets/newlogin.png';
import capyCoinIcon from '../../assets/icons/coin.svg';
import walletLinkIcon from '../../assets/icons/link.svg';
import nonNFTprofile from '../../assets/nonNFTprofile.svg';
import NFTprofile from '../../assets/NFTprofile.svg';
import Modal from '../Modal/Modal';
import YourProfile from './YourProfile/YourProfile';
import { userAtom } from '../../store/atoms/userAtom';
import { getUserById } from '../../api/user';
import DemoSiteRibbon from '../DemoSiteRibbon';

const Header = () => {
  const isNftProfile = true;

  const isLoggedIn = useIsLoggedIn();
  const isUserAuthenticated = isLoggedIn || localStorage.getItem('dynamic_authentication_token');
  const { setShowDynamicUserProfile, user: authUserData, primaryWallet } = useDynamicContext();
  const authUserId = authUserData?.userId;
  const walletAddress = primaryWallet?.address;

  const [user] = useAtom(userAtom);

  const [isSetProfileModalOpen, setIsSetProfileModalOpen] = useState(false);

  const handleProfileClick = () => {
    setShowDynamicUserProfile(true);
  };

  useEffect(() => {
    const getProfile = async () => {
      if (isLoggedIn && walletAddress && authUserId) {
        const response = await getUserById(authUserId);
        if (authUserId !== response?.data?.id) {
          setIsSetProfileModalOpen(true);
        } else {
          setIsSetProfileModalOpen(false);
        }
      }
    };

    getProfile();
  }, [isLoggedIn, walletAddress]);

  // overriding dynamic widget styling
  const host = document.getElementById('dynamic-widget');
  useEffect(() => {
    if (host) {
      const style = document.createElement('style');
      style.innerHTML = `.${styles.customLoginButton} { background: none !important; border: none !important;padding: 0 !important; box-shadow: none !important}`;
      host?.shadowRoot?.appendChild(style);
    }
  }, [host]);

  return (
    <>
      <div className={styles.headerContainer}>
        <Link to="/" className={styles.navLink} title="Home">
          <div className="relative">
            <img src={capytube} alt="CapyTube" className={isLoggedIn ? styles.hideCapyInMobile : styles.capyMainIcon} />
            <DemoSiteRibbon />
          </div>
          {isUserAuthenticated ? <img src={capyOnlyLogo} alt="CapyTube" className={styles.capyMobileIcon} /> : null}
        </Link>
        <div className={styles.logoAndSignoutButton} style={{ display: isUserAuthenticated ? 'none' : 'initial' }}>
          <img src={loginIcon} alt="login" />
          <div className="absolute top-2 opacity-0 ">
            <DynamicWidget
              buttonClassName={styles.customLoginButton}
              innerButtonComponent={<img src={loginIcon} width={128} height={70} alt="login" />}
            />
          </div>
        </div>
        {isUserAuthenticated ? (
          <button className={styles.signedInProfileContainer} onClick={handleProfileClick}>
            <div className={styles.profile__coinCounts}>
              <img src={capyCoinIcon} alt="coin" />
              <span>{user.balance ?? 0}</span>
            </div>
            <div className={styles.verticalSeparator}></div>
            <div className={styles.profile__details}>
              {isNftProfile ? <img src={NFTprofile} alt="user" /> : <img src={nonNFTprofile} alt="user" />}
              <div className={styles.profile__nameAndAddress}>
                <p>Hi, {user?.username || '...'}</p>
                {isLoggedIn ? (
                  <div className={styles.profile__walletAddress}>
                    <img src={walletLinkIcon} alt="link" />
                    <span>{walletAddress?.substring(walletAddress?.length - 15, walletAddress?.length)}</span>
                  </div>
                ) : null}
              </div>
            </div>
          </button>
        ) : null}
      </div>
      <Modal
        isOpen={isSetProfileModalOpen}
        onClose={() => setIsSetProfileModalOpen(false)}
        width="400px"
        hideClose={true}
        className="md:max-w-[550px] max-w-[300px] shadow-characterCard"
      >
        <YourProfile
          onClose={() => {
            setIsSetProfileModalOpen(false);
          }}
        />
      </Modal>
    </>
  );
};

export default Header;
