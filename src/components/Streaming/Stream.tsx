import React from "react";
import LivepeerPlayer from "../LivepeerPlayer";
import CommentSection from "./CommentSection";
import EmojiSection from "./EmojiSection";

interface StreamProps {
  streamId: string;
  title: string;
  profilePic: string;
  comments: string[];
  onAddComment: (streamId: string, comment: string) => void;
  emojiCounts: { [emoji: string]: number };
  onEmojiClick: (streamId: string, emoji: string) => void;
}

const Stream: React.FC<StreamProps> = ({
  streamId,
  title,
  profilePic,
  comments,
  onAddComment,
  emojiCounts,
  onEmojiClick,
}) => {
  console.log("title", title);
  console.log("profilePic", profilePic);
  return (
    <div>
      {/* Add a wrapper with the 'video-container' class around the video */}
      <div className="video-container">
        <LivepeerPlayer streamId="fa7ahoikpf19u1e0" title="Magnus" />
      </div>

      {/* Other sections should remain outside the video-container */}
      <EmojiSection
        streamId={streamId}
        emojiCounts={emojiCounts}
        onEmojiClick={onEmojiClick}
      />
      <CommentSection
        streamId={streamId}
        comments={comments}
        onAddComment={onAddComment}
      />
    </div>
  );
};

export default Stream;
