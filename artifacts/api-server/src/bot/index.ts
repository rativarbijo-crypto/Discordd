import {
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  type ChatInputCommandInteraction,
  type SlashCommandBuilder,
} from "discord.js";
import { logger } from "../lib/logger.js";
import { recoverActiveJobs } from "./dashboard/timers.js";
import { syncUserClients } from "./dashboard/userClients.js";
import { handleButton, handleButtonModal, handleSelect, handleModalSubmit } from "./dashboard/handlers.js";

import * as help from "./commands/help.js";
import * as redeemKey from "./commands/redeem_key.js";
import * as oauthLink from "./commands/oauth_link.js";
import * as dashboard from "./commands/dashboard.js";
import * as balance from "./commands/balance.js";
import * as resellerGen from "./commands/reseller_gen.js";
import * as transferReseller from "./commands/transfer_reseller.js";
import * as genkey from "./commands/genkey.js";
import * as adminGenkey from "./commands/admin_genkey.js";
import * as adminAdd from "./commands/admin_add.js";
import * as adminRemove from "./commands/admin_remove.js";
import * as adminList from "./commands/admin_list.js";

interface Command {
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<unknown>;
}

const commands: Command[] = [
  help,
  redeemKey,
  oauthLink,
  dashboard,
  balance,
  resellerGen,
  transferReseller,
  genkey,
  adminGenkey,
  adminAdd,
  adminRemove,
  adminList,
];

export async function startBot(token: string): Promise<void> {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel, Partials.Message],
  });

  const commandCollection = new Collection<string, Command>();
  for (const cmd of commands) {
    commandCollection.set(cmd.data.name, cmd);
  }

  client.once(Events.ClientReady, async (readyClient) => {
    logger.info({ tag: readyClient.user.tag }, "Discord bot online");

    const rest = new REST().setToken(token);
    try {
      const commandData = commands.map((c) => c.data.toJSON());
      await rest.put(Routes.applicationCommands(readyClient.user.id), { body: commandData });
      logger.info("Registered slash commands globally");
    } catch (err) {
      logger.error({ err }, "Failed to register slash commands");
    }

    try {
      await recoverActiveJobs(client);
    } catch (err) {
      logger.error({ err }, "Failed to recover active jobs — check DATABASE_URL");
    }
    try {
      await syncUserClients();
    } catch (err) {
      logger.error({ err }, "Failed to sync user clients — check DATABASE_URL");
    }
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    // ── Slash commands ────────────────────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const command = commandCollection.get(interaction.commandName);
      if (!command) return;
      try {
        await command.execute(interaction);
      } catch (err) {
        logger.error({ err, command: interaction.commandName }, "Command error");
        const msg = { content: "⚠️ An error occurred.", ephemeral: true };
        if (interaction.replied || interaction.deferred) await interaction.followUp(msg);
        else await interaction.reply(msg);
      }
      return;
    }

    // ── Buttons ───────────────────────────────────────────────────────────────
    if (interaction.isButton()) {
      if (!interaction.customId.startsWith("d:")) return;
      try {
        // Modal-triggering buttons must NOT be deferred first
        const needsModal = ["d:addtk:", "d:tknew:", "d:tkrn:", "d:tkrep:", "d:jbedit:"].some((p) =>
          interaction.customId.startsWith(p)
        );
        if (needsModal) {
          await handleButtonModal(client, interaction);
        } else {
          await handleButton(client, interaction);
        }
      } catch (err) {
        logger.error({ err, id: interaction.customId }, "Button error");
      }
      return;
    }

    // ── Select menus ──────────────────────────────────────────────────────────
    if (interaction.isStringSelectMenu()) {
      if (!interaction.customId.startsWith("d:")) return;
      try {
        await handleSelect(client, interaction);
      } catch (err) {
        logger.error({ err, id: interaction.customId }, "Select error");
      }
      return;
    }

    // ── Modals ────────────────────────────────────────────────────────────────
    if (interaction.isModalSubmit()) {
      if (!interaction.customId.startsWith("m:")) return;
      try {
        await handleModalSubmit(client, interaction);
      } catch (err) {
        logger.error({ err, id: interaction.customId }, "Modal error");
      }
      return;
    }

  });

  await client.login(token);
}
