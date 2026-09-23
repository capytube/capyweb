import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const ssm = new SSMClient({});
let cachedKey: string | undefined;

async function livepeerKey(): Promise<string> {
  if (cachedKey) return cachedKey;
  const out = await ssm.send(
    new GetParameterCommand({ Name: process.env.LIVEPEER_PARAM, WithDecryption: true }),
  );
  cachedKey = out.Parameter?.Value ?? "";
  return cachedKey;
}

const json = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: { "content-type": "application/json", "cache-control": "max-age=15" },
  body: JSON.stringify(body),
});

type Evt = { rawPath?: string; pathParameters?: { id?: string } };

export const handler = async (event: Evt) => {
  const id = event.pathParameters?.id ?? "";
  if (!/^[a-zA-Z0-9_-]{4,64}$/.test(id)) return json(400, { error: "bad id" });
  const key = await livepeerKey();
  const isViewership = (event.rawPath ?? "").includes("/viewership/");
  const url = isViewership
    ? `https://livepeer.studio/api/data/views/query?playbackId=${encodeURIComponent(id)}`
    : `https://livepeer.studio/api/playback/${encodeURIComponent(id)}`;
  const res = await fetch(url, { headers: { authorization: `Bearer ${key}` } });
  if (!res.ok) return json(502, { error: `livepeer ${res.status}` });
  return json(200, await res.json());
};
