import { Client, TextChannel } from 'discord.js';
import { supabase } from '../supabaseClient';

export function startRaidReminders(client: Client) {
  setInterval(async () => {
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 60 * 1000).toISOString();
    const { data: raids } = await supabase
      .from('raids')
      .select('*')
      .eq('reminder_sent', false)
      .lte('scheduled_date', in30)
      .gte('scheduled_date', now.toISOString());

    for (const raid of raids || []) {
      const { data: signups } = await supabase
        .from('raid_signups')
        .select('character_name, role')
        .eq('raid_id', raid.id)
        .eq('benched', false);

      const { data: players } = await supabase
        .from('players')
        .select('character_name, discord_id')
        .eq('guild_id', raid.guild_id);

      const mentions = signups
        ?.map(s => players?.find(p => p.character_name === s.character_name)?.discord_id)
        .filter(Boolean)
        .map(id => `<@${id}>`) || [];

      if (mentions.length > 0 && raid.signup_message_id) {
        const guild = client.guilds.cache.get(raid.guild_id);
        const channel = guild?.channels.cache.get(raid.signup_message_id) as TextChannel | undefined;
        if (channel) {
          await channel.send(`Reminder: raid ${raid.title} starts in 30 minutes! ${mentions.join(' ')}`);
        }
      }

      await supabase.from('raid_logs').insert(
        signups?.map(s => ({ raid_id: raid.id, character_name: s.character_name, role: s.role })) || []
      );

      await supabase.from('raids').update({ reminder_sent: true }).eq('id', raid.id);
    }
  }, 5 * 60 * 1000);
}
