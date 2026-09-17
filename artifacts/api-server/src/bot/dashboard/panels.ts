import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  type APIEmbed,
} from "discord.js";
import type { Token, Job } from "@workspace/db";

// ─── MAIN PANEL ─────────────────────────────────────────────────────────────

export function buildMainEmbed(tokens: Token[], jobs: Job[]): EmbedBuilder {
  const totalActive = jobs.filter((j) => j.isActive).length;
  return new EmbedBuilder()
    .setTitle("📡 Dashboard Control Panel")
    .setColor(0x5865f2)
    .setDescription(
      tokens.length === 0
        ? "No tokens added yet. Click **➕ Add Token** to get started."
        : `**${tokens.length}** token${tokens.length !== 1 ? "s" : ""} · **${totalActive}** active job${totalActive !== 1 ? "s" : ""}`
    )
    .setFooter({ text: "Select a token below to manage it" })
    .setTimestamp();
}

export function buildMainComponents(tokens: Token[], userId: string) {
  const rows: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [];

  if (tokens.length > 0) {
    const select = new StringSelectMenuBuilder()
      .setCustomId(`d:seltk:${userId}`)
      .setPlaceholder("🔑 Pick a token to manage…")
      .addOptions(
        tokens.slice(0, 25).map((t) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(t.name.slice(0, 100))
            .setValue(String(t.id))
            .setDescription(`ID: ${t.id}`)
        )
      );
    rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select));
  }

  rows.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`d:saon:${userId}`).setLabel("▶ Start All").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`d:saoff:${userId}`).setLabel("⏹ Stop All").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`d:addtk:${userId}`).setLabel("➕ Add Token").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`d:ref:${userId}`).setLabel("🔄 Refresh").setStyle(ButtonStyle.Secondary),
    )
  );

  return rows;
}

// ─── TOKEN PANEL ─────────────────────────────────────────────────────────────

export function buildTokenEmbed(token: Token, jobs: Job[]): EmbedBuilder {
  const activeJobs = jobs.filter((j) => j.isActive).length;
  return new EmbedBuilder()
    .setTitle(`🔑 Token: ${token.name}`)
    .setColor(0xfee75c)
    .addFields(
      { name: "Jobs", value: `${jobs.length} total · ${activeJobs} active`, inline: true },
      { name: "Auto-Reply", value: token.autoReplyEnabled ? "✅ ON" : "❌ OFF", inline: true },
    )
    .setDescription(
      jobs.length === 0
        ? "No ad jobs yet. Click **➕ New Ad Job** to create one."
        : "Select a job below to view or edit it."
    )
    .setFooter({ text: `Token ID: ${token.id}` })
    .setTimestamp();
}

export function buildTokenComponents(token: Token, jobs: Job[], userId: string) {
  const rows: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [];

  if (jobs.length > 0) {
    const select = new StringSelectMenuBuilder()
      .setCustomId(`d:seljb:${token.id}:${userId}`)
      .setPlaceholder("📋 Pick a job to view/edit…")
      .addOptions(
        jobs.slice(0, 25).map((j) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(j.name.slice(0, 100))
            .setValue(String(j.id))
            .setDescription(`${j.isActive ? "🟢 Active" : "🔴 Stopped"} · ${j.channelIds.split(",").length} channels`)
        )
      );
    rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select));
  }

  rows.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`d:tkon:${token.id}:${userId}`).setLabel("▶ Start All Jobs").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`d:tkoff:${token.id}:${userId}`).setLabel("⏹ Stop All Jobs").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`d:tknew:${token.id}:${userId}`).setLabel("➕ New Ad Job").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`d:tkbk:${userId}`).setLabel("← Back").setStyle(ButtonStyle.Secondary),
    )
  );

  rows.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`d:tkrep:${token.id}:${userId}`)
        .setLabel(token.autoReplyEnabled ? "💬 Reply: ON" : "💬 Enable Reply")
        .setStyle(token.autoReplyEnabled ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`d:tkrn:${token.id}:${userId}`).setLabel("✏️ Rename").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`d:tkdel:${token.id}:${userId}`).setLabel("🗑️ Delete Token").setStyle(ButtonStyle.Danger),
    )
  );

  return rows;
}

// ─── JOB PANEL ───────────────────────────────────────────────────────────────

export function buildJobEmbed(job: Job): EmbedBuilder {
  const channels = job.channelIds.split(",").filter(Boolean);
  const images = job.images ? job.images.split(",").filter(Boolean) : [];

  return new EmbedBuilder()
    .setTitle(`📋 Job: ${job.name}`)
    .setColor(job.isActive ? 0x57f287 : 0xed4245)
    .addFields(
      { name: "Status", value: job.isActive ? "🟢 Active" : "🔴 Stopped", inline: true },
      { name: "Channels", value: `${channels.length}`, inline: true },
      { name: "Delay", value: job.delaySeconds > 0 ? `${job.delaySeconds}s` : "One-time", inline: true },
      { name: "Message", value: job.message.slice(0, 200) + (job.message.length > 200 ? "…" : "") },
    )
    .setDescription(
      channels.map((id) => `<#${id.trim()}>`).join(" ") || "No channels"
    )
    .addFields({ name: "Images", value: images.length > 0 ? images.length + " attached" : "None", inline: true })
    .setFooter({ text: `Job ID: ${job.id}` })
    .setTimestamp();
}

export function buildJobComponents(job: Job, tokenId: number, userId: string) {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`d:jbon:${job.id}:${tokenId}:${userId}`)
        .setLabel("▶ Start")
        .setStyle(ButtonStyle.Success)
        .setDisabled(job.isActive),
      new ButtonBuilder()
        .setCustomId(`d:jboff:${job.id}:${tokenId}:${userId}`)
        .setLabel("⏹ Stop")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!job.isActive),
      new ButtonBuilder().setCustomId(`d:jbedit:${job.id}:${tokenId}:${userId}`).setLabel("✏️ Edit").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`d:jbdel:${job.id}:${tokenId}:${userId}`).setLabel("🗑️ Delete").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`d:jbbk:${tokenId}:${userId}`).setLabel("← Back").setStyle(ButtonStyle.Secondary),
    ),
  ];
}
