import styles from './PremiumStream.module.css';

const PremiumStream = () => {
  return (
    <div className={styles.premiumStreamWrapper}>
      <h1>Premium stream</h1>
      <span className={styles.premiumStreamDesc}>Exclusive contents only for premium members!</span>
      <button
        className={`${styles.getCapyNftButton} relative disabled:cursor-not-allowed disabled:bg-buttonDisabled disabled:shadow-buttonDisabledShadow`}
        disabled
      >
        Subscribe
      </button>
    </div>
  );
};

export default PremiumStream;
