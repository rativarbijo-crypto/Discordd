import {
  type ButtonInteraction,
  type StringSelectMenuInteraction,
  type ModalSubmitInteraction,
  type Client,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from "discord.js";
import { db } from "@workspace/db";
import { tokensTable, jobsTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { buildMainEmbed, buildMainComponents, buildTokenEmbed, buildTokenComponents, buildJobEmbed, buildJobComponents } from "./panels.js";
import { startJob, stopJob } from "./timers.js";
import { startUserClient, stopUserClient } from "./userClients.js";
import { logger } from "../../lib/logger.js";

// ─── HELPERS ─────────────────────────────────────────────────────────────────

async function requireUser(discordId: string) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.discordId, discordId)).limit(1);
  return user ?? null;
}

async function showMainPanel(interaction: ButtonInteraction | StringSelectMenuInteraction, userId: string) {
  const tokens = await db.select().from(tokensTable).where(eq(tokensTable.discordId, userId));
  const jobs = tokens.length > 0
    ? await db.select().from(jobsTable).where(eq(jobsTable.discordId, userId))
    : [];
  await interaction.editReply({
    embeds: [buildMainEmbed(tokens, jobs)],
    components: buildMainComponents(tokens, userId) as never,
  });
}

async function showTokenPanel(interaction: ButtonInteraction | StringSelectMenuInteraction, tokenId: number, userId: string) {
  const [token] = await db.select().from(tokensTable).where(eq(tokensTable.id, tokenId)).limit(1);
  if (!token || token.discordId !== userId) {
    await interaction.editReply({ content: "❌ Token not found.", embeds: [], components: [] });
    return;
  }
  const jobs = await db.select().from(jobsTable).where(eq(jobsTable.tokenId, tokenId));
  await interaction.editReply({
    embeds: [buildTokenEmbed(token, jobs)],
    components: buildTokenComponents(token, jobs, userId) as never,
  });
}

async function showJobPanel(interaction: ButtonInteraction | StringSelectMenuInteraction, jobId: number, tokenId: number, userId: string) {
  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, jobId)).limit(1);
  if (!job || job.discordId !== userId) {
    await interaction.editReply({ content: "❌ Job not found.", embeds: [], components: [] });
    return;
  }
  await interaction.editReply({
    embeds: [buildJobEmbed(job)],
    components: buildJobComponents(job, tokenId, userId) as never,
  });
}

// ─── BUTTON HANDLER ──────────────────────────────────────────────────────────

export async function handleButton(client: Client, interaction: ButtonInteraction) {
  const id = interaction.customId;
  const userId = interaction.user.id;

  if (!id.startsWith("d:")) return false;

  await interaction.deferUpdate();

  const user = await requireUser(userId);
  if (!user) {
    await interaction.editReply({ content: "❌ You need to redeem a key first (`/redeem_key`).", embeds: [], components: [] });
    return true;
  }

  // d:ref:{userId}
  if (id.startsWith("d:ref:")) {
    await showMainPanel(interaction, userId);
    return true;
  }

  // d:tkbk:{userId}
  if (id.startsWith("d:tkbk:")) {
    await showMainPanel(interaction, userId);
    return true;
  }

  // d:saon:{userId} — start all jobs
  if (id.startsWith("d:saon:")) {
    const jobs = await db.select().from(jobsTable).where(eq(jobsTable.discordId, userId));
    for (const job of jobs) await startJob(client, job.id);
    await showMainPanel(interaction, userId);
    return true;
  }

  // d:saoff:{userId} — stop all jobs
  if (id.startsWith("d:saoff:")) {
    const jobs = await db.select().from(jobsTable).where(eq(jobsTable.discordId, userId));
    for (const job of jobs) await stopJob(job.id);
    await showMainPanel(interaction, userId);
    return true;
  }

  // d:addtk:{userId} — open add token modal
  if (id.startsWith("d:addtk:")) {
    return true;
  }

  // d:tkon:{tokenId}:{userId} — start all jobs for token
  if (id.startsWith("d:tkon:")) {
    const [, , tokenId, uid] = id.split(":");
    const jobs = await db.select().from(jobsTable).where(eq(jobsTable.tokenId, Number(tokenId)));
    for (const job of jobs) await startJob(client, job.id);
    await showTokenPanel(interaction, Number(tokenId), uid ?? userId);
    return true;
  }

  // d:tkoff:{tokenId}:{userId} — stop all jobs for token
  if (id.startsWith("d:tkoff:")) {
    const [, , tokenId, uid] = id.split(":");
    const jobs = await db.select().from(jobsTable).where(eq(jobsTable.tokenId, Number(tokenId)));
    for (const job of jobs) await stopJob(job.id);
    await showTokenPanel(interaction, Number(tokenId), uid ?? userId);
    return true;
  }

  // d:tkrep:{tokenId}:{userId} — toggle reply or open reply modal
  if (id.startsWith("d:tkrep:")) {
    const [, , tokenId, uid] = id.split(":");
    // handled before deferUpdate — see index
    await showTokenPanel(interaction, Number(tokenId), uid ?? userId);
    return true;
  }

  // d:tkrn:{tokenId}:{userId} — handled before deferUpdate in index
  if (id.startsWith("d:tkrn:")) {
    return true;
  }

  // d:tknew:{tokenId}:{userId} — handled before deferUpdate in index
  if (id.startsWith("d:tknew:")) {
    return true;
  }

  // d:tkdel:{tokenId}:{userId} — delete token
  if (id.startsWith("d:tkdel:")) {
    const [, , tokenId, uid] = id.split(":");
    const jobs = await db.select().from(jobsTable).where(eq(jobsTable.tokenId, Number(tokenId)));
    for (const job of jobs) await stopJob(job.id);
    await db.delete(jobsTable).where(eq(jobsTable.tokenId, Number(tokenId)));
    await db.delete(tokensTable).where(and(eq(tokensTable.id, Number(tokenId)), eq(tokensTable.discordId, userId)));
    await showMainPanel(interaction, uid ?? userId);
    return true;
  }

  // d:jbon:{jobId}:{tokenId}:{userId} — start job
  if (id.startsWith("d:jbon:")) {
    const [, , jobId, tokenId, uid] = id.split(":");
    await startJob(client, Number(jobId));
    await showJobPanel(interaction, Number(jobId), Number(tokenId), uid ?? userId);
    return true;
  }

  // d:jboff:{jobId}:{tokenId}:{userId} — stop job
  if (id.startsWith("d:jboff:")) {
    const [, , jobId, tokenId, uid] = id.split(":");
    await stopJob(Number(jobId));
    await showJobPanel(interaction, Number(jobId), Number(tokenId), uid ?? userId);
    return true;
  }

  // d:jbedit:{jobId}:{tokenId}:{userId} — handled before deferUpdate in index
  if (id.startsWith("d:jbedit:")) {
    return true;
  }

  // d:jbdel:{jobId}:{tokenId}:{userId} — delete job
  if (id.startsWith("d:jbdel:")) {
    const [, , jobId, tokenId, uid] = id.split(":");
    await stopJob(Number(jobId));
    await db.delete(jobsTable).where(eq(jobsTable.id, Number(jobId)));
    await showTokenPanel(interaction, Number(tokenId), uid ?? userId);
    return true;
  }

  // d:jbbk:{tokenId}:{userId}
  if (id.startsWith("d:jbbk:")) {
    const [, , tokenId, uid] = id.split(":");
    await showTokenPanel(interaction, Number(tokenId), uid ?? userId);
    return true;
  }

  return false;
}

// ─── MODAL HANDLER — must call before deferUpdate ────────────────────────────

export async function handleButtonModal(client: Client, interaction: ButtonInteraction): Promise<boolean> {
  const id = interaction.customId;
  const userId = interaction.user.id;

  // d:addtk:{userId}
  if (id.startsWith("d:addtk:")) {
    const modal = new ModalBuilder()
      .setCustomId(`m:addtk:${userId}`)
      .setTitle("➕ Add Account");
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("name").setLabel("Name").setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder("e.g. Main")
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("token").setLabel("Value").setStyle(TextInputStyle.Paragraph).setRequired(true)
      ),
    );
    await interaction.showModal(modal);
    return true;
  }

  // d:tknew:{tokenId}:{userId}
  if (id.startsWith("d:tknew:")) {
    const [, , tokenId, uid] = id.split(":");
    const modal = new ModalBuilder()
      .setCustomId(`m:newjb:${tokenId}:${uid ?? userId}`)
      .setTitle("➕ New Ad Job");
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("name").setLabel("Job Name").setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder("e.g. Promo Ad #1")
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("message").setLabel("Message to Broadcast").setStyle(TextInputStyle.Paragraph).setRequired(true).setPlaceholder("Your ad message here…")
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("channel_ids").setLabel("Channel IDs (comma-separated)").setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder("123456, 789012")
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("delay").setLabel("Delay in seconds (0 = one-time)").setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder("60")
      ),
    );
    await interaction.showModal(modal);
    return true;
  }

  // d:tkrn:{tokenId}:{userId}
  if (id.startsWith("d:tkrn:")) {
    const [, , tokenId, uid] = id.split(":");
    const [token] = await db.select().from(tokensTable).where(eq(tokensTable.id, Number(tokenId))).limit(1);
    const modal = new ModalBuilder()
      .setCustomId(`m:rntk:${tokenId}:${uid ?? userId}`)
      .setTitle("✏️ Rename Token");
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("name").setLabel("New Name").setStyle(TextInputStyle.Short).setRequired(true).setValue(token?.name ?? "")
      ),
    );
    await interaction.showModal(modal);
    return true;
  }

  // d:tkrep:{tokenId}:{userId}
  if (id.startsWith("d:tkrep:")) {
    const [, , tokenId, uid] = id.split(":");
    const [token] = await db.select().from(tokensTable).where(eq(tokensTable.id, Number(tokenId))).limit(1);
    const modal = new ModalBuilder()
      .setCustomId(`m:setrep:${tokenId}:${uid ?? userId}`)
      .setTitle("💬 Auto-Reply Settings");
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("text")
          .setLabel("Auto-Reply Message (leave blank to disable)")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setValue(token?.autoReplyText ?? "")
          .setPlaceholder("Hi! I'll get back to you soon.")
      ),
    );
    await interaction.showModal(modal);
    return true;
  }

  // d:jbedit:{jobId}:{tokenId}:{userId}
  if (id.startsWith("d:jbedit:")) {
    const [, , jobId, tokenId, uid] = id.split(":");
    const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, Number(jobId))).limit(1);
    if (!job) return false;
    const modal = new ModalBuilder()
      .setCustomId(`m:editjb:${jobId}:${tokenId}:${uid ?? userId}`)
      .setTitle("✏️ Edit Job");
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("name").setLabel("Job Name").setStyle(TextInputStyle.Short).setRequired(true).setValue(job.name)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("message").setLabel("Message").setStyle(TextInputStyle.Paragraph).setRequired(true).setValue(job.message)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("channel_ids").setLabel("Channel IDs").setStyle(TextInputStyle.Short).setRequired(true).setValue(job.channelIds)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("delay").setLabel("Delay (seconds)").setStyle(TextInputStyle.Short).setRequired(false).setValue(String(job.delaySeconds))
      ),
    );
    await interaction.showModal(modal);
    return true;
  }

  return false;
}

// ─── SELECT MENU HANDLER ─────────────────────────────────────────────────────

export async function handleSelect(client: Client, interaction: StringSelectMenuInteraction) {
  const id = interaction.customId;
  const userId = interaction.user.id;

  if (!id.startsWith("d:")) return false;

  await interaction.deferUpdate();

  const user = await requireUser(userId);
  if (!user) {
    await interaction.editReply({ content: "❌ You need to redeem a key first.", embeds: [], components: [] });
    return true;
  }

  // d:seltk:{userId}
  if (id.startsWith("d:seltk:")) {
    const tokenId = Number(interaction.values[0]);
    await showTokenPanel(interaction, tokenId, userId);
    return true;
  }

  // d:seljb:{tokenId}:{userId}
  if (id.startsWith("d:seljb:")) {
    const [, , tokenId, uid] = id.split(":");
    const jobId = Number(interaction.values[0]);
    await showJobPanel(interaction, jobId, Number(tokenId), uid ?? userId);
    return true;
  }

  return false;
}

// ─── MODAL SUBMIT HANDLER ────────────────────────────────────────────────────

export async function handleModalSubmit(client: Client, interaction: ModalSubmitInteraction) {
  const id = interaction.customId;
  const userId = interaction.user.id;

  if (!id.startsWith("m:")) return false;

  await interaction.deferUpdate();

  // m:addtk:{userId}
  if (id.startsWith("m:addtk:")) {
    const name = interaction.fields.getTextInputValue("name").trim();
    const token = interaction.fields.getTextInputValue("token").trim();
    await db.insert(tokensTable).values({ discordId: userId, name, token });
    const tokens = await db.select().from(tokensTable).where(eq(tokensTable.discordId, userId));
    const jobs = await db.select().from(jobsTable).where(eq(jobsTable.discordId, userId));
    await interaction.editReply({
      embeds: [buildMainEmbed(tokens, jobs)],
      components: buildMainComponents(tokens, userId) as never,
    });
    return true;
  }

  // m:newjb:{tokenId}:{userId}
  if (id.startsWith("m:newjb:")) {
    const [, , tokenId, uid] = id.split(":");
    const name = interaction.fields.getTextInputValue("name").trim();
    const message = interaction.fields.getTextInputValue("message").trim();
    const channelIds = interaction.fields.getTextInputValue("channel_ids").split(/[\s,]+/).map((s) => s.trim().replace(/[<#>]/g, "")).filter(Boolean).join(",");
    const delayRaw = interaction.fields.getTextInputValue("delay").trim();
    const delay = delayRaw ? Math.max(0, parseInt(delayRaw, 10) || 0) : 0;

    await db.insert(jobsTable).values({
      tokenId: Number(tokenId),
      discordId: uid ?? userId,
      name,
      message,
      channelIds,
      delaySeconds: delay,
      isActive: false,
    });

    await showTokenPanel(interaction as never, Number(tokenId), uid ?? userId);
    return true;
  }

  // m:rntk:{tokenId}:{userId}
  if (id.startsWith("m:rntk:")) {
    const [, , tokenId, uid] = id.split(":");
    const name = interaction.fields.getTextInputValue("name").trim();
    await db.update(tokensTable).set({ name }).where(eq(tokensTable.id, Number(tokenId)));
    await showTokenPanel(interaction as never, Number(tokenId), uid ?? userId);
    return true;
  }

  // m:setrep:{tokenId}:{userId}
  if (id.startsWith("m:setrep:")) {
    const [, , tokenId, uid] = id.split(":");
    const text = interaction.fields.getTextInputValue("text").trim();
    const enabled = text.length > 0;

    await db.update(tokensTable).set({
      autoReplyEnabled: enabled,
      autoReplyText: enabled ? text : null,
    }).where(eq(tokensTable.id, Number(tokenId)));

    const [updated] = await db.select().from(tokensTable).where(eq(tokensTable.id, Number(tokenId))).limit(1);
    if (updated) {
      if (enabled) {
        startUserClient(updated.id, updated.token, text);
      } else {
        stopUserClient(updated.id);
      }
    }

    await showTokenPanel(interaction as never, Number(tokenId), uid ?? userId);
    return true;
  }

  // m:editjb:{jobId}:{tokenId}:{userId}
  if (id.startsWith("m:editjb:")) {
    const [, , jobId, tokenId, uid] = id.split(":");
    const name = interaction.fields.getTextInputValue("name").trim();
    const message = interaction.fields.getTextInputValue("message").trim();
    const channelIds = interaction.fields.getTextInputValue("channel_ids").split(/[\s,]+/).map((s) => s.trim().replace(/[<#>]/g, "")).filter(Boolean).join(",");
    const delayRaw = interaction.fields.getTextInputValue("delay").trim();
    const delay = delayRaw ? Math.max(0, parseInt(delayRaw, 10) || 0) : 0;

    await db.update(jobsTable).set({ name, message, channelIds, delaySeconds: delay }).where(eq(jobsTable.id, Number(jobId)));
    await showJobPanel(interaction as never, Number(jobId), Number(tokenId), uid ?? userId);
    return true;
  }

  return false;
}
