// src/App.tsx

import React from "react";
import {
  DynamicContextProvider,
  DynamicWidget,
} from "@dynamic-labs/sdk-react-core";
import { createConfig, http, WagmiProvider } from "wagmi";
import { EthereumWalletConnectors } from "@dynamic-labs/ethereum";
import { BrowserRouter as Router, Route, Routes, Link } from "react-router-dom";
import PrivacyPolicy from "./components/PrivacyPolicy";
import TermsOfService from "./components/TermsOfService";
import DeletionInstructions from "./components/DeletionInstructions";
import ProfilePage from "./components/ProfilePage";
import "@aws-amplify/ui-react/styles.css";
import "./App.css";
import StreamingHome from "./components/Streaming/StreamingHome";
import AboutMagnus from "./components/AboutMagnus";
import FullScreenStream from "./components/Streaming/FullScreenStream";
import capytube from "./assets/capytube.svg";
import { baseSepolia } from "viem/chains";
import homeIcon from "./assets/home.svg";
import profileIcon from "./assets/profile.svg";
import capyIcon from "./assets/capy.svg";
import aboutIcon from "./assets/about.svg";
import loginIcon from "./assets/login.svg";

export const wagmiConfig = createConfig({
  chains: [baseSepolia],
  transports: {
    [baseSepolia.id]: http("https://sepolia.base.org"),
  },
});

const styles = {
  container: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
  },
  rightbar: {
    display: "flex",
    alignItems: "center",
  },
  logoAndSignout: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "flex-end",
  },
  appBackground: {
    backgroundColor: "#FFFCC8", // Light yellow background
    minHeight: "100vh",
  },
  mainContent: {
    color: "#000000", // Changed to black for better contrast on light background
    padding: "40px",
    borderRadius: "8px",
    maxWidth: "800px",
    width: "90%",
  },
  navLink: {
    color: "#000000",
    marginRight: "20px",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
  },
  navIcon: {
    width: "48px", // Doubled from 24px to 48px
    height: "48px", // Doubled from 24px to 48px
  },
  customLoginButton: {
    backgroundImage: `url(${loginIcon})`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "center",
    backgroundSize: "contain",
    width: "96px", // Doubled from 48px to 96px
    height: "96px", // Doubled from 48px to 96px
    cursor: "pointer",
  },
};

const App: React.FC = () => {
  return (
    <WagmiProvider config={wagmiConfig}>
      <DynamicContextProvider
        settings={{
          environmentId: "d36e0777-89be-4cb6-a0ee-27e4a50aac35",
          walletConnectors: [EthereumWalletConnectors],
        }}
      >
        <Router>
          <main style={styles.appBackground}>
            <div className="flex flex-col items-center justify-center min-h-screen">
              <header
                style={styles.mainContent}
                className="p-6 rounded-lg shadow-md text-white max-w-3xl w-11/12"
              >
                <div style={styles.container}>
                  <img
                    src={capytube}
                    alt="CapyTube"
                    className="h-20 w-40 mr-4"
                  />
                  <div style={styles.rightbar}>
                    <div style={styles.logoAndSignout}>
                      <DynamicWidget
                        buttonClassName="custom-login-button"
                        innerButtonComponent={
                          <div style={styles.customLoginButton}></div>
                        }
                        buttonContainerClassName="custom-login-container"
                      />
                    </div>
                  </div>
                </div>
                <nav className="mb-4">
                  <Link to="/" style={styles.navLink} title="Home">
                    <img src={homeIcon} alt="Home" style={styles.navIcon} />
                  </Link>
                  <Link to="/profile" style={styles.navLink} title="Profile">
                    <img
                      src={profileIcon}
                      alt="Profile"
                      style={styles.navIcon}
                    />
                  </Link>
                  <Link to="#" style={styles.navLink} title="Placeholder">
                    <img
                      src={capyIcon}
                      alt="Placeholder"
                      style={styles.navIcon}
                    />
                  </Link>
                  <Link to="/about-magnus" style={styles.navLink} title="About">
                    <img src={aboutIcon} alt="About" style={styles.navIcon} />
                  </Link>
                </nav>

                {/* Define Routes */}
                <Routes>
                  <Route path="/" element={<StreamingHome />} />
                  <Route
                    path="/stream/:streamId/:streamTitle"
                    element={<FullScreenStream />}
                  />
                  <Route path="/profile" element={<ProfilePage />} />
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
