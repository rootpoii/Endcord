-- Endcord D1 Database Schema

CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    badges TEXT DEFAULT '[]',
    custom_profile TEXT DEFAULT '{}',
    clan_tag TEXT DEFAULT '',
    updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS admin_badges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    badge_url TEXT NOT NULL,
    tooltip TEXT NOT NULL,
    badge_type TEXT DEFAULT 'CUSTOM',
    created_at INTEGER
);

CREATE TABLE IF NOT EXISTS app_updates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version TEXT NOT NULL,
    min_version TEXT DEFAULT '1.0.0',
    release_notes TEXT DEFAULT '',
    download_url TEXT DEFAULT 'https://endcord.com/EndcordInstaller.exe',
    force_update INTEGER DEFAULT 0,
    created_at INTEGER
);

-- Insert initial version record
INSERT INTO app_updates (version, min_version, release_notes, download_url, force_update, created_at)
VALUES ('1.14.15', '1.0.0', 'Initial Endcord Cloudflare API Release', 'https://endcord.com/EndcordInstaller.exe', 0, 1726320000);
