# Warmane Raid Bot

A Discord bot built for managing raid signups and guild roster synchronization on the Warmane WOTLK private server. It is written in TypeScript and targets Node.js 20 LTS.

## Setup

1. Ensure you have a Linux environment with sudo privileges.
2. Run `scripts/setup.sh` to install Node.js 20, npm and git, create the required folders and install dependencies.
3. Copy `.env.example` to `.env` and fill in all variables.

## Environment Variables

The `.env` file uses the following keys:

- `DISCORD_TOKEN` – bot token from Discord
- `GUILD_ID` – Discord guild ID
- `MEMBER_ROLE_ID` – role granted to guild members
- `OFFICER_ROLE_ID` – officer role ID
- `SUPABASE_URL` – Supabase project URL
- `SUPABASE_ANON_KEY` – Supabase anon key
- `WARMANE_GUILD_NAME` – in-game guild name
- `WARMANE_REALM` – Warmane realm, default `Lordaeron`
- `SYNC_INTERVAL_MINUTES` – role sync interval in minutes
- `MIN_GEARSCORE_ICC` – recommended minimum GearScore for ICC

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

