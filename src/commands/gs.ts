import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  User,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction
} from 'discord.js';
import { SupabaseClient } from '@supabase/supabase-js';
import { Command } from '../types';
import { buildCharacterSelectMenu } from '../utils/character-select';

function gsColor(score?: number) {
  if (score === undefined) return 0x808080; // gray for unknown
  if (score < 5000) return 0xff0000; // red
  if (score < 6000) return 0xffff00; // yellow
  return 0x00ff00; // green
}

const SET_SELECT_ID = (score: number) => `gs-set-select:${score}`;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('gs')
    .setDescription('Manage GearScore')
    .addSubcommand((sub) =>
      sub
        .setName('set')
        .setDescription('Set a character GearScore')
        .addIntegerOption((opt) =>
          opt
            .setName('score')
            .setDescription('GearScore (3000-7000)')
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('character')
            .setDescription('Character name (must be spelled exactly as in-game)')
            .setRequired(false)
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
      const characterOpt = interaction.options.getString('character');
      const score = interaction.options.getInteger('score', true);

      if (score < 3000 || score > 7000) {
        await interaction.reply({ content: 'GearScore must be between 3000 and 7000.', ephemeral: true });
        return;
      }

      if (characterOpt) {
        await supabase
          .from('players')
          .update({ gear_score: score, last_updated: new Date().toISOString() })
          .eq('guild_id', interaction.guildId || '')
          .eq('discord_id', interaction.user.id)
          .eq('character_name', characterOpt);
        await interaction.reply({ content: `Set GearScore of ${characterOpt} to ${score}.`, ephemeral: true });
        return;
      }

      try {
        const { menu, characters } = await buildCharacterSelectMenu(
          supabase,
          interaction.user.id,
          interaction.guildId || '',
          SET_SELECT_ID(score)
        );

        if (characters.length === 1) {
          await supabase
            .from('players')
            .update({ gear_score: score, last_updated: new Date().toISOString() })
            .eq('guild_id', interaction.guildId || '')
            .eq('discord_id', interaction.user.id)
            .eq('character_name', characters[0]);
          await interaction.reply({
            content: `Set GearScore of ${characters[0]} to ${score}.`,
            ephemeral: true,
          });
          return;
        }

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
        await interaction.reply({ content: 'Choose a character:', components: [row], ephemeral: true });
      } catch {
        await interaction.reply({ content: 'Register a character first.', ephemeral: true });
      }
    } else if (sub === 'view') {
      const user: User = interaction.options.getUser('user') ?? interaction.user;

      const { data: characters } = await supabase
        .from('players')
        .select('character_name, gear_score')
        .eq('discord_id', user.id)
        .eq('guild_id', interaction.guildId || '');

      if (!characters || characters.length === 0) {
        await interaction.reply({ content: 'That user has not registered a character.', ephemeral: true });
        return;
      }

      const embeds = characters.map((c) => {
        const score = c.gear_score ?? undefined;
        const embed = new EmbedBuilder()
          .setTitle(c.character_name)
          .setColor(gsColor(score))
          .setDescription(score ? `${score} GS` : 'No GearScore set');
        return embed;
      });

      await interaction.reply({ embeds });
    }
  }
};

export default command;

export async function handleGsSetSelectMenu(
  interaction: StringSelectMenuInteraction,
  supabase: SupabaseClient
) {
  const [, scoreStr] = interaction.customId.split(':');
  const score = parseInt(scoreStr, 10);
  const character = interaction.values[0];

  if (!character || isNaN(score)) {
    await interaction.update({ content: 'Invalid selection.', components: [] });
    return;
  }

  await supabase
    .from('players')
    .update({ gear_score: score, last_updated: new Date().toISOString() })
    .eq('guild_id', interaction.guildId || '')
    .eq('discord_id', interaction.user.id)
    .eq('character_name', character);

  await interaction.update({ content: `Set GearScore of ${character} to ${score}.`, components: [] });
}
