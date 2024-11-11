import {
  EnterFullscreenIcon,
  ExitFullscreenIcon,
} from "@livepeer/react/assets";
import * as Player from "@livepeer/react/player";
import { Src } from "@livepeer/react";
import "./LiveStream.css";

interface LiveStreamProps {
  vodSource: Src[];
  title: string;
  viewerId: string;
}

const LiveStream = ({ vodSource, title, viewerId }: LiveStreamProps) => {
  return (
    <Player.Root src={vodSource} autoPlay volume={0} viewerId={viewerId}>
      <Player.Container>
        <Player.Video title={title} style={{ height: "100%", width: "100%" }} />
        <Player.FullscreenTrigger
          style={{
            position: "absolute",
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
      </Player.Container>
    </Player.Root>
  );
};

export default LiveStream;
