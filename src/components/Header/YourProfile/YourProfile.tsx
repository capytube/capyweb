import { useState } from "react";
import styles from "./YourProfile.module.css";

const YourProfile = () => {
  const [name, setName] = useState("");

  const onSaveHandler = () => {
    console.log("name", name);
    setName("");
  };

  return (
    <div className={styles.yourProfileContainer}>
      <h2>Your Profile</h2>
      <div className={styles.yourProfile__inputBox}>
        <p>Display name</p>
        <input
          type="text"
          placeholder="your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <button className={styles.profileSaveBtn} onClick={onSaveHandler}>
        Save
      </button>
    </div>
  );
};

export default YourProfile;
