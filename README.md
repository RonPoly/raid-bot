# Warmane Raid Bot

A Discord bot built for managing raid signups and guild roster synchronization on the Warmane WOTLK private server. It is written in TypeScript and targets Node.js 20 LTS.

## Setup

1. Ensure you have a Linux environment with sudo privileges.
2. Run `scripts/setup.sh` to install Node.js 20, npm and git, create the required folders and install dependencies.
3. Copy `.env.example` to `.env` and fill in all variables.

## Environment Variables

The `.env` file uses the following keys:

- `DISCORD_TOKEN` – bot token from Discord
- `CLIENT_ID` – Discord application ID found in the Developer Portal
- `SUPABASE_URL` – Supabase project URL
- `SUPABASE_ANON_KEY` – Supabase anon key

The `CLIENT_ID` can be found in the Discord Developer Portal under **Your App**
 > **Application ID**.

## Running the Bot

After completing setup and configuring the environment variables:

```bash
npm run build
npm start
```

During development you can run:

```bash
npm run dev
```

The bot will log in to Discord and begin managing raids according to your configuration.

