import Redis from "ioredis";

/**
 * Redis (Upstash) client helpers.
 *
 * NOTE:
 * - Pub/Sub requires the TCP/TLS Redis URL (e.g. `rediss://...`), not the REST URL.
 * - Provide either `UPSTASH_REDIS_URL` (preferred) or `REDIS_URL`.
 */

const DISABLE_REDIS = true;

function getRedisUrl(): string | undefined {
  if (DISABLE_REDIS) return undefined;
  return process.env.UPSTASH_REDIS_URL || process.env.REDIS_URL;
}

export function isRedisConfigured(): boolean {
  if (DISABLE_REDIS) return false;
  return Boolean(getRedisUrl());
}

let publisherClient: Redis | null = null;

export function getRedisPublisher(): Redis | null {
  const url = getRedisUrl();
  if (!url) return null;

  if (!publisherClient) {
    publisherClient = new Redis(url, {
      // For long-lived connections / pubsub, avoid request retry amplification.
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    });

    publisherClient.on("error", (err) => {
      console.error("[redis] publisher error", err);
    });
  }

  return publisherClient;
}

export function createRedisSubscriber(): Redis | null {
  const url = getRedisUrl();
  if (!url) return null;

  const subscriber = new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });

  subscriber.on("error", (err) => {
    console.error("[redis] subscriber error", err);
  });

  return subscriber;
}


