import WebSocket from "ws";
import { db } from "@workspace/db";
import { tokensTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../../lib/logger.js";

const DISCORD_API = "https://discord.com/api/v10";
const GATEWAY_URL = "wss://gateway.discord.gg/?v=10&encoding=json";

const OP_DISPATCH = 0;
const OP_HEARTBEAT = 1;
const OP_IDENTIFY = 2;
const OP_RESUME = 6;
const OP_HELLO = 10;
const OP_HEARTBEAT_ACK = 11;

// DM_MESSAGES + GUILD_MESSAGES + MESSAGE_CONTENT (for user accounts)
// User accounts use 0 for intents but still receive DMs natively — we omit intents entirely
const USER_IDENTIFY_PROPERTIES = {
  os: "Windows",
  browser: "Discord Client",
  device: "",
  system_locale: "en-US",
  browser_version: "30.0.0",
  os_version: "10",
  release_channel: "stable",
  client_build_number: 367701,
};

interface UserClient {
  ws: WebSocket;
  heartbeatInterval: ReturnType<typeof setInterval> | null;
  heartbeatAcked: boolean;
  seq: number | null;
  sessionId: string | null;
  selfId: string | null;
  reconnecting: boolean;
}

const clients = new Map<number, UserClient>();

export function isUserClientRunning(tokenId: number): boolean {
  return clients.has(tokenId);
}

export function startUserClient(tokenId: number, accountToken: string, replyText: string): void {
  stopUserClient(tokenId);
  connectUserClient(tokenId, accountToken, replyText, null, null);
}

function connectUserClient(
  tokenId: number,
  accountToken: string,
  replyText: string,
  sessionId: string | null,
  seq: number | null,
): void {
  let ws: WebSocket;
  try {
    ws = new WebSocket(GATEWAY_URL);
  } catch (err) {
    logger.warn({ err, tokenId }, "Failed to create WebSocket");
    scheduleReconnect(tokenId, accountToken, replyText);
    return;
  }

  const client: UserClient = {
    ws,
    heartbeatInterval: null,
    heartbeatAcked: true,
    seq,
    sessionId,
    selfId: null,
    reconnecting: false,
  };
  clients.set(tokenId, client);

  ws.on("open", () => {
    logger.info({ tokenId }, "User client WebSocket opened");
  });

  ws.on("message", async (raw) => {
    let payload: { op: number; d: Record<string, unknown> | null; s: number | null; t: string | null };
    try {
      payload = JSON.parse(raw.toString());
    } catch {
      return;
    }

    const { op, d, s, t } = payload;
    if (s !== null) client.seq = s;

    switch (op) {
      case OP_HELLO: {
        const interval = (d as { heartbeat_interval: number }).heartbeat_interval;

        // Send first heartbeat immediately (jittered)
        const jitter = Math.floor(Math.random() * interval);
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ op: OP_HEARTBEAT, d: client.seq }));
          }
        }, jitter);

        client.heartbeatInterval = setInterval(() => {
          if (!client.heartbeatAcked) {
            // Zombied connection — reconnect
            logger.warn({ tokenId }, "Heartbeat not acked — reconnecting");
            ws.terminate();
            return;
          }
          client.heartbeatAcked = false;
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ op: OP_HEARTBEAT, d: client.seq }));
          }
        }, interval);

        if (sessionId && seq !== null) {
          // Resume
          ws.send(JSON.stringify({
            op: OP_RESUME,
            d: { token: accountToken, session_id: sessionId, seq },
          }));
        } else {
          // Fresh identify — no intents for user accounts (they receive DMs natively)
          ws.send(JSON.stringify({
            op: OP_IDENTIFY,
            d: {
              token: accountToken,
              capabilities: 16381,
              properties: USER_IDENTIFY_PROPERTIES,
              presence: { status: "online", since: 0, activities: [], afk: false },
              compress: false,
            },
          }));
        }
        break;
      }

      case OP_HEARTBEAT_ACK: {
        client.heartbeatAcked = true;
        break;
      }

      case OP_HEARTBEAT: {
        // Server requested heartbeat
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ op: OP_HEARTBEAT, d: client.seq }));
        }
        break;
      }

      case OP_DISPATCH: {
        if (t === "READY") {
          const readyData = d as { user: { id: string; username: string }; session_id: string };
          client.selfId = readyData.user.id;
          client.sessionId = readyData.session_id;
          logger.info({ tokenId, username: readyData.user.username }, "User client ready — listening for DMs");
        }

        if (t === "MESSAGE_CREATE") {
          const msg = d as {
            id: string;
            guild_id?: string;
            channel_id: string;
            author: { id: string; bot?: boolean };
            content: string;
          };

          // Only DMs (no guild_id), not from self, not from bots
          if (msg.guild_id !== undefined && msg.guild_id !== null) return;
          if (!client.selfId || msg.author.id === client.selfId) return;
          if (msg.author.bot) return;

          logger.info({ tokenId, channelId: msg.channel_id }, "Received DM — sending auto-reply");
          await sendAutoReply(msg.channel_id, accountToken, replyText, msg.id);
        }
        break;
      }
    }
  });

  ws.on("close", (code) => {
    if (client.heartbeatInterval) clearInterval(client.heartbeatInterval);

    logger.info({ tokenId, code }, "User client closed");

    // 4004 = auth failed, 4010/4011/4012/4013/4014 = non-resumable errors
    const fatal = [4004, 4010, 4011, 4012, 4013, 4014].includes(code);
    if (fatal) {
      clients.delete(tokenId);
      logger.warn({ tokenId, code }, "User client fatal error — not reconnecting");
      return;
    }

    if (!client.reconnecting) {
      client.reconnecting = true;
      const savedSession = client.sessionId;
      const savedSeq = client.seq;
      clients.delete(tokenId);
      scheduleReconnect(tokenId, accountToken, replyText, savedSession ?? undefined, savedSeq ?? undefined);
    }
  });

  ws.on("error", (err) => {
    logger.warn({ err, tokenId }, "User client WebSocket error");
  });
}

function scheduleReconnect(
  tokenId: number,
  accountToken: string,
  replyText: string,
  sessionId?: string,
  seq?: number,
  delayMs = 5000,
): void {
  logger.info({ tokenId, delayMs }, "Scheduling user client reconnect");
  setTimeout(() => {
    connectUserClient(tokenId, accountToken, replyText, sessionId ?? null, seq ?? null);
  }, delayMs);
}

export function stopUserClient(tokenId: number): void {
  const client = clients.get(tokenId);
  if (client) {
    if (client.heartbeatInterval) clearInterval(client.heartbeatInterval);
    client.reconnecting = true; // prevent auto-reconnect
    try { client.ws.close(1000); } catch { /* ignore */ }
    clients.delete(tokenId);
    logger.info({ tokenId }, "User client stopped");
  }
}

async function sendAutoReply(
  channelId: string,
  accountToken: string,
  replyText: string,
  messageId: string,
): Promise<void> {
  try {
    const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
      method: "POST",
      headers: {
        Authorization: accountToken,
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        "X-Super-Properties": Buffer.from(JSON.stringify(USER_IDENTIFY_PROPERTIES)).toString("base64"),
      },
      body: JSON.stringify({
        content: replyText,
        message_reference: { message_id: messageId, fail_if_not_exists: false },
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      logger.warn({ status: res.status, body }, "Auto-reply REST failed");
    }
  } catch (err) {
    logger.warn({ err, channelId }, "Auto-reply fetch error");
  }
}

export async function syncUserClients(): Promise<void> {
  const tokens = await db.select().from(tokensTable);
  for (const token of tokens) {
    if (token.autoReplyEnabled && token.autoReplyText) {
      startUserClient(token.id, token.token, token.autoReplyText);
    } else {
      stopUserClient(token.id);
    }
  }
  const active = tokens.filter((t) => t.autoReplyEnabled).length;
  logger.info({ active }, "Synced user clients for auto-reply");
}
