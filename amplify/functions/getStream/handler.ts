import type { Handler } from "aws-lambda";
import { Livepeer } from "livepeer";
import { getSrc } from "@livepeer/react/external";
import type { Schema } from "../../data/resource";
import { env } from "$amplify/env/getStream";

const livepeer = new Livepeer({
  apiKey: env.VITE_LIVEPEER_API_KEY!,
});
async function getSourceForPlaybackId(playbackId: string) {
  const response = await livepeer.playback.get(playbackId);

  // the return value can be passed directly to the Player as `src`
  return getSrc(response.playbackInfo);
}

export const handler: Schema["getStream"]["functionHandler"] = async (
  event
) => {
  // your function code goes here
  const { streamId } = event.arguments;
  console.log("streamId is ", streamId);
  const playSrc = await getSourceForPlaybackId(streamId!);
  console.log("playSrc is ", playSrc);
  const playSrcString = JSON.stringify(playSrc);
  console.log("playSrcString is ", playSrcString);
  return playSrcString;
};
