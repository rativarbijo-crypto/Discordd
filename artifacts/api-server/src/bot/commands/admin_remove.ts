import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { db } from "@workspace/db";
import { adminsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { isSuperAdmin } from "../adminGuard.js";

export const data = new SlashCommandBuilder()
  .setName("admin_remove")
  .setDescription("Revoke admin access from a user (super admin only)")
  .addUserOption((opt) =>
    opt.setName("user").setDescription("User to revoke admin access from").setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  if (!isSuperAdmin(interaction.user.id)) {
    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle("❌ No Permission")
          .setDescription("Only the super admin can remove admins."),
      ],
    });
  }

  const target = interaction.options.getUser("user", true);

  if (isSuperAdmin(target.id)) {
    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle("❌ Cannot Remove Super Admin")
          .setDescription("You cannot remove the super admin."),
      ],
    });
  }

  const [existing] = await db
    .select()
    .from(adminsTable)
    .where(eq(adminsTable.discordId, target.id))
    .limit(1);

  if (!existing) {
    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xfee75c)
          .setTitle("⚠️ Not an Admin")
          .setDescription(`**${target.username}** does not have admin access.`),
      ],
    });
  }

  await db.delete(adminsTable).where(eq(adminsTable.discordId, target.id));

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle("🚫 Admin Removed")
        .addFields(
          { name: "User", value: `${target.username} (<@${target.id}>)`, inline: true },
          { name: "Removed by", value: `<@${interaction.user.id}>`, inline: true },
        )
        .setDescription("They can no longer use admin commands.")
        .setTimestamp(),
    ],
  });
}
