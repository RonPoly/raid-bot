import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { SupabaseClient } from '@supabase/supabase-js';
import { Command } from '../types';

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

    if (!/^[A-Za-z\u00C0-\u017F]{2,12}$/.test(character)) {
      await interaction.reply({ content: 'Invalid character name.', ephemeral: true });
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
        await interaction.reply({ content: 'You already registered a main character.', ephemeral: true });
        return;
      }

      await supabase.from('Players').insert({ discord_id: discordId, main_character: character, realm: process.env.WARMANE_REALM || 'Lordaeron' });
      await interaction.reply({ content: `Registered ${character} as your main character!`, ephemeral: true });
    } else {
      // Register alt
      const { data: player } = await supabase
        .from('Players')
        .select('id, main_character')
        .eq('discord_id', discordId)
        .maybeSingle();

      if (!player) {
        await interaction.reply({ content: 'You must register a main character first.', ephemeral: true });
        return;
      }
      if (player.main_character.toLowerCase() !== altOf.toLowerCase()) {
        await interaction.reply({ content: 'Alt must belong to your registered main.', ephemeral: true });
        return;
      }

      await supabase.from('Alts').insert({ player_id: player.id, character_name: character });
      await interaction.reply({ content: `Registered ${character} as an alt of ${altOf}.`, ephemeral: true });
    }
  }
};

export default command;
