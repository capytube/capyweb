// src/App.tsx

import React from "react";
import { BrowserRouter as Router, Route, Routes, Link } from "react-router-dom";
import LiveStream from "./components/LiveStream";
import PrivacyPolicy from "./components/PrivacyPolicy";
import TermsOfService from "./components/TermsOfService";
import DeletionInstructions from "./components/DeletionInstructions"; // Import the Deletion component
import ProfilePage from "./components/ProfilePage"; // Import the Profile Page component
import { Authenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import "./App.css";

const App: React.FC = () => {
  const streamId = import.meta.env.VITE_LIVEPEER_STREAM_ID;

  return (
    <Authenticator>
      {({ signOut, user }) => (
        <Router>
          <main>
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
              <header className="bg-gray-800 p-6 rounded-lg shadow-md text-white max-w-3xl w-11/12">
                <h1>Welcome, {user?.username}</h1>
                <button
                  onClick={signOut}
                  className="mt-5 text-white bg-red-500 hover:bg-red-700 p-3 rounded-md"
                >
                  Sign Out
                </button>
                <h1 className="text-4xl mb-5">CapyTube</h1>
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
                    to="/deletion"
                    className="text-blue-300 hover:text-blue-500"
                  >
                    Account Deletion
                  </Link>
                </nav>

                {/* Define Routes */}
                <Routes>
                  <Route
                    path="/"
                    element={<LiveStream streamId={streamId} />}
                  />
                  <Route path="/profile" element={<ProfilePage />} />{" "}
                  {/* Add profile route */}
                  <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                  <Route
                    path="/terms-of-service"
                    element={<TermsOfService />}
                  />
                  <Route path="/deletion" element={<DeletionInstructions />} />
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
