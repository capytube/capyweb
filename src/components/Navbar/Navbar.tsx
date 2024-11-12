import { Link, useLocation } from 'react-router-dom';
import { AccountIcon, HomeIcon, PlayIcon, WatchIcon } from '../Icons/Icons';

type Props = {};

export default function Navbar({}: Props) {
  const pathName = useLocation()?.pathname?.slice(1);

  return (
    <>
      <Link to="/" className="navLink" title="Home">
        <HomeIcon
          className="navIcon"
          fill={pathName === '' ? '#FFB26F' : '#FFEEE2'}
        />
      </Link>
      <Link to="/watch" className="navLink" title="Watch">
        <WatchIcon
          className="navIcon"
          fill={pathName === 'watch' ? '#FFB26F' : '#FFEEE2'}
        />
      </Link>
      <Link to="/play" className="navLink" title="Play">
        <PlayIcon
          className="navIcon scale-[1.4]"
          fill={pathName === 'play' ? '#FFB26F' : '#FFEEE2'}
        />
        {/* <img
      src={playIcon}
      alt="Play"
      className="navIcon"
      style={{ transform: 'scale(1.4)' }}
    /> */}
      </Link>
      <Link to="/profile" className="navLink" title="Account">
        <AccountIcon
          className="navIcon"
          fill={pathName === 'profile' ? '#FFB26F' : '#FFEEE2'}
        />
      </Link>
    </>
  );
}