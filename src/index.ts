import { Client, GatewayIntentBits, Collection } from 'discord.js';
import cron from 'node-cron';
import { syncInGameGuilds } from './tasks/guild-sync';
import { startRaidReminders } from './tasks/raid-reminder';
import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import supabase from './config/database';
import { Command } from './types';
import registerReady from './events/ready';
import registerInteractionCreate from './events/interactionCreate';
import registerGuildMemberUpdate from './events/guildMemberUpdate';
import registerGuildCreate from './events/guildCreate';

dotenv.config();

const { DISCORD_TOKEN } = process.env;

if (!DISCORD_TOKEN) {
  console.error('DISCORD_TOKEN is missing');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent
  ]
});

const commands = new Collection<string, Command>();

const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
  const files = fs.readdirSync(commandsPath).filter(f => f.endsWith('.ts') || f.endsWith('.js'));
  for (const file of files) {
    const command: Command = require(path.join(commandsPath, file)).default;
    commands.set(command.data.name, command);
  }
}

registerReady(client);
registerInteractionCreate(client, commands, supabase);
registerGuildMemberUpdate(client);
registerGuildCreate(client);

client.once('ready', () => {
  // Schedule the smart guild sync task to run every 3 hours.
  // '0 */3 * * *' means "at minute 0 past every 3rd hour"
  cron.schedule('0 */3 * * *', () => {
    syncInGameGuilds(client);
  });

  startRaidReminders(client);
});

client.login(DISCORD_TOKEN);
