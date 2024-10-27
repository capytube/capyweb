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
    backgroundColor: "#1a3a1a", // Dark green background
    minHeight: "100vh",
  },
  mainContent: {
    color: "#ffffff", // White text for readability
    padding: "40px",
    borderRadius: "8px",
    maxWidth: "800px",
    width: "90%",
  },
  navLink: {
    color: "#ffffff", // White color for nav links
    marginRight: "20px",
    textDecoration: "none",
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
                      <DynamicWidget />
                    </div>
                  </div>
                </div>
                <nav className="mb-4">
                  <Link to="/" style={styles.navLink}>
                    Home
                  </Link>
                  <Link to="/profile" style={styles.navLink}>
                    Profile
                  </Link>
                  <Link to="/privacy-policy" style={styles.navLink}>
                    Privacy Policy
                  </Link>
                  <Link to="/terms-of-service" style={styles.navLink}>
                    Terms of Service
                  </Link>
                  <Link to="/about-magnus" style={styles.navLink}>
                    About
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
