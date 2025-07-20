import { SlashCommandBuilder, SlashCommandSubcommandsOnlyBuilder, SlashCommandOptionsOnlyBuilder, ChatInputCommandInteraction } from 'discord.js';
import { SupabaseClient } from '@supabase/supabase-js';

export type SlashCommandData = SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder | SlashCommandOptionsOnlyBuilder;

export interface Command {
  data: SlashCommandData;
  execute: (interaction: ChatInputCommandInteraction, supabase: SupabaseClient) => Promise<void>;
}
