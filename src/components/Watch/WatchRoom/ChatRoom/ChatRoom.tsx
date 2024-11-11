import { useState } from "react";
import styles from "./ChatRoom.module.css";
import sendBtn from "../../../../assets/sendBtn.svg";

const ChatRoom = () => {
  const [messages, setMessages] = useState([
    "Great stream!",
    "Love the content!",
    "Can't wait for the next one!",
    "helloooo there",
  ]);
  const [input, setInput] = useState("");

  const handleInputChange = (e: any) => {
    setInput(e.target.value);
  };

  const handleSendMessage = () => {
    if (input.trim()) {
      setMessages([...messages, input]);
      setInput("");
    }
  };

  return (
    <div className={styles.chatRoom}>
      <div className={styles.chatHeader}>Chat room</div>
      <div className={styles.messages}>
        {messages.map((msg, index) => (
          <div key={index} className={styles.message}>
            <span className={styles.username}>username1:</span> {msg}
          </div>
        ))}
      </div>
      <div className={styles.inputContainer}>
        <input
          type="text"
          value={input}
          onChange={handleInputChange}
          placeholder="helloooo there"
          className={styles.input}
        />
        <button onClick={handleSendMessage} className={styles.sendButton}>
          <img src={sendBtn} alt="send" />
        </button>
      </div>
    </div>
  );
};

export default ChatRoom;
