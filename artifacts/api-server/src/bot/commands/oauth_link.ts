import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("oauth_link")
  .setDescription("Get the OAuth2 invite link to add this bot to your server");

export async function execute(interaction: ChatInputCommandInteraction) {
  const clientId = interaction.client.user?.id;
  const permissions = "8"; // Administrator
  const inviteUrl = clientId
    ? `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=${permissions}&scope=bot%20applications.commands`
    : "Unable to generate link — bot not properly initialized.";

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("🔗 OAuth2 Invite Link")
    .setDescription("Use the link below to add this bot to your server.")
    .addFields({ name: "Invite Link", value: `[Click here to invite](${inviteUrl})` })
    .setFooter({ text: "Requires Administrator permission" });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
