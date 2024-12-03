import { useEffect, useState } from 'react';
import { getCapyList } from '../../utils/api';

// import WatchCapy from './WatchCapy/WatchCapy';
import Starring from './Starring/Starring';
import Footer from '../Footer/Footer';

const Watch = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 500);

  const capyList = async () => {
    await getCapyList();
  };

  // const addCapy = async () =>
  //   await createCapy({
  //     capyName: 'Einstein',
  //     capyDescription:
  //       'The youngest and shy baby loves to plan a prison break. Brainy of the boys. The mastermind capy lord.',
  //     availableCameras: {
  //       mainCam: '',
  //       bedroomCam: '',
  //       foodCam: '',
  //     },
  //   });

  useEffect(() => {
    // addCapy();
    capyList();
    const handleResize = () => setIsMobile(window.innerWidth < 500);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div>
      {/*<WatchCapy />*/}
      <Starring />
      {!isMobile && <Footer />}
    </div>
  );
};

export default Watch;
