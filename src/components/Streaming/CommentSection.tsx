import React, { useState } from "react";

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
      <h4 style={{ fontWeight: "bold" }}>Comments</h4>
      <div style={styles.commentsList}>
        {comments.map((comment, index) => (
          <p key={index}>{comment}</p>
        ))}
      </div>
      <input
        type="text"
        value={newComment}
        onChange={(e) => setNewComment(e.target.value)}
        placeholder="Add a comment"
        style={styles.commentInput}
      />
      <button onClick={handleAddComment} style={styles.addButton}>
        Add Comment
      </button>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  commentSection: {
    marginTop: "10px",
    backgroundColor: "#f4f4f4",
    padding: "10px",
    borderRadius: "8px",
    color: "black",
  },
  commentsList: {
    marginBottom: "10px",
    maxHeight: "100px",
    overflowY: "auto", // This is correctly typed now
  },
  commentInput: {
    width: "100%",
    padding: "8px",
    marginBottom: "10px",
    borderRadius: "4px",
    border: "1px solid #ccc",
    color: "black",
  },
  addButton: {
    backgroundColor: "#007bff",
    color: "white",
    padding: "5px 10px",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
  },
};

export default CommentSection;
