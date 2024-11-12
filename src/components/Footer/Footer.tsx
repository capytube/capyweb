import { Link } from "react-router-dom";
import styles from "./Footer.module.css";
import footerLogo from "../../assets/footerlogo.svg";

const Footer = () => {
  return (
    <div className={styles.footerWrapper}>
      <div className={styles.footer_infoCol}>
        <img src={footerLogo} alt="capytubeLogo" />
        <span>2024 © Capytube All rights reserved</span>
      </div>
      <div className={styles.footer_linksCol}>
        <div>
          <Link to="/" className={styles.navLink} title="Home">
            Home
          </Link>
          <Link to="/watch" className={styles.navLink} title="Watch Capy">
            Watch Capy
          </Link>
          <Link to="/play" className={styles.navLink} title="Play with Capy">
            Play with Capy
          </Link>
          <Link to="/profile" className={styles.navLink} title="Profile">
            Profile
          </Link>
        </div>

        <div>
          <Link to="/about-magnus" className={styles.navLink} title="About Capytube">
            About Capytube
          </Link>
          <Link to="/privacy-policy" className={styles.navLink} title="Privacy">
            Privacy
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Footer;
