import { Client, GatewayIntentBits, Collection, Events, ActivityType } from 'discord.js';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'node:fs';

// This bot manages Warmane raids, tracks characters and GearScore, and syncs Discord roles with the guild roster.

// Load environment variables from .env file
dotenv.config();

const {
  DISCORD_TOKEN,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  GUILD_ID,
} = process.env;

// Verify required environment variables are present
if (!DISCORD_TOKEN || !SUPABASE_URL || !SUPABASE_ANON_KEY || !GUILD_ID) {
  console.error('Missing required environment variables.');
  process.exit(1);
}

// Initialize Supabase client for storing player data and raid signups
const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Initialize Discord client with intents for guilds, members, and messages
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
  ],
});

// Collection to hold loaded slash commands
const commands = new Collection<string, any>();

// Dynamically load all slash command modules from src/commands
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.ts') || file.endsWith('.js'));
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath).default;
    if (command && command.data && command.execute) {
      commands.set(command.data.name, command);
    }
  }
}

// Ready event: log online message and set bot presence
client.once(Events.ClientReady, async () => {
  console.log('Warmane Raid Bot is online!');

  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    client.user?.setPresence({
      activities: [{ name: `Managing ${guild.name} raids`, type: ActivityType.Playing }],
      status: 'online',
    });
  } catch (err) {
    console.error('Failed to set bot status:', err);
  }
});

// Generic error handling for Discord client
client.on(Events.Error, (error) => {
  console.error('Discord client error:', error);
});

client.on(Events.Warn, (info) => {
  console.warn('Discord client warning:', info);
});

// Handle interactions for slash commands
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction, supabase);
  } catch (error) {
    console.error('Error executing command:', error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: 'There was an error executing this command.', ephemeral: true });
    } else {
      await interaction.reply({ content: 'There was an error executing this command.', ephemeral: true });
    }
  }
});

// Global handler for unhandled rejections (Supabase or other promises)
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

// Start the bot
client.login(DISCORD_TOKEN).catch((error) => {
  console.error('Failed to login:', error);
});
