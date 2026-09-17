import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { db } from "@workspace/db";
import { keysTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export const data = new SlashCommandBuilder()
  .setName("redeem_key")
  .setDescription("Redeem a key to activate your account")
  .addStringOption((opt) =>
    opt.setName("key").setDescription("Your activation key").setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const keyInput = interaction.options.getString("key", true).trim();
  const discordId = interaction.user.id;
  const username = interaction.user.username;

  const [keyRecord] = await db
    .select()
    .from(keysTable)
    .where(eq(keysTable.key, keyInput))
    .limit(1);

  if (!keyRecord) {
    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle("❌ Invalid Key")
          .setDescription("That key does not exist. Please check and try again."),
      ],
    });
  }

  if (keyRecord.isUsed) {
    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle("❌ Key Already Used")
          .setDescription("This key has already been redeemed."),
      ],
    });
  }

  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.discordId, discordId))
    .limit(1);

  if (existing) {
    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xfee75c)
          .setTitle("⚠️ Already Activated")
          .setDescription("Your account is already active."),
      ],
    });
  }

  await db.transaction(async (tx) => {
    await tx
      .update(keysTable)
      .set({ isUsed: true, usedBy: discordId, usedAt: new Date() })
      .where(eq(keysTable.key, keyInput));

    await tx.insert(usersTable).values({ discordId, username });
  });

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle("✅ Key Redeemed!")
        .setDescription(`Welcome, **${username}**! Your account is now active.`)
        .addFields({ name: "Next Step", value: "Use `/settoken` to link your bot token." }),
    ],
  });
}
