import { EmbedBuilder } from 'discord.js';

export function buildRaidEmbed(title: string, instance: string, date: string, minGs: number) {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .addFields(
      { name: 'Instance', value: instance, inline: true },
      { name: 'Date', value: date, inline: true },
      { name: 'Minimum GS', value: String(minGs), inline: true }
    );
  return embed;
}
