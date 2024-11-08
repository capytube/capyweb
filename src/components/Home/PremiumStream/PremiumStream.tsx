import styles from "./PremiumStream.module.css";

const PremiumStream = () => {
  return (
    <div className={styles.premiumStreamWrapper}>
      <h1>Premium stream</h1>
      <span className={styles.premiumStreamDesc}>
        Exclusive contents only for premium members!
      </span>
      <button className={styles.getCapyNftButton}>Subscribe</button>
    </div>
  );
};

export default PremiumStream;
