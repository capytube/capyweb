// src/App.tsx

import React from "react";
import { BrowserRouter as Router, Route, Routes, Link } from "react-router-dom";
import PrivacyPolicy from "./components/PrivacyPolicy";
import TermsOfService from "./components/TermsOfService";
import DeletionInstructions from "./components/DeletionInstructions"; // Import the Deletion component
import ProfilePage from "./components/ProfilePage"; // Import the Profile Page component
import "@aws-amplify/ui-react/styles.css";
import "./App.css";
import StreamingHome from "./components/Streaming/StreamingHome";
import Logo from "./components/Logo";
import AboutMagnus from "./components/AboutMagnus";
import FullScreenStream from "./components/Streaming/FullScreenStream";
import { Web3Provider } from "./Web3Provider";
import { ConnectKitButton } from "connectkit";
import capytube from "./assets/capytube.svg";

const styles = {
  container: {
    display: "flex",
    justifyContent: "space-between", // Pushes the text to the left and logo to the right
    alignItems: "center",
    width: "100%", // Takes full width of the parent
  },
  logoAndSignout: {
    display: "flex",
    gap: "10px",
  },
  rightbar: {
    display: "grid",
    justifyContent: "center",
    alignItems: "left",
    gap: "10px",
  },
  text: {
    marginRight: "10px",
    fontSize: "20px",
  },
  logo: {
    width: "40px",
    height: "40px",
  },
};

const App: React.FC = () => {
  return (
    <Web3Provider>
      <Router>
        <main>
          <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
            <header className="bg-gray-800 p-6 rounded-lg shadow-md text-white max-w-3xl w-11/12">
              <div style={styles.container}>
                <img src={capytube} alt="CapyTube" className="h-20 w-40 mr-4" />
                <h1 className="text-4xl mb-5">CapyTube</h1>
                <div style={styles.rightbar}>
                  <div style={styles.logoAndSignout}>
                    <Logo />
                    <ConnectKitButton />
                  </div>
                </div>
              </div>
              <nav className="mb-4">
                <Link to="/" className="mr-5 text-blue-300 hover:text-blue-500">
                  Home
                </Link>
                <Link
                  to="/profile"
                  className="mr-5 text-blue-300 hover:text-blue-500"
                >
                  Profile
                </Link>
                <Link
                  to="/privacy-policy"
                  className="mr-5 text-blue-300 hover:text-blue-500"
                >
                  Privacy Policy
                </Link>
                <Link
                  to="/terms-of-service"
                  className="mr-5 text-blue-300 hover:text-blue-500"
                >
                  Terms of Service
                </Link>
                <Link
                  to="/about-magnus"
                  className="mr-5 text-blue-300 hover:text-blue-500"
                >
                  About
                </Link>
              </nav>

              {/* Define Routes */}
              <Routes>
                <Route path="/" element={<StreamingHome />} />
                {/* Full screen stream page */}
                <Route
                  path="/stream/:streamId/:streamTitle"
                  element={<FullScreenStream />}
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
    </Web3Provider>
  );
};

export default App;
