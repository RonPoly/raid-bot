import { Client, GatewayIntentBits } from 'discord.js';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Validate required environment variables
const { DISCORD_TOKEN, SUPABASE_URL, SUPABASE_KEY } = process.env;
if (!DISCORD_TOKEN || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing required environment variables. Please check your .env file.');
  process.exit(1);
}

// Initialize Supabase client with URL and key from environment variables
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Initialize Discord client with required intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, // Allows bot to receive guild (server) related events
    GatewayIntentBits.GuildMessages, // Allows bot to receive message events in guilds
    GatewayIntentBits.MessageContent, // Allows bot to read message content
  ],
});

// Event: When the bot is ready and connected to Discord
client.once('ready', () => {
  console.log('Bot is online');
  if (client.user) {
    console.log(`Logged in as ${client.user.tag}`);
  }
});

// Event: Handle errors to prevent bot crashing
client.on('error', (error) => {
  console.error('Discord client encountered an error:', error);
});

// Event: Handle warnings for debugging
client.on('warn', (warning) => {
  console.warn('Discord client warning:', warning);
});

// Example: Basic command handler (modern pattern using message content)
client.on('messageCreate', async (message) => {
  // Ignore messages from bots
  if (message.author.bot) return;

  // Example command: !ping
  if (message.content.startsWith('!ping')) {
    try {
      // Example: Store a ping in Supabase
      const { error } = await supabase
        .from('pings')
        .insert([{ user_id: message.author.id, timestamp: new Date().toISOString() }]);

      if (error) {
        console.error('Supabase insert error:', error);
        await message.reply('Error saving ping to database.');
        return;
      }

      await message.reply('Pong!');
    } catch (err) {
      console.error('Error handling ping command:', err);
      await message.reply('An error occurred while processing your command.');
    }
  }
});

// Login to Discord with the bot token
client.login(DISCORD_TOKEN).catch((error) => {
  console.error('Failed to login to Discord:', error);
  process.exit(1);
});