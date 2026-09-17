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
  .setName("admin_add")
  .setDescription("Grant admin access to a Discord user (super admin only)")
  .addUserOption((opt) =>
    opt.setName("user").setDescription("User to grant admin access").setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  if (!isSuperAdmin(interaction.user.id)) {
    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle("❌ No Permission")
          .setDescription("Only the super admin can add other admins."),
      ],
    });
  }

  const target = interaction.options.getUser("user", true);

  if (isSuperAdmin(target.id)) {
    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xfee75c)
          .setTitle("⚠️ Already Super Admin")
          .setDescription(`**${target.username}** is already the super admin.`),
      ],
    });
  }

  const [existing] = await db
    .select()
    .from(adminsTable)
    .where(eq(adminsTable.discordId, target.id))
    .limit(1);

  if (existing) {
    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xfee75c)
          .setTitle("⚠️ Already an Admin")
          .setDescription(`**${target.username}** already has admin access.`),
      ],
    });
  }

  await db.insert(adminsTable).values({
    discordId: target.id,
    username: target.username,
    addedBy: interaction.user.id,
  });

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle("✅ Admin Added")
        .addFields(
          { name: "User", value: `${target.username} (<@${target.id}>)`, inline: true },
          { name: "Added by", value: `<@${interaction.user.id}>`, inline: true },
        )
        .setDescription("They can now use `/genkey` and `/admin_genkey`.")
        .setTimestamp(),
    ],
  });
}
