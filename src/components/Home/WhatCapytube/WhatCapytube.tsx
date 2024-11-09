import styles from "./WhatCapytube.module.css";
import capyCoinImage from "../../../assets/capyCoin.svg";

const WhatCapytube = () => {
  return (
    <div className={styles.whatCapytubeWrapper}>
      <h1>What is Capytube?</h1>
      <img src={capyCoinImage} alt="capycoin" />
      <div className={styles.whatCapyAnswers}>
        <div className={styles.capyAnswerCard}>
          <p className={styles.capyAnswerCard_title}>Watch & Earn</p>
          <p className={styles.capyAnswerCard_desc}>
            Stream adorable capybara content and collect &apos;capy
            coins&apos;($CAPY) just for watching! The more you tune in, the more
            you earn!
          </p>
        </div>
        <div className={styles.capyAnswerCard}>
          <p className={styles.capyAnswerCard_title}>Spend Your Coins on Fun</p>
          <p className={styles.capyAnswerCard_desc}>
            Use your hard-earned (or purchased) capy coins to join games like
            “Buy Capy a Snack” or win a call with the capybaras! These games let
            you play, bid, and get closer to our furry friends.
          </p>
        </div>
        <div className={styles.capyAnswerCard}>
          <p className={styles.capyAnswerCard_title}>Buy Coins Anytime</p>
          <p className={styles.capyAnswerCard_desc}>
            Need more coins to join the fun? You can always purchase capy coins
            with your credit card and never miss out on the action.
          </p>
        </div>
        <div className={styles.capyAnswerCard}>
          <p className={styles.capyAnswerCard_title}>
            Go Premium with Our Exclusive NFT Membership
          </p>
          <p className={styles.capyAnswerCard_desc}>
            Upgrade to a premium membership by buying our special NFT! This
            gives you access to exclusive content and extra perks.
          </p>
        </div>
      </div>

      <button className={styles.earnCapyButton}>Watch & Earn $CAPY</button>
    </div>
  );
};

export default WhatCapytube;
