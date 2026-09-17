import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { db } from "@workspace/db";
import { resellersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export const data = new SlashCommandBuilder()
  .setName("transfer_reseller")
  .setDescription("Transfer reseller balance to another reseller")
  .addUserOption((opt) =>
    opt.setName("user").setDescription("The reseller to transfer to").setRequired(true)
  )
  .addIntegerOption((opt) =>
    opt
      .setName("amount")
      .setDescription("Amount of credits to transfer")
      .setRequired(true)
      .setMinValue(1)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const senderId = interaction.user.id;
  const targetUser = interaction.options.getUser("user", true);
  const amount = interaction.options.getInteger("amount", true);

  if (targetUser.id === senderId) {
    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle("❌ Invalid Transfer")
          .setDescription("You cannot transfer balance to yourself."),
      ],
    });
  }

  const [sender] = await db
    .select()
    .from(resellersTable)
    .where(eq(resellersTable.discordId, senderId))
    .limit(1);

  if (!sender) {
    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle("❌ Not a Reseller")
          .setDescription("You are not registered as a reseller."),
      ],
    });
  }

  if (sender.balance < amount) {
    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle("❌ Insufficient Balance")
          .setDescription(`You only have **${sender.balance}** credits but tried to transfer **${amount}**.`),
      ],
    });
  }

  const [recipient] = await db
    .select()
    .from(resellersTable)
    .where(eq(resellersTable.discordId, targetUser.id))
    .limit(1);

  if (!recipient) {
    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle("❌ Recipient Not Found")
          .setDescription(`**${targetUser.username}** is not registered as a reseller.`),
      ],
    });
  }

  await db.transaction(async (tx) => {
    await tx
      .update(resellersTable)
      .set({ balance: sender.balance - amount })
      .where(eq(resellersTable.discordId, senderId));

    await tx
      .update(resellersTable)
      .set({ balance: recipient.balance + amount })
      .where(eq(resellersTable.discordId, targetUser.id));
  });

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle("✅ Transfer Complete")
        .addFields(
          { name: "Sent to", value: `${targetUser.username}`, inline: true },
          { name: "Amount", value: `${amount} credits`, inline: true },
          { name: "Your new balance", value: `${sender.balance - amount} credits`, inline: true },
        )
        .setTimestamp(),
    ],
  });
}
