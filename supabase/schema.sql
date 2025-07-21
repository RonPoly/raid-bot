-- =================================================================
-- Final Schema for Warmane Raid Bot (Corrected for Case Sensitivity)
-- =================================================================

-- Extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =================================================================
-- Table to store configuration for each Discord server (guild)
-- =================================================================
CREATE TABLE IF NOT EXISTS guild_configs (
    guild_id TEXT PRIMARY KEY,          -- Discord Server ID
    name TEXT,                          -- In-game guild name
    realm TEXT,                         -- In-game guild realm
    member_role_id TEXT,
    officer_role_id TEXT,
    class_leader_role_id TEXT,
    raider_role_id TEXT,
    log_channel_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- =================================================================
-- Consolidated table for all player characters.
-- Using lowercase "players" to match code conventions.
-- =================================================================
CREATE TABLE IF NOT EXISTS players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guild_id TEXT NOT NULL,             -- The Discord Server ID this character is registered in
    discord_id TEXT NOT NULL,           -- The Discord User ID of the owner
    character_name TEXT NOT NULL,
    realm TEXT NOT NULL,
    class TEXT,
    gear_score INTEGER,                 -- Last known GearScore, updated periodically
    last_updated TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),

    -- Ensures a user cannot register the same character twice in the same server
    UNIQUE(discord_id, guild_id, character_name, realm)
);

-- Index for fast lookups of a user's characters in a specific server
CREATE INDEX IF NOT EXISTS players_discord_id_guild_id_idx ON players (discord_id, guild_id);


-- =================================================================
-- Tables for Raid Event Management
-- =================================================================

-- Raid events table
CREATE TABLE IF NOT EXISTS raids (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guild_id TEXT NOT NULL,             -- The Discord Server ID where the raid was created
    title TEXT NOT NULL,
    instance TEXT NOT NULL,
    scheduled_date TIMESTAMPTZ NOT NULL,
    tank_slots INTEGER NOT NULL DEFAULT 2,
    healer_slots INTEGER NOT NULL DEFAULT 6,
    dps_slots INTEGER NOT NULL DEFAULT 17,
    min_gearscore INTEGER NOT NULL DEFAULT 5500,
    raid_leader_id UUID REFERENCES players(id) ON DELETE SET NULL, -- References the new "players" table
    signup_message_id TEXT,
    reminder_sent BOOLEAN DEFAULT false,
    status TEXT NOT NULL DEFAULT 'open', -- e.g., 'open', 'closed', 'finished'
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Raid signups by character
CREATE TABLE IF NOT EXISTS raid_signups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    raid_id UUID NOT NULL REFERENCES raids(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE, -- References the specific character signing up
    role TEXT NOT NULL CHECK (role IN ('tank', 'healer', 'dps')),
    comment TEXT,
    signed_up_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    benched BOOLEAN DEFAULT false,

    -- Ensures a character can only sign up for a raid once
    UNIQUE(raid_id, player_id)
);

-- Saved raid templates per guild
CREATE TABLE IF NOT EXISTS raid_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guild_id TEXT NOT NULL,
    name TEXT NOT NULL,
    instance TEXT NOT NULL,
    tank_slots INTEGER NOT NULL,
    healer_slots INTEGER NOT NULL,
    dps_slots INTEGER NOT NULL,
    min_gearscore INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(guild_id, name)
);

-- Raid reminder logs / attendance
CREATE TABLE IF NOT EXISTS raid_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    raid_id UUID NOT NULL REFERENCES raids(id) ON DELETE CASCADE,
    character_name TEXT NOT NULL,
    role TEXT NOT NULL,
    logged_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
