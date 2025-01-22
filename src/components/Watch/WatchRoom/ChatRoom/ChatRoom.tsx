import { useEffect, useState } from 'react';
import { useAtomValue } from 'jotai';
import { useIsLoggedIn } from '@dynamic-labs/sdk-react-core';
import styles from './ChatRoom.module.css';
import sendBtn from '../../../../assets/sendBtn.svg';
import { userAtom } from '../../../../store/atoms/userAtom';
import { chatCommentsAtom } from '../../../../store/atoms/chatCommentsAtom';
import { createChatComment, listAllComments } from '../../../../api/chatComments';

interface ChatRoomProps {
  streamId: string;
}

const ChatRoom = ({ streamId }: ChatRoomProps) => {
  const isLoggedIn = useIsLoggedIn();
  const comments = useAtomValue(chatCommentsAtom);
  const userData = useAtomValue(userAtom);

  const [input, setInput] = useState('');

  const getComments = async () => {
    await listAllComments({ streamId });
  };

  useEffect(() => {
    if (isLoggedIn) getComments();
  }, [isLoggedIn, streamId]);

  useEffect(() => {
    if (isLoggedIn && comments?.length > 0) {
      scrollToLatestComment();
    }
  }, [isLoggedIn, comments]);

  const scrollToLatestComment = () => {
    const messagesContainer = document.getElementById('messages-container');
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  };

  const handleInputChange = (e: any) => {
    setInput(e.target.value);
  };

  const handleSendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (input.trim()) {
      if (isLoggedIn && streamId && userData?.id) {
        const response = await createChatComment({
          stream_id: streamId,
          user_id: userData?.id,
          content: input,
        });
        if (response?.data?.id) {
          await getComments();

          // scroll to the latest comment
          setTimeout(() => {
            scrollToLatestComment();
          }, 800);
        }
      }
      setInput('');
    }
  };

  const renderCommentsContent = () => {
    if (isLoggedIn) {
      if (comments?.length > 0) {
        const sortedComments = [...comments].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
        return sortedComments?.map((comment) => (
          <div key={comment?.id} className={styles.message}>
            <span className={styles.username}>{comment?.user?.username}: </span>
            {comment?.content}
          </div>
        ));
      } else {
        return <span className="font-comic">Be the first one to comment!</span>;
      }
    } else {
      return <span className="font-comic">Please login to view comments</span>;
    }
  };

  return (
    <div className={styles.chatRoom}>
      <div className={styles.chatHeader}>Chat room</div>
      <div className={styles.messages} id="messages-container">
        {renderCommentsContent()}
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
