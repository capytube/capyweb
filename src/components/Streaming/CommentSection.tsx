import React, { useState } from "react";
import addCommentIcon from "../../assets/add-comment.svg"; // Make sure this path is correct

interface CommentSectionProps {
  streamId: string;
  comments: string[];
  onAddComment: (streamId: string, comment: string) => void;
}

const CommentSection: React.FC<CommentSectionProps> = ({
  streamId,
  comments,
  onAddComment,
}) => {
  const [newComment, setNewComment] = useState("");

  const handleAddComment = () => {
    if (newComment) {
      onAddComment(streamId, newComment);
      setNewComment(""); // Clear the input after adding the comment
    }
  };

  // Updated placeholder comments with usernames
  const placeholderComments = [
    { username: "StreamFan123", comment: "Great stream!" },
    { username: "ContentLover", comment: "Love the content!" },
    { username: "EagerViewer", comment: "Can't wait for the next one!" },
  ];

  const allComments = [
    ...comments.map((comment) => ({ username: "User", comment })),
    ...placeholderComments,
  ];

  return (
    <div style={styles.commentSection}>
      <h4 style={{ ...styles.text, fontWeight: "bold", fontSize: "12px" }}>
        Comments
      </h4>
      <div style={styles.commentLayout}>
        <div style={styles.inputWrapper}>
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment"
            style={styles.commentInput}
            rows={2} // Changed from 4 to 2
          />
          <button onClick={handleAddComment} style={styles.addButton}>
            <img
              src={addCommentIcon}
              alt="Add Comment"
              style={styles.addButtonIcon}
            />
          </button>
        </div>
        <div style={styles.commentsList}>
          {allComments.map((comment, index) => (
            <div key={index} style={styles.commentItem}>
              <span style={styles.username}>{comment.username}</span>
              <span style={styles.commentText}>{comment.comment}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  commentSection: {
    marginTop: "10px",
    backgroundColor: "transparent",
    padding: "10px",
    borderRadius: "8px",
    color: "#7A3F3E",
    fontFamily: "'AdLaM Display', sans-serif",
  },
  text: {
    fontSize: "16px",
    fontFamily: "'AdLaM Display', sans-serif",
    color: "#7A3F3E",
  },
  commentLayout: {
    display: "flex",
    justifyContent: "space-between",
  },
  inputWrapper: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    width: "45%",
  },
  inputButtonWrapper: {
    display: "flex",
    width: "100%",
    alignItems: "flex-start",
  },
  commentInput: {
    flex: 1,
    padding: "8px",
    marginRight: "10px",
    borderRadius: "4px",
    border: "2px solid #7A3F3E",
    backgroundColor: "#FFFCDD",
    color: "#7A3F3E",
    fontSize: "14px", // Changed from 16px to 14px
    fontFamily: "'AdLaM Display', sans-serif",
    resize: "vertical",
  },
  addButton: {
    backgroundColor: "transparent",
    border: "none",
    cursor: "pointer",
    padding: 0,
    display: "flex",
    alignItems: "flex-start",
  },
  addButtonIcon: {
    width: "120px", // Doubled from 60px to 120px
    height: "120px", // Doubled from 60px to 120px
  },
  commentsList: {
    width: "45%",
    marginBottom: "10px",
    maxHeight: "200px",
    overflowY: "auto",
  },
  commentItem: {
    display: "flex",
    alignItems: "center",
    marginBottom: "8px",
  },
  username: {
    fontWeight: "bold",
    marginRight: "8px",
    fontSize: "14px",
    fontFamily: "'AdLaM Display', sans-serif",
    color: "#7A3F3E",
  },
  commentText: {
    fontWeight: "normal",
    fontSize: "14px",
    fontFamily: "'AdLaM Display', sans-serif",
    color: "#7A3F3E",
  },
};

export default CommentSection;
