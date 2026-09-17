import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { db } from "@workspace/db";
import { tokensTable, jobsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { buildMainEmbed, buildMainComponents } from "../dashboard/panels.js";

export const data = new SlashCommandBuilder()
  .setName("dashboard")
  .setDescription("Open the dashboard control panel");

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const discordId = interaction.user.id;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.discordId, discordId)).limit(1);
  if (!user) {
    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle("❌ Not Authorized")
          .setDescription("You need to redeem a key first. Use `/redeem_key`."),
      ],
    });
  }

  const tokens = await db.select().from(tokensTable).where(eq(tokensTable.discordId, discordId));
  const jobs = tokens.length > 0
    ? await db.select().from(jobsTable).where(eq(jobsTable.discordId, discordId))
    : [];

  await interaction.editReply({
    embeds: [buildMainEmbed(tokens, jobs)],
    components: buildMainComponents(tokens, discordId) as never,
  });
}
