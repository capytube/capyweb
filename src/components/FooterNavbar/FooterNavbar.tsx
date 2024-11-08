import { Link } from "react-router-dom";
import styles from "./FooterNavbar.module.css";
import homeIcon from "./../../assets/home.svg";
import watchIcon from "./../../assets/watch.svg";
import playIcon from "./../../assets/play.svg";
import accountIcon from "./../../assets/account.svg";

const FooterNavbar = () => {
  return (
    <nav className={styles.footerNavbar}>
      <div className={styles.navlinkContainer}>
        <Link to="/" className={styles.navLink} title="Home">
          <img src={homeIcon} alt="Home" className="navIcon" />
        </Link>
        <Link to="/watch" className={styles.navLink} title="Watch">
          <img src={watchIcon} alt="Watch" className="navIcon" />
        </Link>
        <Link to="#" className={styles.navLink} title="Play">
          <img src={playIcon} alt="Play" className="navIcon" />
        </Link>
        <Link to="/profile" className={styles.navLink} title="Account">
          <img src={accountIcon} alt="Account" className="navIcon" />
        </Link>
      </div>
    </nav>
  );
};

export default FooterNavbar;
