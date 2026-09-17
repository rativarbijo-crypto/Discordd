import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { db } from "@workspace/db";
import { keysTable } from "@workspace/db";
import { generateKey } from "../utils.js";
import { isAdmin } from "../adminGuard.js";

export const data = new SlashCommandBuilder()
  .setName("genkey")
  .setDescription("Generate one or more activation keys")
  .addIntegerOption((opt) =>
    opt
      .setName("amount")
      .setDescription("Number of keys to generate (default: 1, max: 50)")
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(50)
  )
  .addStringOption((opt) =>
    opt
      .setName("type")
      .setDescription("Key type (default: user)")
      .setRequired(false)
      .addChoices(
        { name: "User", value: "user" },
        { name: "Reseller", value: "reseller" },
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  if (!(await isAdmin(interaction.user.id))) {
    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle("❌ No Permission")
          .setDescription("You need admin access to generate keys."),
      ],
    });
  }

  const amount = interaction.options.getInteger("amount") ?? 1;
  const type = interaction.options.getString("type") ?? "user";
  const createdBy = interaction.user.id;

  const keys: string[] = [];
  for (let i = 0; i < amount; i++) {
    keys.push(generateKey("KEY"));
  }

  await db.insert(keysTable).values(
    keys.map((k) => ({
      key: k,
      type,
      createdBy,
      isUsed: false,
    }))
  );

  const keyList = keys.map((k) => `\`${k}\``).join("\n");

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle(`🔑 Generated ${amount} Key${amount > 1 ? "s" : ""}`)
        .setDescription(keyList)
        .addFields(
          { name: "Type", value: type, inline: true },
          { name: "Created by", value: `<@${createdBy}>`, inline: true },
        )
        .setFooter({ text: "Share these keys with your users." })
        .setTimestamp(),
    ],
  });
}
