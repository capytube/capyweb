// src/App.tsx

import React from "react";
import { BrowserRouter as Router, Route, Routes, Link } from "react-router-dom";
import PrivacyPolicy from "./components/PrivacyPolicy";
import TermsOfService from "./components/TermsOfService";
import DeletionInstructions from "./components/DeletionInstructions"; // Import the Deletion component
import ProfilePage from "./components/ProfilePage"; // Import the Profile Page component
import { Authenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import "./App.css";
import StreamingHome from "./components/Streaming/StreamingHome";
import SignOutButton from "./components/SignOutButton"; // Import the SignOutButton
import Logo from "./components/Logo";
import AboutMagnus from "./components/AboutMagnus";

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
    <Authenticator>
      {({ signOut, user }) => (
        <Router>
          <main>
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
              <header className="bg-gray-800 p-6 rounded-lg shadow-md text-white max-w-3xl w-11/12">
                <div style={styles.container}>
                  <h1 className="text-4xl mb-5">CapyTube</h1>
                  <div style={styles.rightbar}>
                    <div style={styles.logoAndSignout}>
                      <Logo />
                      <SignOutButton signOut={signOut} />
                    </div>
                    <p>{user?.signInDetails?.loginId}</p>
                  </div>
                </div>
                <nav className="mb-4">
                  <Link
                    to="/"
                    className="mr-5 text-blue-300 hover:text-blue-500"
                  >
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
                  <Route
                    path="/"
                    element={<StreamingHome title={"capystream"} />}
                  />
                  <Route path="/profile" element={<ProfilePage />} />{" "}
                  {/* Add profile route */}
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
      )}
    </Authenticator>
  );
};

export default App;
