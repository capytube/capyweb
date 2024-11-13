import {
  EnterFullscreenIcon,
  ExitFullscreenIcon,
  PauseIcon,
  PlayIcon,
} from '@livepeer/react/assets';
import * as Player from '@livepeer/react/player';
import { Src } from '@livepeer/react';
import './LiveStream.css';
import React from 'react';

interface LiveStreamProps {
  vodSource: Src[];
  title: string;
  viewerId: string;
}

const LiveStream = ({ vodSource, title, viewerId }: LiveStreamProps) => {
  const videoRef = React.useRef<any>(null);

  React.useEffect(() => {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible' && videoRef?.current) {
        videoRef.current.pause();
      }
    });
  }, []);

  return (
    <Player.Root src={vodSource} autoPlay volume={0} viewerId={viewerId}>
      <Player.Container>
        <Player.Video
          ref={videoRef}
          title={title}
          style={{ height: '100%', width: '100%' }}
          // onTimeUpdate={(e) => console.log(e)}
        />
        <Player.FullscreenTrigger
          style={{
            position: 'absolute',
            left: 20,
            bottom: 20,
            width: 25,
            height: 25,
          }}
        >
          <Player.FullscreenIndicator asChild matcher={false}>
            <EnterFullscreenIcon />
          </Player.FullscreenIndicator>
          <Player.FullscreenIndicator asChild>
            <ExitFullscreenIcon />
          </Player.FullscreenIndicator>
        </Player.FullscreenTrigger>
        <Player.Controls
          style={{
            background:
              'linear-gradient(to bottom, rgba(90, 90, 90, 0.2), rgba(82, 82, 82, 0.365))',
          }}
          className="py-2 px-4 flex flex-col-reverse gap-5 justify-center items-center inset-0"
        >
          <Player.PlayPauseTrigger className="pt-4">
            <Player.PlayingIndicator asChild matcher={false}>
              <PlayIcon className="size-20 text-cream" />
            </Player.PlayingIndicator>
            <Player.PlayingIndicator asChild>
              <PauseIcon className="size-20 text-cream" />
            </Player.PlayingIndicator>
          </Player.PlayPauseTrigger>
        </Player.Controls>
      </Player.Container>
    </Player.Root>
  );
};

export default LiveStream;
