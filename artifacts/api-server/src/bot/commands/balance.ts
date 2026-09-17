import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { db } from "@workspace/db";
import { resellersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export const data = new SlashCommandBuilder()
  .setName("balance")
  .setDescription("Check your reseller balance");

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const discordId = interaction.user.id;

  const [reseller] = await db
    .select()
    .from(resellersTable)
    .where(eq(resellersTable.discordId, discordId))
    .limit(1);

  if (!reseller) {
    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle("❌ Not a Reseller")
          .setDescription("You are not registered as a reseller. Contact an admin to get access."),
      ],
    });
  }

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("💰 Reseller Balance")
        .addFields(
          { name: "Account", value: reseller.username, inline: true },
          { name: "Balance", value: `**${reseller.balance}** credits`, inline: true },
        )
        .setTimestamp(),
    ],
  });
}
