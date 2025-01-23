import React from "react";
import ReactDOM from "react-dom/client";
import { Toaster } from 'react-hot-toast';
import App from "./App.tsx";
import "./index.css";
import { Web3Provider } from "./Web3Provider.tsx";

import { Amplify } from "aws-amplify";
import outputs from "../amplify_outputs.json";

Amplify.configure(outputs);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Web3Provider>
      <App />
      <Toaster position="top-right" reverseOrder={false}/>
    </Web3Provider>
  </React.StrictMode>
);
