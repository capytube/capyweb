// src/App.tsx

import React, { useEffect, useState } from "react";
import { DynamicWidget, useIsLoggedIn } from "@dynamic-labs/sdk-react-core";
import { useAccount, useBalance } from "wagmi";
import { BrowserRouter as Router, Route, Routes, Link } from "react-router-dom";
import PrivacyPolicy from "./components/PrivacyPolicy";
import TermsOfService from "./components/TermsOfService";
import DeletionInstructions from "./components/DeletionInstructions";
import ProfilePage from "./components/ProfilePage";
import "@aws-amplify/ui-react/styles.css";
import "./App.css";
// import StreamingHome from "./components/Streaming/StreamingHome";
import Home from "./components/Home";
import Watch from "./components/Watch";
import AboutMagnus from "./components/AboutMagnus";
// import FullScreenStream from "./components/Streaming/FullScreenStream";
import WatchRoom from "./components/Watch/WatchRoom/WatchRoom";
import FooterNavbar from "./components/FooterNavbar/FooterNavbar";
import capytube from "./assets/capytube.svg";
import homeIcon from "./assets/home.svg";
// import profileIcon from "./assets/profile.svg";
// import capyIcon from "./assets/capy.svg";
// import aboutIcon from "./assets/about.svg";
import loginIcon from "./assets/newlogin.png";

import watchIcon from "./assets/watch.svg";
import playIcon from "./assets/play.svg";
import accountIcon from "./assets/account.svg";

const App: React.FC = () => {
  const isLoggedIn = useIsLoggedIn();

  const { address, isConnected } = useAccount();
  const wagmiBalanceResult = useBalance({ address });

  const [isMobile, setIsMobile] = useState(window.innerWidth < 500);

  console.log("dynamic___isLoggedIn", isLoggedIn);
  console.log("wagmi___address", address);
  console.log("wagmi___isConnected", isConnected);
  if (wagmiBalanceResult?.isSuccess) {
    const balanceData = wagmiBalanceResult?.data;
    console.log("balanceData", balanceData);
  }

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 500);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <Router>
      <main>
        <div className="mainContainer">
          <header className="mainContent">
            <div className="headerContainer">
              <Link to="/" className="navLink" title="Home">
                <img src={capytube} alt="CapyTube" className="capyMainIcon" />
              </Link>
              <div className="logoAndSignoutButton">
                <DynamicWidget
                  buttonClassName="custom-login-button"
                  innerButtonComponent={<img src={loginIcon} alt="login" />}
                />
              </div>
            </div>
            <nav className="navlinks-container">
              <Link to="/" className="navLink" title="Home">
                <img src={homeIcon} alt="Home" className="navIcon" />
              </Link>
              <Link to="/watch" className="navLink" title="Watch">
                <img src={watchIcon} alt="Watch" className="navIcon" />
              </Link>
              <Link to="#" className="navLink" title="Play">
                <img
                  src={playIcon}
                  alt="Play"
                  className="navIcon"
                  style={{ transform: "scale(1.4)" }}
                />
              </Link>
              <Link to="/profile" className="navLink" title="Account">
                <img src={accountIcon} alt="Account" className="navIcon" />
              </Link>
            </nav>
            {isMobile && <FooterNavbar />}

            {/* Define Routes */}
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/watch" element={<Watch />} />
              <Route
                path="/stream/:streamId/:streamTitle"
                element={<WatchRoom />}
              />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/terms-of-service" element={<TermsOfService />} />
              <Route path="/deletion" element={<DeletionInstructions />} />
              <Route path="/about-magnus" element={<AboutMagnus />} />
            </Routes>
          </header>
        </div>
      </main>
    </Router>
  );
};

export default App;
