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
          <Link to="#" className={`${styles.navLink} relative text-[#b1b1b1]`} title="Play with Capy">
            <button disabled className="disabled:cursor-not-allowed after:content-['Coming_Soon'] after:text-[10px] after:font-commissioner after:block after:h-fit leading-3 after:w-fit after:bg-tomatoRed after:px-1 after:rounded-md after:py-1 after:-rotate-[20deg] after:-translate-y-6 after:animate-pulse after:text-white after:absolute after:-left-8">Play with Capy</button>
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
