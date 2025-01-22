import { Link, useLocation } from 'react-router-dom';
import { AccountIcon, HomeIcon, PlayIcon, WatchIcon } from '../Icons/Icons';

export default function Navbar() {
  const pathName = useLocation()?.pathname?.slice(1);

  return pathName.includes('shop') ? null : (
    <nav className="navlinks-container">
      <Link to="/" className="navLink" title="Home">
        <HomeIcon className="navIcon" fill={pathName === '' ? '#FFB26F' : '#FFEEE2'} />
      </Link>
      <Link to="/watch" className="navLink" title="Watch">
        <WatchIcon className="navIcon" fill={pathName?.includes('watch') ? '#FFB26F' : '#FFEEE2'} />
      </Link>
      <Link to="/play" className="navLink" title="Play">
        <PlayIcon className="navIcon scale-[1.4]" fill={pathName?.includes('play') ? '#FFB26F' : '#FFEEE2'} />
      </Link>
      <Link to="/profile" className="navLink" title="Account">
        <AccountIcon className="navIcon" fill={pathName?.includes('profile') ? '#FFB26F' : '#FFEEE2'} />
      </Link>
    </nav>
  );
}
