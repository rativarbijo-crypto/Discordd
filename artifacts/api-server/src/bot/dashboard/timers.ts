import { type Client } from "discord.js";
import { db } from "@workspace/db";
import { jobsTable, tokensTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../../lib/logger.js";

const DISCORD_API = "https://discord.com/api/v10";

const activeTimers = new Map<number, ReturnType<typeof setInterval>>();

export function isJobRunning(jobId: number): boolean {
  return activeTimers.has(jobId);
}

export async function startJob(client: Client, jobId: number): Promise<void> {
  if (activeTimers.has(jobId)) return;

  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, jobId)).limit(1);
  if (!job) return;

  const [token] = await db.select().from(tokensTable).where(eq(tokensTable.id, job.tokenId)).limit(1);
  if (!token) {
    logger.warn({ jobId }, "No token found for job — skipping");
    return;
  }

  await sendJobBroadcast(job, token.token);
  await db.update(jobsTable).set({ isActive: true, lastSentAt: new Date() }).where(eq(jobsTable.id, jobId));

  if (job.delaySeconds <= 0) return;

  const timer = setInterval(async () => {
    const [current] = await db.select().from(jobsTable).where(eq(jobsTable.id, jobId)).limit(1);
    if (!current || !current.isActive) {
      clearInterval(timer);
      activeTimers.delete(jobId);
      return;
    }
    const [tok] = await db.select().from(tokensTable).where(eq(tokensTable.id, current.tokenId)).limit(1);
    if (!tok) return;
    await sendJobBroadcast(current, tok.token);
    await db.update(jobsTable).set({ lastSentAt: new Date() }).where(eq(jobsTable.id, jobId));
  }, job.delaySeconds * 1000);

  activeTimers.set(jobId, timer);
}

export async function stopJob(jobId: number): Promise<void> {
  const timer = activeTimers.get(jobId);
  if (timer) {
    clearInterval(timer);
    activeTimers.delete(jobId);
  }
  await db.update(jobsTable).set({ isActive: false }).where(eq(jobsTable.id, jobId));
}

export async function sendJobBroadcast(
  job: { message: string; channelIds: string; images: string | null; name: string },
  accountToken: string
): Promise<void> {
  const channelIds = job.channelIds.split(",").map((s) => s.trim()).filter(Boolean);
  const images = job.images ? job.images.split(",").map((s) => s.trim()).filter(Boolean) : [];

  for (const channelId of channelIds) {
    try {
      // Build message content — include image URLs inline so Discord auto-embeds them
      const imageText = images.length > 0 ? "\n" + images.join("\n") : "";
      const content = job.message + imageText;

      const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
        method: "POST",
        headers: {
          "Authorization": accountToken,
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        body: JSON.stringify({ content }),
      });

      if (!res.ok) {
        const err = await res.text();
        logger.warn({ channelId, status: res.status, err }, "Failed to send message as account");
      }
    } catch (err) {
      logger.warn({ err, channelId }, "Error sending to channel");
    }
  }
}

export async function recoverActiveJobs(client: Client): Promise<void> {
  const activeJobs = await db.select().from(jobsTable).where(eq(jobsTable.isActive, true));
  for (const job of activeJobs) {
    if (job.delaySeconds > 0) {
      await startJob(client, job.id);
    }
  }
  logger.info({ count: activeJobs.length }, "Recovered active jobs");
}
