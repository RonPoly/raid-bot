import { EmbedBuilder } from 'discord.js';
import { Raid, RaidSignup } from '../types';

export function buildRaidEmbed(raid: Raid, signups: RaidSignup[] = []) {
  const tanks = signups
    .filter((s) => s.role === 'tank')
    .map((s) => `${s.character_name}${s.gear_score ? ` - ${s.gear_score} GS` : ''}`);
  const healers = signups
    .filter((s) => s.role === 'healer')
    .map((s) => `${s.character_name}${s.gear_score ? ` - ${s.gear_score} GS` : ''}`);
  const dps = signups
    .filter((s) => s.role === 'dps')
    .map((s) => `${s.character_name}${s.gear_score ? ` - ${s.gear_score} GS` : ''}`);

  return new EmbedBuilder()
    .setTitle(`${raid.instance} - ${raid.title}`)
    .addFields(
      { name: 'Date', value: raid.scheduled_date, inline: false },
      {
        name: `Tanks (${tanks.length}/${raid.tank_slots})`,
        value: tanks.join('\n') || '[open]',
        inline: true
      },
      {
        name: `Healers (${healers.length}/${raid.healer_slots})`,
        value: healers.join('\n') || '[open]',
        inline: true
      },
      {
        name: `DPS (${dps.length}/${raid.dps_slots})`,
        value: dps.join('\n') || '[open]',
        inline: true
      },
      { name: 'Minimum GS', value: String(raid.min_gearscore), inline: false }
    );
}
