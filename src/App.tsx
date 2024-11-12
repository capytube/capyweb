// src/App.tsx
import React, { useEffect, useState } from "react";
import { useIsLoggedIn } from "@dynamic-labs/sdk-react-core";
import { useAccount, useBalance } from "wagmi";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import PrivacyPolicy from "./components/PrivacyPolicy";
import TermsOfService from "./components/TermsOfService";
import DeletionInstructions from "./components/DeletionInstructions";
import ProfilePage from "./components/Account/ProfilePage";
import "@aws-amplify/ui-react/styles.css";
import "./App.css";
// import StreamingHome from "./components/Streaming/StreamingHome";
import Home from "./components/Home";
import Watch from "./components/Watch";
import AboutMagnus from "./components/AboutMagnus";
import NFTMarket from "./components/NFTMarket/index";
import NFTDetails from "./components/NFTMarket/NFTDetails/index";
// import FullScreenStream from "./components/Streaming/FullScreenStream";
import WatchRoom from "./components/Watch/WatchRoom/WatchRoom";
import FooterNavbar from "./components/FooterNavbar/FooterNavbar";
import Header from "./components/Header/Header";
import Navbar from "./components/Navbar/Navbar";
import PlayPage from "./components/Play/index";

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
            <Header />
            <nav className="navlinks-container">
              <Navbar />
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
              <Route path="/play" element={<PlayPage />} />
              <Route path="/shop" element={<NFTMarket />} />
              <Route path="/shop/:id" element={<NFTDetails />} />
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
