// src/App.tsx
import React from "react";
import LiveStream from "./components/LiveStream";
import { Authenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import "./App.css";

const App: React.FC = () => {
  const streamId = import.meta.env.VITE_LIVEPEER_STREAM_ID;

  return (
    <Authenticator>
      {({ signOut }) => (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
          <header className="bg-gray-800 p-6 rounded-lg shadow-md text-white max-w-3xl w-11/12">
            <h1 className="text-4xl mb-5">CapyTube</h1>
            <LiveStream streamId={streamId} />
          </header>
        </div>
      )}
    </Authenticator>
  );
};

export default App;
