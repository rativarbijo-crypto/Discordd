import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { db } from "@workspace/db";
import { adminsTable } from "@workspace/db";
import { isAdmin } from "../adminGuard.js";

export const data = new SlashCommandBuilder()
  .setName("admin_list")
  .setDescription("List all users with admin access");

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  if (!(await isAdmin(interaction.user.id))) {
    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle("❌ No Permission")
          .setDescription("You don't have admin access."),
      ],
    });
  }

  const superAdminRaw = process.env["SUPER_ADMIN_ID"] ?? "";
  const superAdmins = superAdminRaw.split(",").map((s) => s.trim()).filter(Boolean);
  const grantedAdmins = await db.select().from(adminsTable);

  const superLine = superAdmins.length > 0
    ? superAdmins.map((id) => `👑 <@${id}> — Super Admin`).join("\n")
    : "_None configured_";

  const grantedLine = grantedAdmins.length > 0
    ? grantedAdmins.map((a) => `🛡️ **${a.username}** (<@${a.discordId}>) — added by <@${a.addedBy}>`).join("\n")
    : "_No granted admins yet_";

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("🛡️ Admin List")
        .addFields(
          { name: "Super Admin", value: superLine },
          { name: `Granted Admins (${grantedAdmins.length})`, value: grantedLine },
        )
        .setTimestamp(),
    ],
  });
}
