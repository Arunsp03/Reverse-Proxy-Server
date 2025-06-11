import { redisClient } from "./redisclient";
import { createHash } from "node:crypto";
export const invalidateKeys = async (tagName: string) => {
  const keys = await redisClient.smembers(tagName);
  if (keys.length) {
    await redisClient.del(...keys);
  }
  await redisClient.del(tagName);
};

export const normalizeURLAndGenerateHash = (url: string) => {
  const urlObj = new URL(url);
  const orderedSearchParams = [...urlObj.searchParams.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("#");
  //console.log("orderded params ", orderedSearchParams);

  const normalizedPath = urlObj.pathname;
  const normalizedURL = orderedSearchParams
    ? `${normalizedPath}&${orderedSearchParams}`
    : normalizedPath;
  const hash = createHash("sha256").update(normalizedURL).digest("hex");
  return hash;
};
