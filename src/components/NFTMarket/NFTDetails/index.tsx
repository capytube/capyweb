import { Link } from 'react-router-dom';
import { LeftArrowIcon } from '../../Icons/Icons';
import NFTDetailsCard from './DetailsCard';
import NftDetails from './NftDetails';
import React from 'react';
import Footer from '../../Footer/Footer';

type Props = {};

export default function index({}: Props) {
  const handleScrollTop = () => {
    const ele = document.getElementById('details-section');
    ele?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  React.useEffect(() => {
    handleScrollTop();
    return () => {
      handleScrollTop();
    };
  }, []);

  const [isMobile, setIsMobile] = React.useState(window.innerWidth < 500);

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 500);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <>
      <header id="shop-nft-section" className='py-10'></header>
      <div
        id="details-section"
        className="lg:pb-20 lg:pt-10 py-8 px-4 lg:px-40 "
      >
        <Link
          to="/shop"
          className="flex md:gap-x-4 gap-x-3 md:text-2xl text-base text-chocoBrown font-commissioner items-center md:pb-10 pb-6"
        >
          <LeftArrowIcon />
          Back
        </Link>
        <div className="flex lg:flex-row flex-col gap-y-10 gap-x-12 lg:justify-start justify-center lg:items-start items-center">
          <NFTDetailsCard />
          <NftDetails />
        </div>
      </div>
      {!isMobile && <Footer />}
    </>
  );
}
