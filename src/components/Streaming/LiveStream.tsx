import React, { useEffect, useState } from "react";
import {
  EnterFullscreenIcon,
  ExitFullscreenIcon,
  PauseIcon,
  PlayIcon,
} from "@livepeer/react/assets";
import * as Player from "@livepeer/react/player";
import { Src } from "@livepeer/react";
import { useLocation } from "react-router-dom";
import "./LiveStream.css";

interface LiveStreamProps {
  vodSource: Src[];
  title: string;
  viewerId: string;
}

const LiveStream = ({ vodSource, title, viewerId }: LiveStreamProps) => {
  const videoRef = React.useRef<any>(null);
  const { pathname } = useLocation();
  const isHomePage = pathname === "/";

  const dailyLimit = 10;

  const [playTime, setPlayTime] = useState<number>(() => {
    const savedPlayTime = localStorage.getItem("playTime");
    return savedPlayTime ? parseInt(savedPlayTime, 10) : 0;
  });

  const [coins, setCoins] = useState<number>(() => {
    const savedCoins = localStorage.getItem("coins");
    return savedCoins ? parseInt(savedCoins, 10) : 0;
  });

  const [isCoinRedeemable, setIsCoinRedeemable] = useState<boolean>(() => {
    const savedRedeemable = localStorage.getItem("isCoinRedeemable");
    return savedRedeemable ? JSON.parse(savedRedeemable) : false;
  });

  const [isCoinRedeemed] = useState<boolean>(() => {
    const savedRedeemed = localStorage.getItem("isCoinRedeemed");
    return savedRedeemed ? JSON.parse(savedRedeemed) : false;
  });

  useEffect(() => {
    // Save playTime and coins to localStorage when they change
    localStorage.setItem("playTime", playTime.toString());
    localStorage.setItem("coins", coins.toString());
  }, [playTime, coins]);

  useEffect(() => {
    localStorage.setItem("isCoinRedeemable", JSON.stringify(isCoinRedeemable));
    localStorage.setItem("isCoinRedeemed", JSON.stringify(isCoinRedeemed));
  }, [isCoinRedeemable, isCoinRedeemed]);

  const handleTimeUpdate = () => {
    if (videoRef.current && !videoRef.current.paused && !isCoinRedeemable) {
      setPlayTime((prev) => prev + 1); // Increment playTime by 1 second
    }
  };

  useEffect(() => {
    if (playTime >= 60 && !isCoinRedeemable) {
      // Increment coins per minute watched
      setCoins((prevCoins) => prevCoins + 1);
      setPlayTime(0); // Reset playTime after earning a coin
    }
  }, [playTime, isCoinRedeemable]);

  useEffect(() => {
    if (coins >= dailyLimit) {
      // can collect coins now
      setIsCoinRedeemable(true);
    }
  }, [coins]);

  useEffect(() => {
    const handlePauseVid = () => {
      if (
        document.hidden &&
        videoRef?.current &&
        !isHomePage
      ) {
        videoRef.current.pause();
      }
    };
    document.addEventListener("visibilitychange", handlePauseVid);

    return () => {
      document.removeEventListener("visibilitychange", handlePauseVid);
    };
  }, [isHomePage, pathname]);

  return (
    <Player.Root src={vodSource} autoPlay volume={0} viewerId={viewerId}>
      <Player.Container>
        <Player.Video
          ref={videoRef}
          title={title}
          style={{ height: "100%", width: "100%" }}
          onTimeUpdate={handleTimeUpdate}
        />
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
        {!isHomePage ? (
          <Player.Controls
            style={{
              background:
                "linear-gradient(to bottom, rgba(90, 90, 90, 0.2), rgba(82, 82, 82, 0.365))",
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
        ) : null}
      </Player.Container>
    </Player.Root>
  );
};

export default LiveStream;
