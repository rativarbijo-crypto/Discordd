import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { db } from "@workspace/db";
import { resellersTable, keysTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { generateKey } from "../utils.js";

export const data = new SlashCommandBuilder()
  .setName("reseller_gen")
  .setDescription("Generate keys using your reseller balance")
  .addIntegerOption((opt) =>
    opt
      .setName("amount")
      .setDescription("Number of keys to generate (1–50)")
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(50)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const discordId = interaction.user.id;
  const amount = interaction.options.getInteger("amount", true);

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

  if (reseller.balance < amount) {
    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle("❌ Insufficient Balance")
          .setDescription(`You need **${amount}** credits but only have **${reseller.balance}**. Use \`/transfer_reseller\` or contact admin.`),
      ],
    });
  }

  const keys: string[] = [];
  for (let i = 0; i < amount; i++) {
    keys.push(generateKey("KEY"));
  }

  await db.transaction(async (tx) => {
    await tx
      .update(resellersTable)
      .set({ balance: reseller.balance - amount })
      .where(eq(resellersTable.discordId, discordId));

    await tx.insert(keysTable).values(
      keys.map((k) => ({
        key: k,
        type: "user",
        createdBy: discordId,
        isUsed: false,
      }))
    );
  });

  const keyList = keys.map((k) => `\`${k}\``).join("\n");

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle(`✅ Generated ${amount} Key${amount > 1 ? "s" : ""}`)
        .setDescription(keyList)
        .addFields({
          name: "Remaining Balance",
          value: `${reseller.balance - amount} credits`,
        })
        .setFooter({ text: "Share these keys with your customers." }),
    ],
  });
}
