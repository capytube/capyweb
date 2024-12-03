import { useEffect, useState } from "react";
import PublicStream from "./PublicStream/PublicStream";
import PremiumStream from "./PremiumStream/PremiumStream";
import WhatCapytube from "./WhatCapytube/WhatCapytube";
import OurCapybaras from "./OurCapybaras/OurCapybaras";
import CapyGallery from "./CapyGallery/CapyGallery";
import Footer from "../Footer/Footer";

const Home = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 500);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 500);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div>
      <PublicStream />
      <PremiumStream />
      {/*<WhatCapytube />*/}
      <OurCapybaras />
      <CapyGallery />
      {!isMobile && <Footer />}
    </div>
  );
};

export default Home;
