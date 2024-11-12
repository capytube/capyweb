import { useEffect } from "react";
import { DynamicWidget, useIsLoggedIn } from "@dynamic-labs/sdk-react-core";
import { useAccount } from "wagmi";
import { Link } from "react-router-dom";

import styles from "./Header.module.css";
import capytube from "../../assets/capytube.svg";
import capyOnlyLogo from "../../assets/footerlogo.svg";
import loginIcon from "../../assets/newlogin.png";
import capyCoinIcon from "../../assets/icons/coin.svg";
import walletLinkIcon from "../../assets/icons/link.svg";
import nonNFTprofile from "../../assets/nonNFTprofile.svg";
import NFTprofile from "../../assets/NFTprofile.svg";

const Header = () => {
  const isLoggedIn = useIsLoggedIn();
  const { address, isConnected } = useAccount();
  const isNftProfile = true;

  // overriding dynamic widget styling
  const host = document.getElementById("dynamic-widget");
  useEffect(() => {
    if (host) {
      const style = document.createElement("style");
      style.innerHTML = `.${styles.customLoginButton} { background: none !important; border: none !important;padding: 0 !important; box-shadow: none !important}`;
      host?.shadowRoot?.appendChild(style);
    }
  }, [host]);

  return (
    <div className={styles.headerContainer}>
      <Link to="/" className={styles.navLink} title="Home">
        <img
          src={capytube}
          alt="CapyTube"
          className={isLoggedIn ? styles.hideCapyInMobile : styles.capyMainIcon}
        />
        {isLoggedIn ? (
          <img
            src={capyOnlyLogo}
            alt="CapyTube"
            className={styles.capyMobileIcon}
          />
        ) : null}
      </Link>
      {!isLoggedIn ? (
        <div className={styles.logoAndSignoutButton}>
          <DynamicWidget
            buttonClassName={styles.customLoginButton}
            innerButtonComponent={<img src={loginIcon} alt="login" />}
          />
        </div>
      ) : (
        <div className={styles.signedInProfileContainer}>
          <div className={styles.profile__coinCounts}>
            <img src={capyCoinIcon} alt="coin" />
            <span>0</span>
          </div>
          <div className={styles.verticalSeparator}></div>
          <div className={styles.profile__details}>
            {isNftProfile ? (
              <img src={NFTprofile} alt="user" />
            ) : (
              <img src={nonNFTprofile} alt="user" />
            )}
            <div className={styles.profile__nameAndAddress}>
              <p>Hi, Doe</p>
              {isConnected ? (
                <div className={styles.profile__walletAddress}>
                  <img src={walletLinkIcon} alt="link" />
                  <span>
                    {address?.substring(address?.length - 15, address?.length)}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Header;
