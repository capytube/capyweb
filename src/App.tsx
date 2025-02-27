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
import { useSetAtom } from 'jotai';
import { walletAtom } from './store/atoms';
import { useCapylBalance } from './utils/useCapylBalance';
import { updateUserTotalBalance } from './api/user';

export const calculateCapylBalance = (rawBalance: number, decimals: number, price: number) => {
  return Math.floor((rawBalance / Math.pow(10, decimals)) * price);
};

const App = () => {
  const isLoggedIn = useIsLoggedIn();
  const { primaryWallet, user: allUserData } = useDynamicContext();
  const walletAddress = primaryWallet?.address; // user's wallet address
  const authUserId = allUserData?.userId;

  const { data: capylBalData } = useCapylBalance(walletAddress ?? ''); // user's capyl token balance data

  const [isMobile, setIsMobile] = useState(window.innerWidth < 500);
  const setWalletId = useSetAtom(walletAtom);

  // clearing ratings key from local storage on sign out
  useEffect(() => {
    if (!isLoggedIn) {
      localStorage.setItem('ratings', '');
    }
  }, [isLoggedIn]);

  // updating the user balance if capyl balance data is available
  useEffect(() => {
    (async () => {
      const decimals = 6;
      const price = 1;
      if (capylBalData?.rawBalance) {
        const capylBalance = calculateCapylBalance(capylBalData.rawBalance, decimals, price);
        if (authUserId) {
          await updateUserTotalBalance({
            userId: authUserId,
            totalBalance: capylBalance,
          });
        }
      }
    })();
  }, [capylBalData, authUserId]);

  useEffect(() => {
    if (isLoggedIn && walletAddress) {
      setWalletId(walletAddress);
    }
    const handleResize = () => setIsMobile(window.innerWidth < 500);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
