import PublicStream from "./PublicStream/PublicStream";
import PremiumStream from "./PremiumStream/PremiumStream";
import WhatCapytube from "./WhatCapytube/WhatCapytube";
import OurCapybaras from "./OurCapybaras/OurCapybaras";
import CapyGallery from "./CapyGallery/CapyGallery";
import Footer from "../Footer/Footer";

const Home = () => {
  return (
    <div>
      <PublicStream />
      <PremiumStream />
      <WhatCapytube />
      <OurCapybaras />
      <CapyGallery />
      <Footer />
    </div>
  );
};

export default Home;
