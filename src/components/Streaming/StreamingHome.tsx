import React from "react";
import LiveStream from "./LiveStream";
import magnuspic from "../../assets/filled-magnus.svg";

interface StreamingHomeProps {
  title: string;
}

const StreamingHome: React.FC<StreamingHomeProps> = ({ title }) => {
  console.log(title);
  return (
    <div style={styles.gridContainer}>
      <div style={styles.gridItem}>
        <LiveStream
          streamId={"fa7ahoikpf19u1e0"}
          title={"magnus"}
          profilePic={magnuspic}
        />
      </div>
      <div style={styles.gridItem}>
        <LiveStream
          streamId={"fa7ahoikpf19u1e0"}
          title={"magnus"}
          profilePic={magnuspic}
        />
      </div>
      <div style={styles.gridItem}>
        <LiveStream
          streamId={"3ad581cgj5ahdc7z"}
          title={"mag3"}
          profilePic={magnuspic}
        />
      </div>
      <div style={styles.gridItem}>
        <LiveStream
          streamId={"3ad581cgj5ahdc7z"}
          title={"mag4"}
          profilePic={magnuspic}
        />
      </div>
    </div>
  );
};

const styles = {
  gridContainer: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)", // Define how many columns you want
    gap: "10px", // Gap between grid items
    padding: "10px",
  },
  gridItem: {
    backgroundColor: "#585d65",
    padding: "10px",
    borderRadius: "10px",
    boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
  },
};

export default StreamingHome;
