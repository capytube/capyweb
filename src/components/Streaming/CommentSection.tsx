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

  return (
    <div style={styles.commentSection}>
      <h4 style={{ ...styles.text, fontWeight: "bold", fontSize: "24px" }}>
        Comments
      </h4>
      <div style={styles.commentsList}>
        {comments.map((comment, index) => (
          <p key={index} style={styles.text}>
            {comment}
          </p>
        ))}
      </div>
      <div style={styles.inputContainer}>
        <input
          type="text"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment"
          style={styles.commentInput}
        />
        <button onClick={handleAddComment} style={styles.addButton}>
          <img
            src={addCommentIcon}
            alt="Add Comment"
            style={styles.addButtonIcon}
          />
        </button>
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
  commentsList: {
    marginBottom: "10px",
    maxHeight: "200px",
    overflowY: "auto",
  },
  inputContainer: {
    display: "flex",
    alignItems: "center",
  },
  commentInput: {
    flex: 1,
    padding: "8px",
    marginRight: "10px",
    borderRadius: "4px",
    border: "1px solid #ccc",
    backgroundColor: "#FFFCDD",
    color: "#7A3F3E",
    fontSize: "16px",
    fontFamily: "'AdLaM Display', sans-serif",
  },
  addButton: {
    backgroundColor: "transparent",
    border: "none",
    cursor: "pointer",
    padding: 0,
  },
  addButtonIcon: {
    width: "24px",
    height: "24px",
  },
};

export default CommentSection;
