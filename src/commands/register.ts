import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { supabase } from '../supabaseClient';
import { calculateGearScore } from '../gearscore-calculator';
import fetch from 'node-fetch';
import { Command } from '../types';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('register')
    .setDescription('Registers a new character to your Discord account.')
    .addStringOption(option =>
      option.setName('character')
        .setDescription('Your character name')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('realm')
        .setDescription('Your realm')
        .setRequired(true)
        .addChoices(
          { name: 'Lordaeron', value: 'Lordaeron' },
          { name: 'Icecrown', value: 'Icecrown' },
          { name: 'Onyxia', value: 'Onyxia' }
        )),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const characterName = interaction.options.getString('character', true);
    const realm = interaction.options.getString('realm', true);
    const discordId = interaction.user.id;

    try {
      const { data: existingCharacter, error: selectError } = await supabase
        .from('players')
        .select('*')
        .eq('discord_id', discordId)
        .eq('character_name', characterName)
        .eq('realm', realm)
        .single();

      if (selectError && selectError.code !== 'PGRST116') {
        console.error('Error selecting character:', selectError);
        await interaction.editReply({ content: 'An error occurred while checking your characters.' });
        return;
      }

      if (existingCharacter) {
        await interaction.editReply({ content: 'You have already registered this character.' });
        return;
      }

      const { error: insertError } = await supabase
        .from('players')
        .insert([{ discord_id: discordId, character_name: characterName, realm }]);

      if (insertError) {
        console.error('Error inserting character:', insertError);
        await interaction.editReply({ content: 'There was an error registering your character.' });
        return;
      }

      const armoryUrl = `https://armory.warmane.com/character/${characterName}/${realm}`;
      const apiUrl = `https://armory.warmane.com/api/character/${characterName}/${realm}/summary`;
      const response = await fetch(apiUrl);
      const playerData = await response.json();

      if (playerData.error) {
        if (playerData.error === 'Character not found') {
          await interaction.editReply({ content: `Character ${characterName} registered, but could not be found on the Warmane Armory. Please check the spelling and try again.` });
          return;
        }
        await interaction.editReply({ content: `An error occurred while fetching data from Warmane: ${playerData.error}` });
        return;
      }

      const gearScore = calculateGearScore(playerData.equipment);

      await interaction.editReply({ content: `Character [${playerData.name}](${armoryUrl}) on ${playerData.realm} registered successfully! Your GearScore is **${gearScore}**.` });
    } catch (error) {
      console.error('Unexpected error in /register:', error);
      await interaction.editReply({ content: 'An unexpected error occurred while processing your command.' });
    }
  }
};

export default command;
