import React, { useState } from "react";
import styles from "./ChatRoom.module.css";
import sendBtn from "../../../../assets/sendBtn.svg";
import { useAtom } from "jotai";
import { commentsAtom } from "../../../../atoms/atom";
import { addComment, getListOfComments } from "../../../../utils/api";
import { useIsLoggedIn } from "@dynamic-labs/sdk-react-core";
import { useAccount } from "wagmi";

const ChatRoom = () => {
  const isLoggedIn = useIsLoggedIn();
  const [input, setInput] = useState("");
  const [comments] = useAtom(commentsAtom);
  const { address } = useAccount();

  const getComments = async () => {
    await getListOfComments({ streamId: "fa7ahoikpf19u1e9" });
  };

  React.useEffect(() => {
    if (isLoggedIn) getComments();
  }, [isLoggedIn]);

  const handleInputChange = (e: any) => {
    setInput(e.target.value);
  };

  const handleSendMessage = async () => {
    if (input.trim()) {
      if (address) {
        const response = await addComment({
          streamId: "fa7ahoikpf19u1e9",
          content: input,
          userId: address,
        });
        if (response?.data?.id) {
          await getComments();
        }
      }
      setInput("");
    }
  };

  return (
    <div className={styles.chatRoom}>
      <div className={styles.chatHeader}>Chat room</div>
      <div className={styles.messages}>
        {isLoggedIn
          ? comments?.length > 0 && comments?.[0]?.id
            ? comments?.map((comment) => (
                <div key={comment?.id} className={styles.message}>
                  <span className={styles.username}>
                    {comment?.user?.name}:
                  </span>
                  {comment?.content}
                </div>
              ))
            : "Be the first one to comment!"
          : "Please login to view comments"}
      </div>
      <div className={styles.inputContainer}>
        <input
          type="text"
          value={input}
          onChange={handleInputChange}
          placeholder="Enter Text here..."
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
