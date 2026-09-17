import app from "./app.js";
import { logger } from "./lib/logger.js";
import { startBot } from "./bot/index.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");
});

const botToken = process.env["DISCORD_BOT_TOKEN"];
if (!botToken) {
  logger.warn("DISCORD_BOT_TOKEN not set — Discord bot will not start");
} else {
  startBot(botToken).catch((err) => {
    logger.error({ err }, "Discord bot failed to start");
  });
}
