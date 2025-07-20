import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { SupabaseClient } from '@supabase/supabase-js';
import { Command } from '../types';
import { fetchCharacterSummary, getClassColor } from '../utils/warmane-api';
import { getGuildConfig } from '../utils/guild-config';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('register')
    .setDescription('Register your character')
    .addStringOption((opt) =>
      opt.setName('character')
        .setDescription('Character name')
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName('alt_of')
        .setDescription('Main character if registering an alt')
        .setRequired(false)
    ),
  async execute(interaction: ChatInputCommandInteraction, supabase: SupabaseClient) {
    const character = interaction.options.getString('character', true);
    const altOf = interaction.options.getString('alt_of');
    const discordId = interaction.user.id;
    const guildId = interaction.guildId ?? '';
    const config = await getGuildConfig(guildId);
    const realm = config?.warmane_realm || 'Lordaeron';

      if (!/^[A-Za-z\u00C0-\u017F]{2,12}$/.test(character)) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setDescription('Invalid character name.');
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

    if (!altOf) {
      // Register main character
      const { data: existing } = await supabase
        .from('Players')
        .select('*')
        .eq('discord_id', discordId)
        .maybeSingle();

        if (existing) {
          const embed = new EmbedBuilder()
            .setColor(0xff0000)
            .setDescription('You already registered a main character.');
          await interaction.reply({ embeds: [embed], ephemeral: true });
          return;
        }

        const { data: inserted, error } = await supabase
          .from('Players')
          .insert({ discord_id: discordId, main_character: character, realm })
          .select('id, main_character')
          .single();

        if (!inserted || error) {
          const embed = new EmbedBuilder()
            .setColor(0xff0000)
            .setDescription('Failed to register character.');
          await interaction.reply({ embeds: [embed], ephemeral: true });
          return;
        }

        const summary = await fetchCharacterSummary(character, realm).catch(() => null);
        const color = summary ? getClassColor(summary.class) : 0x2f3136;

        const { data: alts } = await supabase
          .from('Alts')
          .select('character_name')
          .eq('player_id', inserted.id);

        const charList = [inserted.main_character, ...(alts?.map(a => a.character_name) ?? [])];

        const embed = new EmbedBuilder()
          .setTitle('Registered Characters')
          .setColor(color)
          .setDescription(charList.join('\n'));

        await interaction.reply({ embeds: [embed], ephemeral: true });
      } else {
        // Register alt
        const { data: player } = await supabase
          .from('Players')
          .select('id, main_character')
        .eq('discord_id', discordId)
        .maybeSingle();

        if (!player) {
          const embed = new EmbedBuilder()
            .setColor(0xff0000)
            .setDescription('You must register a main character first.');
          await interaction.reply({ embeds: [embed], ephemeral: true });
          return;
        }
        if (player.main_character.toLowerCase() !== altOf.toLowerCase()) {
          const embed = new EmbedBuilder()
            .setColor(0xff0000)
            .setDescription('Alt must belong to your registered main.');
          await interaction.reply({ embeds: [embed], ephemeral: true });
          return;
        }

        await supabase.from('Alts').insert({ player_id: player.id, character_name: character });

        const summary = await fetchCharacterSummary(character, realm).catch(() => null);
        const color = summary ? getClassColor(summary.class) : 0x2f3136;

        const { data: alts } = await supabase
          .from('Alts')
          .select('character_name')
          .eq('player_id', player.id);

        const charList = [player.main_character, ...(alts?.map(a => a.character_name) ?? [])];

        const embed = new EmbedBuilder()
          .setTitle('Registered Characters')
          .setColor(color)
          .setDescription(charList.join('\n'));

        await interaction.reply({ embeds: [embed], ephemeral: true });
      }
    }
  };

export default command;
