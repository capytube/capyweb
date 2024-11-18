import React, { useState } from "react";
import styles from "./ChatRoom.module.css";
import sendBtn from "../../../../assets/sendBtn.svg";
import { useAtom } from "jotai";
import { commentsAtom } from "../../../../atoms/atom";
import { addComment, getListOfComments } from "../../../../utils/api";
import { useIsLoggedIn } from "@dynamic-labs/sdk-react-core";
import { useAccount } from "wagmi";

interface ChatRoomProps {
  streamId: string;
}

const ChatRoom = ({ streamId }: ChatRoomProps) => {
  const isLoggedIn = useIsLoggedIn();
  const [input, setInput] = useState("");
  const [comments] = useAtom(commentsAtom);
  const { address } = useAccount();

  const getComments = async () => {
    await getListOfComments({ streamId });
  };

  React.useEffect(() => {
    if (isLoggedIn) getComments();
  }, [isLoggedIn]);

  const handleInputChange = (e: any) => {
    setInput(e.target.value);
  };

  const handleSendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (input.trim()) {
      if (address) {
        const response = await addComment({
          streamId,
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
        {isLoggedIn ? (
          comments?.length > 0 && comments?.[0]?.id ? (
            comments?.map((comment) => (
              <div key={comment?.id} className={styles.message}>
                <span className={styles.username}>{comment?.user?.name}: </span>
                {comment?.content}
              </div>
            ))
          ) : (
            <span className="font-comic">Be the first one to comment!</span>
          )
        ) : (
          <span className="font-comic">Please login to view comments</span>
        )}
      </div>
      <form onSubmit={(e) => handleSendMessage(e)}>
        <div className={styles.inputContainer}>
          <input
            type="text"
            value={input}
            onChange={handleInputChange}
            placeholder="Enter Text here..."
            className={styles.input}
          />
          <button type="submit" className={styles.sendButton}>
            <img src={sendBtn} alt="send" />
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChatRoom;
