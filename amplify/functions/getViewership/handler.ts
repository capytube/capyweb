import { Livepeer } from "livepeer";
import type { Schema } from "../../data/resource";
import { env } from "$amplify/env/getViewership";

const livepeer = new Livepeer({
  apiKey: env.VITE_LIVEPEER_API_KEY!,
});

async function getViewershipData(playbackId: string) {
  try {
    const response = await livepeer.metrics.getViewership({
      playbackId: playbackId,
    });
    return response;
  } catch (error) {
    console.error("Failed to fetch viewership data:", error);
    return null;
  }
}

export const handler: Schema["getViewership"]["functionHandler"] = async (
  event
) => {
  const { streamId } = event.arguments;

  const viewershipData = await getViewershipData(streamId!);
  if (viewershipData) {
    return viewershipData;
  } else {
    return { error: "No viewership data found" };
  }
};
