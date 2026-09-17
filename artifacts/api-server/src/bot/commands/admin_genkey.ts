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
  .setName("admin_genkey")
  .setDescription("Generate keys with a specific trial duration")
  .addStringOption((opt) =>
    opt
      .setName("type")
      .setDescription("Key duration type")
      .setRequired(true)
      .addChoices(
        { name: "3 Day Trial", value: "3day" },
        { name: "30 Day", value: "30day" },
        { name: "90 Day", value: "90day" },
      )
  )
  .addIntegerOption((opt) =>
    opt
      .setName("amount")
      .setDescription("Number of keys to generate (default: 1, max: 50)")
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(50)
  );

const typeLabels: Record<string, string> = {
  "3day": "3 Day Trial",
  "30day": "30 Day",
  "90day": "90 Day",
};

const typeColors: Record<string, number> = {
  "3day": 0xfee75c,
  "30day": 0x57f287,
  "90day": 0x5865f2,
};

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  if (!(await isAdmin(interaction.user.id))) {
    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle("❌ No Permission")
          .setDescription("You need admin access to use this command."),
      ],
    });
  }

  const type = interaction.options.getString("type", true);
  const amount = interaction.options.getInteger("amount") ?? 1;
  const createdBy = interaction.user.id;

  const keys: string[] = [];
  for (let i = 0; i < amount; i++) {
    keys.push(generateKey(type.toUpperCase()));
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
        .setColor(typeColors[type] ?? 0x5865f2)
        .setTitle(`🔑 Generated ${amount} × ${typeLabels[type]} Key${amount > 1 ? "s" : ""}`)
        .setDescription(keyList)
        .addFields(
          { name: "Duration", value: typeLabels[type] ?? type, inline: true },
          { name: "Amount", value: `${amount}`, inline: true },
          { name: "Created by", value: `<@${createdBy}>`, inline: true },
        )
        .setFooter({ text: "Share these keys with your customers." })
        .setTimestamp(),
    ],
  });
}
