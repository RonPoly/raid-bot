import { EmbedBuilder } from 'discord.js';
import { Raid, RaidSignup, RaidBench } from '../types';

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
  bench: RaidBench[] = []
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
        const gsText = typeof s.gear_score === 'number' ? `${s.gear_score} GS` : 'No GS';
        return `• ${link} - ${gsText}`;
      });
    const open = max - members.length;
    if (open > 0) {
      members.push(`• [${open} ${open === 1 ? 'slot' : 'slots'} open]`);
    }
    const classes: Record<string, number> = {};
    signups.filter((s) => s.role === role).forEach((s) => {
      if (s.class) {
        classes[s.class] = (classes[s.class] || 0) + 1;
      }
    });
    const classComp = Object.entries(classes)
      .map(([c, n]) => `${n} ${c}${n > 1 ? 's' : ''}`)
      .join(', ');

    const name = `${emoji} ${roleName} (${members.length - (open > 0 ? 1 : 0)}/${max})`;
    const value = members.join('\n') + (classComp ? `\n*${classComp}*` : '') || '• [open]';
    return { name, value } as const;
  };

  const tankField = roleSection('🛡️', '**Tanks**', 'tank', raid.tank_slots);
  const healerField = roleSection('💚', '**Healers**', 'healer', raid.healer_slots);
  const dpsField = roleSection('⚔️', '**DPS**', 'dps', raid.dps_slots);

  const gsValues = signups.map((s) => s.gear_score).filter((gs): gs is number => typeof gs === 'number');
  const avgGs = gsValues.length > 0 ? Math.round(gsValues.reduce((a, b) => a + b, 0) / gsValues.length) : 0;
  const totalSlots = raid.tank_slots + raid.healer_slots + raid.dps_slots;
  const footer = `📊 Average GS: ${avgGs} | Min required: ${raid.min_gearscore}\n👥 Total: ${signups.length}/${totalSlots}`;

  const embed = new EmbedBuilder()
    .setTitle(`${raid.instance} - ${raid.scheduled_date}`)
    .addFields(tankField, healerField, dpsField)
    .setFooter({ text: footer });

  if (bench.length > 0) {
    const list = bench
      .map((b) => `[${b.character_name}](https://armory.warmane.com/character/${encodeURIComponent(b.character_name)}/${encodeURIComponent(realm)})`)
      .join('\n');
    embed.addFields({ name: 'Benched', value: list });
  }

  return embed;
}
