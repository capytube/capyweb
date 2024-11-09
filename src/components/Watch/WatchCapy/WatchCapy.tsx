import styles from "./WatchCapy.module.css";

const WatchCapy = () => {
  return (
    <div className={styles.watchCapyWrapper}>
      <h1>Watch CAPY</h1>
      <span className={styles.watchCapyDesc}>
        Stream adorable capybara content and collect ‘capy coins’($CAPY) just
        for watching!
        <br /> The more you tune in, the more you earn!
      </span>
    </div>
  );
};

export default WatchCapy;
