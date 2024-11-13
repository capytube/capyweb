import { Livepeer } from "livepeer";

const livepeer = new Livepeer({
  apiKey: "7f09548e-4e52-4744-9c85-6f00eb999b62",
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
