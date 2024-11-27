import { Link, useLocation } from 'react-router-dom';
import { AccountIcon, HomeIcon, WatchIcon } from '../Icons/Icons';
import playIconComingSoon from '../../assets/playIconSoon.svg';

type Props = {};

export default function Navbar({}: Props) {
  const pathName = useLocation()?.pathname?.slice(1);

  return pathName.includes('shop') ? null : (
    <nav className="navlinks-container">
      <Link to="/" className="navLink" title="Home">
        <HomeIcon className="navIcon" fill={pathName === '' ? '#FFB26F' : '#FFEEE2'} />
      </Link>
      <Link to="/watch" className="navLink" title="Watch">
        <WatchIcon className="navIcon" fill={pathName?.includes('watch') ? '#FFB26F' : '#FFEEE2'} />
      </Link>
      <Link to="#" className="navLink" title="Play">
        {/* <PlayIcon className="navIcon scale-[1.4]" fill={pathName?.includes('play') ? '#FFB26F' : '#FFEEE2'} /> */}
        <button disabled className="disabled:cursor-not-allowed">
          <img src={playIconComingSoon} alt="Play" className="navIcon" style={{ transform: 'scale(1.5)' }} />
        </button>
      </Link>
      <Link to="/profile" className="navLink" title="Account">
        <AccountIcon className="navIcon" fill={pathName?.includes('profile') ? '#FFB26F' : '#FFEEE2'} />
      </Link>
    </nav>
  );
}
