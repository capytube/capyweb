import { Link, useLocation } from 'react-router-dom';
import { AccountIcon, HomeIcon, WatchIcon } from '../Icons/Icons';
import playIconComingSoon from '../../assets/playIconSoon.svg';

import styles from './FooterNavbar.module.css';

const FooterNavbar = () => {
  const pathName = useLocation()?.pathname?.slice(1);

  return (
    <nav className={styles.footerNavbar}>
      <div className={styles.navlinkContainer}>
        <Link to="/" className={styles.navLink} title="Home">
          <HomeIcon className="navIcon max-w-20" fill={pathName === '' ? '#FFB26F' : '#FFEEE2'} />
        </Link>
        <Link to="/watch" className={styles.navLink} title="Watch">
          <WatchIcon className="navIcon max-w-20" fill={pathName === 'watch' ? '#FFB26F' : '#FFEEE2'} />
        </Link>
        <Link to="#" className={styles.navLink} title="Play">
          {/* <PlayIcon className="navIcon scale-[1.4] max-w-[83px]" fill={pathName === 'play' ? '#FFB26F' : '#FFEEE2'} /> */}
          <button disabled className="disabled:cursor-not-allowed">
            <img src={playIconComingSoon} alt="Play" className="navIcon" style={{ transform: 'scale(1.5)' }} />
          </button>
        </Link>
        <Link to="/profile" className={styles.navLink} title="Account">
          <AccountIcon className="navIcon max-w-[80px]" fill={pathName === 'profile' ? '#FFB26F' : '#FFEEE2'} />
        </Link>
      </div>
    </nav>
  );
};

export default FooterNavbar;
