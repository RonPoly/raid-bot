# Warmane Raid Bot

A Discord bot for managing raids and guild roster synchronization on the Warmane WOTLK private server. It is written in TypeScript and targets Node.js 20 LTS.

## Features

-   **Interactive Setup**: A `/setup` command guides administrators through a DM-based wizard to configure the bot for their server, including Warmane guild details, member/officer roles, and the raid announcement channel.
-   **Character Registration**: Use `/register` to open a modal where users can enter their character name. The bot verifies the character exists in the configured Warmane guild and automatically calculates their GearScore.
-   **Character Management**: The `/character` command allows users to view their list of registered characters or delete a character they no longer play.
-   **GearScore Commands**: Use `/gearscore` to fetch the latest GearScore for any character from the Warmane Armory or to view the registered characters of a specific Discord user.
-   **Raid Management**:
    * Officers can use `/raid create` to open a dynamic raid creation wizard.
    * Players can see upcoming events with `/raid list` and officers can cancel them with `/raid cancel`.
    * Players sign up for raids using buttons and select their character and role via dropdown menus.
    * Raid embeds automatically update to show the current roster, class composition, and average GearScore.
-   **Raid Templates**: Officers can save and manage raid templates for frequently run instances using the `/template` command.
-   **Roster Management**: The `/roster` command displays the online and offline status of all members in the configured Warmane guild. Officers can use `/bench` to move a signed-up player to the bench, which is displayed separately in the raid embed.
-   **Automated Tasks**:
    * **Raid Reminders**: The bot automatically sends a reminder ping to all signed-up players 30 minutes before a raid is scheduled to start.
    * **Role Sync**: Automatically synchronizes Discord roles with in-game guild membership based on the Warmane API.
    * **Guild Cleanup**: A periodic task runs to remove character data for players who are no longer in the in-game guild.

## Setup

1.  Clone the repository.
2.  Ensure you have Node.js v20+ and npm installed.
3.  Run the setup script: `scripts/setup.sh`.
4.  Copy `.env.example` to `.env` and fill in all required variables.
5.  Deploy the slash commands to Discord: `npm run deploy`.
6.  Run the `/setup` command in your Discord server to begin the configuration wizard.

## Environment Variables

The `.env` file requires the following keys:

-   `DISCORD_TOKEN`: Your Discord bot token.
-   `CLIENT_ID`: Your Discord application's client ID.
-   `SUPABASE_URL`: Your Supabase project URL.
-   `SUPABASE_ANON_KEY`: Your Supabase project's anonymous key.

## Running the Bot

-   `npm run build`: Compiles the TypeScript code.
-   `npm run start`: Starts the bot from the compiled JavaScript files.
-   `npm run dev`: Runs the bot in development mode using `ts-node` for live reloading.
