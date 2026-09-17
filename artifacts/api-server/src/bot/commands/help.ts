import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("help")
  .setDescription("Show all available commands and how to use them");

export async function execute(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setTitle("📋 Bot Commands")
    .setColor(0x5865f2)
    .addFields(
      {
        name: "🚀 Getting Started",
        value: [
          "`/redeem_key <key>` — Redeem a key to activate your account",
          "`/help` — Show this help message",
          "`/oauth_link` — Get the bot invite link",
        ].join("\n"),
      },
      {
        name: "⚙️ Setup",
        value: [
          "`/settoken <key> <token>` — Link your Discord bot token (key required)",
        ].join("\n"),
      },
      {
        name: "📡 Dashboard",
        value: [
          "`/dashboard <message> <channel_ids> [delay] [image1-5]` — Broadcast a message to multiple channels",
          "• `delay` = seconds between full broadcast cycles",
          "• `channel_ids` = comma-separated channel IDs",
          "• Up to 5 images can be attached",
        ].join("\n"),
      },
      {
        name: "💼 Reseller",
        value: [
          "`/balance` — Check your reseller balance",
          "`/reseller_gen <amount>` — Generate keys (costs balance)",
          "`/transfer_reseller <user> <amount>` — Transfer balance to another reseller",
        ].join("\n"),
      },
    )
    .setFooter({ text: "Use /redeem_key to get started" })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
