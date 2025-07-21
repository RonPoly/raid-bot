import { Client } from 'discord.js';
import { supabase } from '../supabaseClient';
import fetch from 'node-fetch';

// Define a type for our player data for clarity
type Player = {
    id: number;
    discord_id: string;
    character_name: string;
    guild_id: string;
};

export async function syncInGameGuilds(client: Client): Promise<void> {
    console.log('Running smart in-game guild sync...');

    try {
        // 1. Fetch all guild configurations from the database
        const { data: configs, error: configError } = await supabase
            .from('guild_configs')
            .select('*');

        if (configError) throw configError;
        if (!configs || configs.length === 0) {
            console.log('No guilds are configured for guild sync. Skipping task.');
            return;
        }

        // 2. Loop through each configured guild and process it
        for (const config of configs) {
            const { guild_id, name: inGameGuildName, realm } = config;
            if (!inGameGuildName || !realm) {
                console.log(`Skipping server ${guild_id} due to incomplete configuration.`);
                continue;
            }

            console.log(`--- Syncing for server ${guild_id} (In-game: ${inGameGuildName}) ---`);

            // 3. Fetch the In-Game Roster from Warmane API
            const response = await fetch(`https://armory.warmane.com/api/guild/${encodeURIComponent(inGameGuildName)}/${encodeURIComponent(realm)}/summary`);
            if (!response.ok) {
                console.error(`Error fetching guild data for '${inGameGuildName}'.`);
                continue;
            }
            const guildData = await response.json();
            if (guildData.error) {
                console.error(`API error for '${inGameGuildName}': ${guildData.error}`);
                continue;
            }
            const inGameMembers = new Set(guildData.roster.map((m: any) => m.name.toLowerCase()));
            console.log(`Found ${inGameMembers.size} members in the in-game guild.`);

            // 4. Fetch all registered players for this specific Discord server
            const { data: registeredPlayersData, error: playersError } = await supabase
                .from('players')
                .select('*')
                .eq('guild_id', guild_id);

            const registeredPlayers = (registeredPlayersData ?? []) as Player[];
            
            if (playersError) throw playersError;

            // 5. Group players by their Discord ID
            const playersByDiscordId = new Map<string, Player[]>();
            for (const player of registeredPlayers) {
                const existing = playersByDiscordId.get(player.discord_id) || [];
                existing.push(player);
                playersByDiscordId.set(player.discord_id, existing);
            }

            const discordGuild = client.guilds.cache.get(guild_id);
            if (!discordGuild) continue;

            // 6. Process each unique Discord user based on the new logic
            for (const [discordId, characters] of playersByDiscordId.entries()) {
                const remainingChars = characters.filter(c => inGameMembers.has(c.character_name.toLowerCase()));
                const staleChars = characters.filter(c => !inGameMembers.has(c.character_name.toLowerCase()));

                if (remainingChars.length === 0) {
                    // CASE A: User has NO characters left in the guild. Remove them completely.
                    console.log(`User ${discordId} has no characters left in the guild. Removing roles and all data.`);
                    
                    try {
                        const member = await discordGuild.members.fetch(discordId);
                        const rolesToRemove = [config.member_role_id, config.raider_role_id, config.class_leader_role_id, config.officer_role_id].filter(id => id) as string[];
                        if (member && rolesToRemove.length > 0) {
                            await member.roles.remove(rolesToRemove, 'All characters have left the in-game guild.');
                        }
                    } catch (e) { console.log(`Could not fetch member ${discordId} to remove roles.`); }

                    // Delete all their character records from DB
                    const charIdsToDelete = characters.map(c => c.id);
                    await supabase.from('players').delete().in('id', charIdsToDelete);

                } else if (staleChars.length > 0) {
                    // CASE B: User has alts that left. Clean up only the alt records.
                    console.log(`User ${discordId} has left on some alts. Cleaning up stale records.`);
                    
                    const staleCharIds = staleChars.map(c => c.id);
                    await supabase.from('players').delete().in('id', staleCharIds);
                    console.log(`Removed ${staleCharIds.length} stale character(s) for user ${discordId}.`);
                }
            }
        }
    } catch (error) {
        console.error('An unexpected error occurred during the smart guild sync task:', error);
    }
    console.log('--- Smart in-game guild sync finished. ---');
}
