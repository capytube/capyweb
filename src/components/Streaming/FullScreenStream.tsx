import React from "react";
import { useParams } from "react-router-dom";
import LiveStream from "./LiveStream"; // Assuming LiveStream is your component for rendering the video
import mainLogo from "../../assets/main-logo.svg";

const FullScreenStream: React.FC = () => {
  const { streamId, streamTitle } = useParams<{
    streamId: string;
    streamTitle: string;
  }>();

  return (
    <div style={styles.container as React.CSSProperties}>
      {/* Stream Info Section */}
      <div style={styles.streamInfo as React.CSSProperties}>
        <img src={mainLogo} alt="Logo" style={styles.logo} />
        <h1 style={styles.streamName}>{streamTitle}</h1>
      </div>

      {/* Live Stream Component */}
      <LiveStream
        streamId={streamId || ""}
        title={streamTitle || `Stream ${streamId}`}
        profilePic={mainLogo}
      />

      {/* Back Button */}
      <button
        style={styles.backButton as React.CSSProperties}
        onClick={() => window.history.back()}
      >
        Back
      </button>
    </div>
  );
};

const styles = {
  container: {
    display: "flex",
    flexDirection: "column" as "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
    backgroundColor: "#000",
    position: "relative", // To properly position the back button
  },
  streamInfo: {
    display: "flex",
    flexDirection: "row" as "row", // Row direction for logo and stream name
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "20px", // Space between the info and video
  },
  logo: {
    height: "50px", // Adjust as needed
    marginRight: "15px", // Space between the logo and stream name
  },
  streamName: {
    color: "white",
    fontSize: "24px",
    fontWeight: "bold",
  },
  backButton: {
    position: "absolute",
    top: "10px",
    left: "10px",
    backgroundColor: "#ff5733",
    color: "white",
    padding: "10px",
    borderRadius: "5px",
    border: "none",
    cursor: "pointer",
  },
};

export default FullScreenStream;
