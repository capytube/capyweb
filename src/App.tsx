// src/App.tsx

import React, { useEffect, useState } from 'react';
import {
  DynamicContextProvider,
  DynamicWidget,
} from '@dynamic-labs/sdk-react-core';
import { createConfig, http, WagmiProvider } from 'wagmi';
import { EthereumWalletConnectors } from '@dynamic-labs/ethereum';
import { BrowserRouter as Router, Route, Routes, Link } from 'react-router-dom';
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsOfService from './components/TermsOfService';
import DeletionInstructions from './components/DeletionInstructions';
import ProfilePage from './components/Account/ProfilePage';
import '@aws-amplify/ui-react/styles.css';
import './App.css';
// import StreamingHome from "./components/Streaming/StreamingHome";
import Home from './components/Home';
import Watch from './components/Watch';
import AboutMagnus from './components/AboutMagnus';
import NFTMarket from './components/NFTMarket/index';
import NFTDetails from './components/NFTMarket/NFTDetails/index';
// import FullScreenStream from "./components/Streaming/FullScreenStream";
import WatchRoom from './components/Watch/WatchRoom/WatchRoom';
import FooterNavbar from './components/FooterNavbar/FooterNavbar';
import capytube from './assets/capytube.svg';
import { baseSepolia } from 'viem/chains';
// import profileIcon from "./assets/profile.svg";
// import capyIcon from "./assets/capy.svg";
// import aboutIcon from "./assets/about.svg";
import loginIcon from './assets/newlogin.png';

import PlayPage from './components/Play/index';
import Navbar from './components/Navbar/Navbar';

export const wagmiConfig = createConfig({
  chains: [baseSepolia],
  transports: {
    [baseSepolia.id]: http('https://sepolia.base.org'),
  },
});

const App: React.FC = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 500);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 500);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <WagmiProvider config={wagmiConfig}>
      <DynamicContextProvider
        settings={{
          environmentId: 'd36e0777-89be-4cb6-a0ee-27e4a50aac35',
          walletConnectors: [EthereumWalletConnectors],
        }}
      >
        <Router>
          <main>
            <div className="mainContainer">
              <header className="mainContent">
                <div className="headerContainer">
                  <Link to="/" className="navLink" title="Home">
                    <img
                      src={capytube}
                      alt="CapyTube"
                      className="capyMainIcon"
                    />
                  </Link>
                  <div className="logoAndSignoutButton">
                    <DynamicWidget
                      buttonClassName="custom-login-button"
                      innerButtonComponent={<img src={loginIcon} alt="login" />}
                      buttonContainerClassName="custom-login-container"
                    />
                  </div>
                </div>
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
                  <Route
                    path="/terms-of-service"
                    element={<TermsOfService />}
                  />
                  <Route path="/deletion" element={<DeletionInstructions />} />
                  <Route path="/about-magnus" element={<AboutMagnus />} />
                </Routes>
              </header>
            </div>
          </main>
        </Router>
      </DynamicContextProvider>
    </WagmiProvider>
  );
};

export default App;
