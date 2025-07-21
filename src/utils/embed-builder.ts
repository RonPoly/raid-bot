import { EmbedBuilder } from 'discord.js';
import { Raid, RaidSignup } from '../types';

/**
 * Build a raid signup embed following the format outlined in AGENTS.md.
 *
 * Example structure:
 * **ICC 25 - Saturday 8pm ST**
 *
 * 🛡️ **Tanks** (2/2)
 * • Player - 6000 GS
 * • [open]
 *
 * Footer:
 * 📊 Average GS: 6000 | Min required: 5800
 * 👥 Total: 1/25
 */
export function buildRaidEmbed(
  raid: Raid,
  signups: RaidSignup[] = [],
  realm: string,
) {
  const roleSection = (
    emoji: string,
    roleName: string,
    role: 'tank' | 'healer' | 'dps',
    max: number,
  ) => {
    const members = signups
      .filter((s) => s.role === role)
      .map((s) => {
        const name = encodeURIComponent(s.character_name);
        const realmEnc = encodeURIComponent(realm);
        const link = `[${s.character_name}](https://armory.warmane.com/character/${name}/${realmEnc})`;
        return `• ${link}${s.gear_score ? ` - ${s.gear_score} GS` : ''}`;
      });
    const open = max - members.length;
    if (open > 0) {
      members.push(`• [${open} ${open === 1 ? 'slot' : 'slots'} open]`);
    }
    const name = `${emoji} ${roleName} (${members.length - (open > 0 ? 1 : 0)}/${max})`;
    const value = members.join('\n') || '• [open]';
    return { name, value } as const;
  };

  const tankField = roleSection('🛡️', '**Tanks**', 'tank', raid.tank_slots);
  const healerField = roleSection('💚', '**Healers**', 'healer', raid.healer_slots);
  const dpsField = roleSection('⚔️', '**DPS**', 'dps', raid.dps_slots);

  const gsValues = signups.map((s) => s.gear_score).filter((gs): gs is number => typeof gs === 'number');
  const avgGs = gsValues.length > 0 ? Math.round(gsValues.reduce((a, b) => a + b, 0) / gsValues.length) : 0;
  const totalSlots = raid.tank_slots + raid.healer_slots + raid.dps_slots;
  const footer = `📊 Average GS: ${avgGs} | Min required: ${raid.min_gearscore}\n👥 Total: ${signups.length}/${totalSlots}`;

  return new EmbedBuilder()
    .setTitle(`${raid.instance} - ${raid.scheduled_date}`)
    .addFields(tankField, healerField, dpsField)
    .setFooter({ text: footer });
}
