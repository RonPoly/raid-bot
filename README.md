# Warmane Raid Bot

A Discord bot for managing raids and guild roster synchronization on the Warmane WOTLK private server. It is written in TypeScript and targets Node.js 20 LTS.

## Features
- Interactive `/setup` wizard to configure each Discord server with your Warmane guild, select member/officer roles and choose the raid signup channel.
- `/register` command with modals to register your main character or alts. Characters are verified via the Warmane Armory and automatically receive a calculated GearScore.
- `/character` command to list all of your registered characters or delete one you no longer use.
- `/gs` command to set a character's GearScore or view GearScores for yourself or another user.
- `/raid` command to create, list and cancel raids. Players sign up through dropdown menus choosing their character and role. Raid embeds show open slots and average GS.
- `/roster` command to view online/offline guild members via the Warmane API.
- Raid templates for quickly creating common raid setups.
- `/bench` command for officers to bench characters and display them in raid embeds.
- Automatic raid reminders pinging signed players 30 minutes before start and logging attendance.
- Automatic role synchronization that checks the Warmane API every few minutes and updates Discord roles based on guild membership.
- Periodic "smart" guild sync task to clean up characters that have left the guild.
- Supports multiple Discord servers, each with its own configuration.

## Setup
1. Ensure you have a Linux environment with sudo privileges.
2. Run `scripts/setup.sh` to install Node.js 20, npm and git, create the required folders and install dependencies.
3. Copy `.env.example` to `.env` and fill in all variables.
4. Deploy slash commands with `npm run deploy` and then run `/setup run` in your Discord server to link it with your Warmane guild.

## Environment Variables
The `.env` file uses the following keys:
- `DISCORD_TOKEN` – bot token from Discord
- `CLIENT_ID` – Discord application ID found in the Developer Portal
- `SUPABASE_URL` – Supabase project URL
- `SUPABASE_ANON_KEY` – Supabase anon key

The `CLIENT_ID` can be found in the Discord Developer Portal under **Your App** > **Application ID**.

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
