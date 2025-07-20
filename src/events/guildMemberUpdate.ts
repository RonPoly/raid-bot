import { Client, Events } from 'discord.js';
import { syncMemberRoles } from '../utils/role-sync';

export default function registerGuildMemberUpdate(client: Client) {
  const guildName = process.env.WARMANE_GUILD_NAME || '';
  const realm = process.env.WARMANE_REALM || 'Lordaeron';
  const memberRoleId = process.env.MEMBER_ROLE_ID || '';

  if (!guildName || !memberRoleId) return;

  client.on(Events.GuildMemberUpdate, async (_, newMember) => {
    await syncMemberRoles(newMember, guildName, realm, memberRoleId);
  });
}
