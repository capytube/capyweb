import styles from './PublicStream.module.css';
import VideoPlayer from '../../VideoPlayer';

const PublicStream = () => {
  return (
    <div className={styles.publicStreamWrapper}>
      <h1>Public stream</h1>

      <div className={styles.publicStreamPlayerContainer}>
        <VideoPlayer
          streamId="public"
          videoUrl="https://magnus-video-public.s3.ap-southeast-1.amazonaws.com/capytube-stream.mp4"
        />
      </div>
    </div>
  );
};

export default PublicStream;
