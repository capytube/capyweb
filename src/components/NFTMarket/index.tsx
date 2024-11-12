import React from 'react';
import HeaderSection from './Header/HeaderSection';
import ListingSection from './ListingSection/ListingSection';
import Footer from '../Footer/Footer';

type Props = {};

export default function index({}: Props) {
  const [isMobile, setIsMobile] = React.useState(window.innerWidth < 500);

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 500);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <>
      <HeaderSection />
      <ListingSection />
      {!isMobile && <Footer />}
    </>
  );
}
