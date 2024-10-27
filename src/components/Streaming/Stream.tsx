import React from "react";
import LiveStream from "./LiveStream";
import CommentSection from "./CommentSection";
import EmojiSection from "./EmojiSection";

interface StreamProps {
  streamId: string;
  title: string;
  profilePic: string;
  comments: string[];
  onAddComment: (streamId: string, comment: string) => void;
  emojis: string[];
  emojiCounts: { [emoji: string]: number };
  onEmojiClick: (streamId: string, emoji: string) => void;
}

const Stream: React.FC<StreamProps> = ({
  streamId,
  title,
  profilePic,
  comments,
  onAddComment,
  emojis,
  emojiCounts,
  onEmojiClick,
}) => {
  return (
    <div>
      {/* Add a wrapper with the 'video-container' class around the video */}
      <div className="video-container">
        <LiveStream streamId={streamId} title={title} profilePic={profilePic} />
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
