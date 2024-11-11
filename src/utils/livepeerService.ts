import { Livepeer } from "livepeer";

const livepeer = new Livepeer({
  apiKey: "3e2c0df0-f6bd-4a0b-8b1f-57fee7f68661",
});

export async function getViewershipData(playbackId: string) {
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
