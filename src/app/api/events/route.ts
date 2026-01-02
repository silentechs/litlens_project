import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createRedisSubscriber, isRedisConfigured } from "@/lib/redis";
import { eventBus, type SSEMessage } from "@/lib/events/publisher";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SendFn = (message: SSEMessage) => Promise<void>;

type Client = {
  id: string;
  channels: Set<string>;
  send: SendFn;
};

// ======== Connection Registry (per server instance) ========

const clients = new Map<string, Client>();
const channelToClientIds = new Map<string, Set<string>>();
const channelRefCounts = new Map<string, number>();

// ======== Redis Subscriber (single per server instance) ========

let redisSub: ReturnType<typeof createRedisSubscriber> | null = null;
let redisListenerAttached = false;

function attachRedisListener() {
  if (!redisSub || redisListenerAttached) return;
  redisListenerAttached = true;

  redisSub.on("message", (channel: string, raw: string) => {
    let message: SSEMessage | null = null;
    try {
      message = JSON.parse(raw) as SSEMessage;
    } catch {
      return;
    }
    broadcast(channel, message);
  });
}

function ensureRedisSubscriber() {
  if (!isRedisConfigured()) return;
  if (!redisSub) {
    redisSub = createRedisSubscriber();
    attachRedisListener();
  } else {
    attachRedisListener();
  }
}

function broadcast(channel: string, message: SSEMessage) {
  const ids = channelToClientIds.get(channel);
  if (!ids || ids.size === 0) return;

  for (const clientId of ids) {
    const client = clients.get(clientId);
    if (!client) continue;
    void client.send(message).catch(() => {
      // Best-effort cleanup on broken connection.
      unregisterClient(clientId);
    });
  }
}

async function subscribeChannel(channel: string) {
  // Redis path
  if (isRedisConfigured()) {
    ensureRedisSubscriber();
    if (!redisSub) return;
    await redisSub.subscribe(channel);
    return;
  }

  // In-memory fallback is handled via eventBus.subscribe per connection.
}

async function unsubscribeChannel(channel: string) {
  if (!isRedisConfigured()) return;
  if (!redisSub) return;
  await redisSub.unsubscribe(channel);
}

async function registerClient(client: Client) {
  clients.set(client.id, client);

  for (const channel of client.channels) {
    // Track membership
    if (!channelToClientIds.has(channel)) channelToClientIds.set(channel, new Set());
    channelToClientIds.get(channel)!.add(client.id);

    // Ref-count subscriptions
    const nextCount = (channelRefCounts.get(channel) || 0) + 1;
    channelRefCounts.set(channel, nextCount);

    if (nextCount === 1) {
      try {
        await subscribeChannel(channel);
      } catch (err) {
        console.error("[sse] failed to subscribe channel", { channel, err });
      }
    }
  }

  // In-memory fallback subscription (per client) when Redis isn't configured.
  if (!isRedisConfigured()) {
    for (const channel of client.channels) {
      const unsubscribe = eventBus.subscribe(channel, (message) => {
        void client.send(message).catch(() => unregisterClient(client.id));
      });
      // Store unsubscribe function on the client object
      // (safely via symbol to avoid leaking into serialized shapes)
      (client as unknown as { __unsub?: Array<() => void> }).__unsub = [
        ...(((client as unknown as { __unsub?: Array<() => void> }).__unsub) || []),
        unsubscribe,
      ];
    }
  }
}

function unregisterClient(clientId: string) {
  const client = clients.get(clientId);
  if (!client) return;

  // In-memory fallback unsubs
  const unsub = (client as unknown as { __unsub?: Array<() => void> }).__unsub;
  if (unsub) {
    unsub.forEach((fn) => {
      try {
        fn();
      } catch {
        // ignore
      }
    });
  }

  // Remove from channel mappings and ref-count
  for (const channel of client.channels) {
    channelToClientIds.get(channel)?.delete(clientId);
    if (channelToClientIds.get(channel)?.size === 0) {
      channelToClientIds.delete(channel);
    }

    const nextCount = (channelRefCounts.get(channel) || 1) - 1;
    if (nextCount <= 0) {
      channelRefCounts.delete(channel);
      if (isRedisConfigured()) {
        void unsubscribeChannel(channel).catch((err) => {
          console.error("[sse] failed to unsubscribe channel", { channel, err });
        });
      }
    } else {
      channelRefCounts.set(channel, nextCount);
    }
  }

  clients.delete(clientId);
}

// SSE endpoint - Temporarily disabled
export async function GET(request: Request) {
  return new Response("SSE Disabled", { status: 503 });
}
