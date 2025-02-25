// src/App.tsx
import { useEffect, useState } from 'react';
import { useIsLoggedIn, useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsOfService from './components/TermsOfService';
import DeletionInstructions from './components/DeletionInstructions';
import ProfilePage from './components/Account/ProfilePage';
import '@aws-amplify/ui-react/styles.css';
import './App.css';
import Home from './components/Home';
import Watch from './components/Watch';
import AboutUs from './components/AboutUs';
import NFTMarket from './components/NFTMarket/index';
import NFTDetails from './components/NFTMarket/NFTDetails/index';
import WatchRoom from './components/Watch/WatchRoom/WatchRoom';
import FooterNavbar from './components/FooterNavbar/FooterNavbar';
import Header from './components/Header/Header';
import Navbar from './components/Navbar/Navbar';
import PlayPage from './components/Play/index';
import { useAtom } from 'jotai';
import { walletAtom } from './store/atoms';
import useCapylBalance from './utils/useCapylBalance';

const App = () => {
  const isLoggedIn = useIsLoggedIn();
  const balancePromise = useCapylBalance();
  const { primaryWallet } = useDynamicContext();
  const walletAddress = primaryWallet?.address;

  const [isMobile, setIsMobile] = useState(window.innerWidth < 500);
  const [, setWalletId] = useAtom(walletAtom);

  // clearing ratings key from local storage on sign out
  useEffect(() => {
    if (!isLoggedIn) {
      localStorage.setItem('ratings', '');
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (isLoggedIn && walletAddress) {
      setWalletId(walletAddress);
    }
    const handleResize = () => setIsMobile(window.innerWidth < 500);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    balancePromise
      .then(({ balance, error }) => {
        console.log('balance', balance);
        console.log('error', error);
      })
      .catch((err) => {
        console.error('Failed to fetch balance:', err);
      });
  }, [balancePromise]);

  return (
    <Router>
      <main>
        <div className="mainContainer">
          <header className="mainContent">
            <Header />
            <Navbar />
            {isMobile && <FooterNavbar />}

            {/* Define Routes */}
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/watch" element={<Watch />} />
              <Route path="/stream/:capyId" element={<WatchRoom />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/play" element={<PlayPage />} />
              <Route path="/shop" element={<NFTMarket />} />
              <Route path="/shop/:id" element={<NFTDetails />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/terms-of-service" element={<TermsOfService />} />
              <Route path="/deletion" element={<DeletionInstructions />} />
              <Route path="/about-us" element={<AboutUs />} />
            </Routes>
          </header>
        </div>
      </main>
    </Router>
  );
};

export default App;
