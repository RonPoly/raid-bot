import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  User
} from 'discord.js';
import { SupabaseClient } from '@supabase/supabase-js';
import { Command } from '../types';

function gsColor(score?: number) {
  if (score === undefined) return 0x808080; // gray for unknown
  if (score < 5000) return 0xff0000; // red
  if (score < 6000) return 0xffff00; // yellow
  return 0x00ff00; // green
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('gs')
    .setDescription('Manage GearScore')
    .addSubcommand((sub) =>
      sub
        .setName('set')
        .setDescription('Set a character GearScore')
        .addStringOption((opt) =>
          opt.setName('character').setDescription('Character name').setRequired(true)
        )
        .addIntegerOption((opt) =>
          opt
            .setName('score')
            .setDescription('GearScore (3000-7000)')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('view')
        .setDescription('View GearScores')
        .addUserOption((opt) =>
          opt.setName('user').setDescription('User to view').setRequired(false)
        )
    ),
  async execute(interaction: ChatInputCommandInteraction, supabase: SupabaseClient) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'set') {
      const character = interaction.options.getString('character', true);
      const score = interaction.options.getInteger('score', true);

      if (score < 3000 || score > 7000) {
        await interaction.reply({ content: 'GearScore must be between 3000 and 7000.', ephemeral: true });
        return;
      }

      await supabase
        .from('GearScores')
        .upsert({ character_name: character, gear_score: score, last_updated: new Date().toISOString() });
      await interaction.reply({ content: `Set GearScore of ${character} to ${score}.`, ephemeral: true });
    } else if (sub === 'view') {
      const user: User = interaction.options.getUser('user') ?? interaction.user;

      const { data: player } = await supabase
        .from('Players')
        .select('id, main_character')
        .eq('discord_id', user.id)
        .maybeSingle();

      if (!player) {
        await interaction.reply({ content: 'That user has not registered a character.', ephemeral: true });
        return;
      }

      const { data: alts } = await supabase
        .from('Alts')
        .select('character_name')
        .eq('player_id', player.id);

      const characters = [player.main_character, ...(alts?.map((a) => a.character_name) ?? [])];

      const { data: scores } = await supabase
        .from('GearScores')
        .select('character_name, gear_score')
        .in('character_name', characters);

      const embeds = characters.map((name) => {
        const record = scores?.find((s) => s.character_name.toLowerCase() === name.toLowerCase());
        const score = record?.gear_score;
        const embed = new EmbedBuilder()
          .setTitle(name)
          .setColor(gsColor(score))
          .setDescription(score ? `${score} GS` : 'No GearScore set');
        return embed;
      });

      await interaction.reply({ embeds });
    }
  }
};

export default command;
