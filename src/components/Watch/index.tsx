import { useEffect, useState } from "react";
import WatchCapy from "./WatchCapy/WatchCapy";
import Starring from "./Starring/Starring";
import Footer from "../Footer/Footer";

const Watch = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 500);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 500);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div>
      <WatchCapy />
      <Starring />
      {!isMobile && <Footer />}
    </div>
  );
};

export default Watch;
