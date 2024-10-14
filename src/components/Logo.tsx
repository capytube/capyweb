// src/components/Logo.tsx
import React from "react";
import mainlogo from "../assets/main-logo.svg"; // Adjust the path based on your project structure

const Logo: React.FC = () => {
  return <img src={mainlogo} alt="CapyTube logo" className="h-12 w-12" />;
};

export default Logo;
