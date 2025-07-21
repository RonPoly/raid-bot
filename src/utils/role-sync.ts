import {
  Client,
  GuildMember,
  ActivityType,
  PermissionsBitField
} from 'discord.js';
import { fetchGuildMembers } from './warmane-api';
import supabase from '../config/database';
import { getGuildConfig } from './guild-config';
import { isUserRegistered } from './database';

// Flag to prevent concurrent syncs
let isSyncing = false;

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

function normalize(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function isRateLimitError(err: any): boolean {
  if (!err) return false;
  return (
    err.status === 429 ||
    err.code === 429 ||
    /rate.*limit/i.test(err.message || '')
  );
}

async function addRoleWithRetry(
  member: GuildMember,
  roleId: string,
  attempts = 3
) {
  for (let i = 0; i < attempts; i++) {
    try {
      await member.roles.add(roleId);
      return;
    } catch (err: any) {
      if (isRateLimitError(err)) {
        const wait = Math.ceil(err.retry_after ? err.retry_after * 1000 : 5000);
        console.warn(`Rate limited when adding role. Retrying in ${wait}ms.`);
        await delay(wait);
        continue;
      }
      throw err;
    }
  }
  console.error(`Failed to add role to ${member.displayName} after retries.`);
}

async function removeRoleWithRetry(
  member: GuildMember,
  roleId: string,
  attempts = 3
) {
  for (let i = 0; i < attempts; i++) {
    try {
      await member.roles.remove(roleId);
      return;
    } catch (err: any) {
      if (isRateLimitError(err)) {
        const wait = Math.ceil(err.retry_after ? err.retry_after * 1000 : 5000);
        console.warn(`Rate limited when removing role. Retrying in ${wait}ms.`);
        await delay(wait);
        continue;
      }
      throw err;
    }
  }
  console.error(`Failed to remove role from ${member.displayName} after retries.`);
}

export async function syncUserRoles(member: GuildMember): Promise<void> {
  const config = await getGuildConfig(member.guild.id);
  if (!config || !config.member_role_id) {
    // Guild is not configured, do nothing.
    return;
  }

  const memberRoleId = config.member_role_id;
  const higherRoles = [
    config.officer_role_id,
    config.class_leader_role_id,
    config.raider_role_id,
  ].filter(id => id) as string[];

  const userIsRegistered = await isUserRegistered(member.id);
  const userHasMemberRole = member.roles.cache.has(memberRoleId);
  const userHasHigherRole = higherRoles.some(roleId => member.roles.cache.has(roleId));

  const shouldHaveMemberRole = userIsRegistered && !userHasHigherRole;

  if (shouldHaveMemberRole && !userHasMemberRole) {
    try {
      await member.roles.add(memberRoleId);
      console.log(`Adding member role to ${member.user.username}`);
    } catch (error) {
      console.error(`Failed to add member role to ${member.user.username}`, error);
    }
  } else if (!shouldHaveMemberRole && userHasMemberRole) {
    try {
      await member.roles.remove(memberRoleId);
      console.log(`Removing member role from ${member.user.username}`);
    } catch (error) {
      console.error(`Failed to remove member role from ${member.user.username}`, error);
    }
  }
}

export async function syncMemberRoles(
  member: GuildMember,
  roster: any
) {
  try {
    if (
      member.user.bot ||
      member.permissions.has(PermissionsBitField.Flags.Administrator)
    ) {
      return;
    }

    console.log(`\n[RoleSync] Checking ${member.displayName} (${member.id})`);

    const config = await getGuildConfig(member.guild.id);
    if (!config || !config.warmane_guild_name || !config.member_role_id) {
      return;
    }

    const memberRoleId = config.member_role_id;
    const members = roster.members ?? roster.roster ?? [];

    const { data: rows } = await supabase
      .from('players')
      .select('character_name')
      .eq('discord_id', member.id)
      .eq('guild_id', member.guild.id);
    console.log('[RoleSync] Registered rows:', rows);

    if (!rows || rows.length === 0) {
      console.log('[RoleSync] No registered characters found for user');
      if (member.roles.cache.has(memberRoleId)) {
        console.log(`Removing member role from ${member.displayName}`);
        await removeRoleWithRetry(member, memberRoleId);
      }
      return;
    }

    const characters = rows.map(r => r.character_name);
    console.log('[RoleSync] Registered characters:', characters);
    console.log('[RoleSync] Normalized registered:', characters.map(c => normalize(c)));

    const normalizedRoster = members.map((m: any) => normalize(m.name));
    console.log('[RoleSync] Normalized roster:', normalizedRoster);

    const inGuild = members.some((m: any) =>
      characters.some(c => normalize(m.name) === normalize(c))
    );
    console.log('[RoleSync] In guild?', inGuild);

    if (inGuild) {
      if (!member.roles.cache.has(memberRoleId)) {
        console.log(`[RoleSync] Adding member role to ${member.displayName}`);
        await addRoleWithRetry(member, memberRoleId);
      }
    } else if (member.roles.cache.has(memberRoleId)) {
      console.log(`[RoleSync] Removing member role from ${member.displayName}`);
      await removeRoleWithRetry(member, memberRoleId);
    }
  } catch (err: any) {
    if (err.status === 503) {
      console.warn('Warmane API unavailable; skipping role sync.');
    } else {
      console.error('Role sync error:', err);
    }
  }
}

export const syncTimers = new Map<string, NodeJS.Timeout>();

export async function syncGuildRoles(
  client: Client,
  guildId: string,
  forceRosterRefresh = false
) {
  try {
    if (isSyncing) {
      console.log('Sync already in progress, skipping...');
      return;
    }
    isSyncing = true;
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      isSyncing = false;
      return;
    }

    const config = await getGuildConfig(guild.id);
    if (!config || !config.warmane_guild_name || !config.member_role_id) {
      isSyncing = false;
      return;
    }

    const guildName = config.warmane_guild_name;
    const realm = config.warmane_realm;

    const roster = await fetchGuildMembers(guildName, realm, forceRosterRefresh);
    console.log('[RoleSync] Full roster fetched:', JSON.stringify(roster));
    for (const [, member] of guild.members.cache) {
      await syncMemberRoles(member, roster);
    }

    const members = roster.members ?? roster.roster ?? [];
    const online = members.filter((m: any) => m.online).length;
    if (guild.client.user) {
      guild.client.user.setPresence({
        activities: [
          { name: `${online} guild members online`, type: ActivityType.Watching }
        ],
        status: 'online'
      });
    }
  } catch (err: any) {
    if (err.status === 503) {
      console.warn('Warmane API unavailable; skipping guild role sync.');
    } else {
      console.error('Guild role sync error:', err);
    }
  } finally {
    isSyncing = false;
  }
}

export function startRoleSyncTimer(
  client: Client,
  guildId: string,
  intervalMinutes = 3
) {
  const existing = syncTimers.get(guildId);
  if (existing) clearInterval(existing);

  // Run an initial sync immediately
  syncGuildRoles(client, guildId);

  const timer = setInterval(async () => {
    await syncGuildRoles(client, guildId);
  }, intervalMinutes * 60 * 1000);

  syncTimers.set(guildId, timer);
}

export function stopRoleSyncTimer(guildId: string) {
  const timer = syncTimers.get(guildId);
  if (timer) {
    clearInterval(timer);
    syncTimers.delete(guildId);
  }
}
