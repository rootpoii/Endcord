/**
 * Endcord Cloudflare Worker Backend & High-Tech Management Console
 * Domain: api.endcord.com | Database: Cloudflare D1 (endcord-db)
 */

const ADMIN_SECRET = "ec_sec_f24b417136199503edf4cd5289caa6d0a2a3277d66105ada4bf72663185066a4";

// ── Rate Limiting (Brute Force Guard) ──
const rateLimitMap = new Map();
function checkRateLimit(ip) {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);
    if (!entry) return true;
    if (now - entry.windowStart > 60000) { rateLimitMap.delete(ip); return true; }
    return entry.attempts < 5;
}
function recordFail(ip) {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);
    if (!entry || now - entry.windowStart > 60000) {
        rateLimitMap.set(ip, { windowStart: now, attempts: 1 });
    } else {
        entry.attempts++;
    }
}

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Secret, User-Agent",
    "Access-Control-Max-Age": "86400"
};

function json(data, status = 200, extra = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json; charset=utf-8", ...CORS_HEADERS, ...extra }
    });
}

async function ensureTables(db) {
    try {
        await db.prepare(`
            CREATE TABLE IF NOT EXISTS badge_catalog (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                icon_url TEXT NOT NULL,
                tooltip TEXT,
                created_at INTEGER
            )
        `).run();
    } catch {}
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const path = url.pathname;
        const method = request.method.toUpperCase();

        if (method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });

        const db = env.DB;
        if (!db) return json({ error: "D1 Database 'DB' binding not found in Worker configuration." }, 500);

        const clientIP = request.headers.get("CF-Connecting-IP") || "unknown";

        try {
            // ── Health Endpoint ──
            if (path === "/" || path === "/health") {
                return json({ status: "online", service: "Endcord API Engine", domain: "api.endcord.com", timestamp: Date.now() });
            }

            // ── App Version & Updates ──
            if (path === "/version" || path === "/update" || path === "/api/version") {
                const rec = await db.prepare("SELECT * FROM app_updates ORDER BY id DESC LIMIT 1").first();
                return json({
                    version: rec?.version || "1.14.15",
                    min_version: rec?.min_version || "1.0.0",
                    release_notes: rec?.release_notes || "Endcord Stable Release",
                    download_url: rec?.download_url || "https://endcord.com/EndcordInstaller.exe",
                    force_update: Boolean(rec?.force_update),
                    timestamp: rec?.created_at || Date.now()
                });
            }

            // ── Bulk Profiles (profiles.json compatibility) ──
            if (path === "/profiles" || path === "/profiles.json" || path === "/api/profiles") {
                const [users, adminBadges] = await Promise.all([
                    db.prepare("SELECT user_id, badges FROM users").all(),
                    db.prepare("SELECT user_id, badge_url, tooltip FROM admin_badges").all()
                ]);

                const dictionary = {};
                for (const row of (users?.results || [])) {
                    try {
                        const parsed = JSON.parse(row.badges || "[]");
                        if (Array.isArray(parsed) && parsed.length) dictionary[row.user_id] = parsed;
                    } catch {}
                }
                for (const row of (adminBadges?.results || [])) {
                    if (!dictionary[row.user_id]) dictionary[row.user_id] = [];
                    dictionary[row.user_id].unshift({ badge: row.badge_url, tooltip: row.tooltip, official: true });
                }
                return json(dictionary, 200, { "Cache-Control": "public, max-age=15, s-maxage=30" });
            }

            // ── Single Profile ──
            if ((path.startsWith("/profile/") || path.startsWith("/api/profile/")) && !path.includes("/save")) {
                const userId = path.split("/").pop();
                if (!userId) return json({ error: "Missing user ID parameter" }, 400);

                const [userRow, adminBadges] = await Promise.all([
                    db.prepare("SELECT * FROM users WHERE user_id = ?").bind(userId).first(),
                    db.prepare("SELECT id, badge_url, tooltip, badge_type FROM admin_badges WHERE user_id = ?").bind(userId).all()
                ]);

                let userBadges = [], customProfile = {}, clanTag = "";
                if (userRow) {
                    try { userBadges = JSON.parse(userRow.badges || "[]"); } catch {}
                    try { customProfile = JSON.parse(userRow.custom_profile || "{}"); } catch {}
                    clanTag = userRow.clan_tag || "";
                }

                const official = (adminBadges?.results || []).map(b => ({
                    id: b.id, badge: b.badge_url, tooltip: b.tooltip, type: b.badge_type, official: true
                }));

                return json({ userId, badges: [...official, ...userBadges], customProfile, clanTag, updatedAt: userRow?.updated_at || Date.now() });
            }

            // ── Client Profile Save ──
            if ((path === "/profile/save" || path === "/api/profile/save") && method === "POST") {
                const { userId, badges, customProfile, clanTag } = await request.json();
                if (!userId) return json({ error: "Missing userId" }, 400);

                const now = Date.now();
                await db.prepare(`
                    INSERT INTO users (user_id, badges, custom_profile, clan_tag, updated_at)
                    VALUES (?, ?, ?, ?, ?)
                    ON CONFLICT(user_id) DO UPDATE SET
                        badges = excluded.badges,
                        custom_profile = excluded.custom_profile,
                        clan_tag = excluded.clan_tag,
                        updated_at = excluded.updated_at
                `).bind(
                    userId,
                    JSON.stringify(Array.isArray(badges) ? badges : []),
                    JSON.stringify(customProfile || {}),
                    typeof clanTag === "string" ? clanTag.slice(0, 10) : "",
                    now
                ).run();

                return json({ ok: true, message: "Profile saved", userId, updatedAt: now });
            }

            // ── Management Console Endpoints ──
            if (path.startsWith("/admin")) {
                if (method === "GET" && (path === "/admin" || path === "/admin/")) {
                    return new Response(renderConsoleHtml(), { headers: { "Content-Type": "text/html; charset=utf-8", ...CORS_HEADERS } });
                }

                // Brute Force Guard
                if (!checkRateLimit(clientIP)) {
                    return json({ error: "Rate limit exceeded. Too many failed attempts. Try again in 60s." }, 429);
                }

                const auth = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim() || request.headers.get("X-Admin-Secret");
                if (auth !== ADMIN_SECRET) {
                    recordFail(clientIP);
                    return json({ error: "Unauthorized: Invalid administrative credentials" }, 401);
                }
                rateLimitMap.delete(clientIP);
                await ensureTables(db);

                // Admin: Comprehensive Data Overview
                if (path === "/admin/data" && method === "GET") {
                    const [badges, userCount, update, users, catalog] = await Promise.all([
                        db.prepare("SELECT * FROM admin_badges ORDER BY id DESC").all(),
                        db.prepare("SELECT COUNT(*) as count FROM users").first(),
                        db.prepare("SELECT * FROM app_updates ORDER BY id DESC LIMIT 1").first(),
                        db.prepare("SELECT user_id, badges, clan_tag, updated_at FROM users ORDER BY updated_at DESC LIMIT 600").all(),
                        db.prepare("SELECT * FROM badge_catalog ORDER BY id DESC").all()
                    ]);
                    return json({
                        ok: true,
                        adminBadges: badges?.results || [],
                        totalUsers: userCount?.count || 0,
                        latestUpdate: update || null,
                        users: users?.results || [],
                        catalog: catalog?.results || []
                    });
                }

                // Admin: Badge Catalog List
                if (path === "/admin/catalog" && method === "GET") {
                    const res = await db.prepare("SELECT * FROM badge_catalog ORDER BY id DESC").all();
                    return json({ ok: true, catalog: res?.results || [] });
                }

                // Admin: Add to Badge Catalog
                if (path === "/admin/catalog/add" && method === "POST") {
                    const { name, iconUrl, tooltip } = await request.json();
                    if (!name || !iconUrl) return json({ error: "Badge name and icon URL/Data are required" }, 400);

                    const res = await db.prepare(`
                        INSERT INTO badge_catalog (name, icon_url, tooltip, created_at)
                        VALUES (?, ?, ?, ?)
                    `).bind(name.trim(), iconUrl.trim(), (tooltip || name).trim(), Date.now()).run();

                    return json({ ok: true, message: "Badge registered to catalog", id: res.meta?.last_row_id });
                }

                // Admin: Delete from Badge Catalog
                if (path === "/admin/catalog/delete" && method === "POST") {
                    const { id } = await request.json();
                    await db.prepare("DELETE FROM badge_catalog WHERE id = ?").bind(id).run();
                    return json({ ok: true, message: "Catalog badge removed" });
                }

                // Admin: Get Single User Profile with Badges
                if (path.startsWith("/admin/user/") && method === "GET") {
                    const uid = path.split("/").pop();
                    const [user, badges] = await Promise.all([
                        db.prepare("SELECT * FROM users WHERE user_id = ?").bind(uid).first(),
                        db.prepare("SELECT * FROM admin_badges WHERE user_id = ?").bind(uid).all()
                    ]);
                    let parsedBadges = [];
                    if (user?.badges) {
                        try { parsedBadges = JSON.parse(user.badges); } catch {}
                    }
                    return json({
                        ok: true,
                        user: user || null,
                        badges: parsedBadges,
                        adminBadges: badges?.results || []
                    });
                }

                // Admin: Overwrite / Update User Badges (Add / Remove / Modify)
                if (path === "/admin/user/badges/update" && method === "POST") {
                    const { userId, badges } = await request.json();
                    if (!userId) return json({ error: "Missing userId parameter" }, 400);
                    if (!Array.isArray(badges)) return json({ error: "Badges must be an array" }, 400);

                    const now = Date.now();
                    const badgesJson = JSON.stringify(badges);

                    await db.prepare(`
                        INSERT INTO users (user_id, badges, custom_profile, clan_tag, updated_at)
                        VALUES (?, ?, '{}', '', ?)
                        ON CONFLICT(user_id) DO UPDATE SET
                            badges = excluded.badges,
                            updated_at = excluded.updated_at
                    `).bind(userId.trim(), badgesJson, now).run();

                    return json({ ok: true, message: `Badges for ${userId} successfully updated`, count: badges.length });
                }

                // Admin: Delete User
                if (path === "/admin/user/delete" && method === "POST") {
                    const { userId } = await request.json();
                    await db.prepare("DELETE FROM users WHERE user_id = ?").bind(userId).run();
                    return json({ ok: true, message: "User record purged" });
                }

                // Admin: Add Official Badge
                if (path === "/admin/badge/add" && method === "POST") {
                    const { userId, badgeUrl, tooltip, badgeType } = await request.json();
                    if (!userId || !badgeUrl) return json({ error: "Missing user ID or badge URL" }, 400);
                    await db.prepare(`
                        INSERT INTO admin_badges (user_id, badge_url, tooltip, badge_type, created_at)
                        VALUES (?, ?, ?, ?, ?)
                    `).bind(userId.trim(), badgeUrl.trim(), tooltip || "Official Badge", badgeType || "OFFICIAL", Date.now()).run();
                    return json({ ok: true, message: "Official badge assigned" });
                }

                // Admin: Delete Official Badge
                if (path === "/admin/badge/delete" && method === "POST") {
                    const { id } = await request.json();
                    await db.prepare("DELETE FROM admin_badges WHERE id = ?").bind(id).run();
                    return json({ ok: true, message: "Official badge revoked" });
                }

                // Admin: Publish Update
                if (path === "/admin/version/publish" && method === "POST") {
                    const { version, minVersion, releaseNotes, downloadUrl, forceUpdate } = await request.json();
                    await db.prepare(`
                        INSERT INTO app_updates (version, min_version, release_notes, download_url, force_update, created_at)
                        VALUES (?, ?, ?, ?, ?, ?)
                    `).bind(version, minVersion || "1.0.0", releaseNotes || "", downloadUrl || "https://endcord.com/EndcordInstaller.exe", forceUpdate ? 1 : 0, Date.now()).run();
                    return json({ ok: true, message: `Release ${version} published` });
                }

                // Admin: Bulk Import (profiles.json format)
                if (path === "/admin/import" && method === "POST") {
                    const { profiles } = await request.json();
                    if (!profiles || typeof profiles !== "object") return json({ error: "Invalid JSON format" }, 400);
                    let count = 0;
                    const now = Date.now();
                    for (const [uid, bList] of Object.entries(profiles)) {
                        try {
                            await db.prepare(`
                                INSERT INTO users (user_id, badges, custom_profile, clan_tag, updated_at)
                                VALUES (?, ?, '{}', '', ?)
                                ON CONFLICT(user_id) DO UPDATE SET badges = excluded.badges, updated_at = excluded.updated_at
                            `).bind(uid, JSON.stringify(Array.isArray(bList) ? bList : []), now).run();
                            count++;
                        } catch {}
                    }
                    return json({ ok: true, message: `Import complete: ${count} profiles synchronized`, imported: count });
                }

                // Admin: Export Full Database Backup
                if (path === "/admin/export" && method === "GET") {
                    const [users, badges, updates, catalog] = await Promise.all([
                        db.prepare("SELECT * FROM users").all(),
                        db.prepare("SELECT * FROM admin_badges").all(),
                        db.prepare("SELECT * FROM app_updates ORDER BY id DESC").all(),
                        db.prepare("SELECT * FROM badge_catalog ORDER BY id DESC").all()
                    ]);
                    return json({
                        exportedAt: Date.now(),
                        users: users?.results || [],
                        adminBadges: badges?.results || [],
                        updates: updates?.results || [],
                        catalog: catalog?.results || []
                    });
                }
            }

            return json({ error: "Resource Not Found", path }, 404);
        } catch (e) {
            return json({ error: "Internal Server Error", message: e.message || String(e) }, 500);
        }
    }
};

// ══════════════════════════════════════════════════════════════════════════
// ULTRA-MODERN HIGH-TECH MANAGEMENT CONSOLE (ZERO EMOJIS, VECTOR ICONS)
// ══════════════════════════════════════════════════════════════════════════
function renderConsoleHtml() {
    return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Endcord Engine Console</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; background-color: #07090e; }
        code, .mono { font-family: 'JetBrains Mono', monospace; }
        .surface-panel { background: rgba(13, 16, 24, 0.7); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.06); }
        .surface-card { background: rgba(19, 24, 38, 0.5); backdrop-filter: blur(14px); border: 1px solid rgba(255, 255, 255, 0.05); }
        .surface-card:hover { border-color: rgba(99, 102, 241, 0.25); }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.08); border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.16); }
    </style>
</head>
<body class="text-slate-200 min-h-screen selection:bg-indigo-500/30 selection:text-indigo-200">

    <!-- LOGIN SCREEN -->
    <div id="login-screen" class="fixed inset-0 z-50 flex items-center justify-center bg-[#07090e]/95 backdrop-blur-2xl p-4">
        <div class="surface-panel w-full max-w-md rounded-2xl p-8 border border-white/[0.08] shadow-2xl relative overflow-hidden">
            <div class="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
            <div class="flex items-center gap-3 mb-6">
                <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-indigo-700 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/20">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                </div>
                <div>
                    <h1 class="text-lg font-bold text-white tracking-tight">Endcord Console</h1>
                    <p class="text-xs text-slate-400">Cloudflare Edge Architecture</p>
                </div>
            </div>
            <div class="space-y-4">
                <div>
                    <label class="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Master Authentication Secret</label>
                    <input id="key-input" type="password" placeholder="ec_sec_..." class="w-full px-4 py-3 rounded-xl bg-[#0b0e17] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/40 transition">
                </div>
                <button onclick="login()" class="w-full py-3 rounded-xl bg-white text-black hover:bg-slate-200 font-semibold text-sm transition shadow-sm">Authorize Session</button>
                <div id="login-err" class="text-rose-400 text-xs text-center hidden pt-1"></div>
            </div>
        </div>
    </div>

    <!-- MAIN CONSOLE -->
    <div id="app" class="hidden min-h-screen flex flex-col md:flex-row">

        <!-- SIDEBAR NAVIGATION -->
        <aside class="w-full md:w-64 surface-panel border-b md:border-b-0 md:border-r border-white/[0.06] p-5 flex flex-col justify-between shrink-0">
            <div>
                <!-- Brand -->
                <div class="flex items-center gap-3 pb-6 border-b border-white/[0.06] mb-6">
                    <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-indigo-700 flex items-center justify-center text-white shadow-sm">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                    </div>
                    <div>
                        <span class="font-bold text-white text-sm tracking-tight block">Endcord Engine</span>
                        <div class="flex items-center gap-1.5 mt-0.5">
                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            <span class="text-[10px] font-medium text-slate-400">D1 Edge Active</span>
                        </div>
                    </div>
                </div>

                <!-- Navigation List -->
                <nav class="space-y-1">
                    <button onclick="tab('overview')" id="btn-overview" class="nav-btn w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition bg-white/[0.06] text-white border border-white/[0.08]">
                        <svg class="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
                        <span>Dashboard</span>
                    </button>

                    <button onclick="tab('studio')" id="btn-studio" class="nav-btn w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition text-slate-400 hover:bg-white/[0.03] hover:text-white">
                        <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3Z"/></svg>
                        <span>Badge Studio</span>
                        <span class="ml-auto text-[9px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded font-mono font-bold">PRO</span>
                    </button>

                    <button onclick="tab('users')" id="btn-users" class="nav-btn w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition text-slate-400 hover:bg-white/[0.03] hover:text-white">
                        <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                        <span>User Profiles</span>
                    </button>

                    <button onclick="tab('official')" id="btn-official" class="nav-btn w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition text-slate-400 hover:bg-white/[0.03] hover:text-white">
                        <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24"><circle cx="12" cy="8" r="6"/><path d="m15.5 12.9 1.5 8.5-4-2.7-4 2.7 1.5-8.5"/></svg>
                        <span>Official Roles</span>
                    </button>

                    <button onclick="tab('releases')" id="btn-releases" class="nav-btn w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition text-slate-400 hover:bg-white/[0.03] hover:text-white">
                        <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                        <span>Releases</span>
                    </button>

                    <button onclick="tab('storage')" id="btn-storage" class="nav-btn w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition text-slate-400 hover:bg-white/[0.03] hover:text-white">
                        <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/></svg>
                        <span>Import / Backup</span>
                    </button>

                    <button onclick="tab('security')" id="btn-security" class="nav-btn w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition text-slate-400 hover:bg-white/[0.03] hover:text-white">
                        <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                        <span>Security Audit</span>
                    </button>
                </nav>
            </div>

            <!-- Footer -->
            <div class="pt-6 border-t border-white/[0.06]">
                <button onclick="logout()" class="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/[0.05] transition border border-white/[0.04]">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
                    <span>Terminate Session</span>
                </button>
            </div>
        </aside>

        <!-- MAIN VIEWPORT -->
        <main class="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full overflow-y-auto">

            <!-- ════ TAB: DASHBOARD OVERVIEW ════ -->
            <section id="tab-overview" class="tab-content space-y-6">
                <div class="flex items-center justify-between pb-4 border-b border-white/[0.06]">
                    <div>
                        <h2 class="text-xl font-bold text-white tracking-tight">System Metrics</h2>
                        <p class="text-xs text-slate-400 mt-0.5">Realtime edge analytics and telemetry</p>
                    </div>
                    <button onclick="refreshData()" class="flex items-center gap-2 px-3.5 py-2 rounded-xl surface-card text-xs font-medium text-slate-300 hover:text-white transition">
                        <svg class="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                        <span>Sync</span>
                    </button>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div class="surface-card rounded-2xl p-5">
                        <span class="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">Synchronized Users</span>
                        <div id="metric-users" class="text-2xl font-bold text-white mt-1">0</div>
                    </div>
                    <div class="surface-card rounded-2xl p-5">
                        <span class="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">Custom Badge Catalog</span>
                        <div id="metric-catalog" class="text-2xl font-bold text-indigo-400 mt-1">0</div>
                    </div>
                    <div class="surface-card rounded-2xl p-5">
                        <span class="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">Official Assignments</span>
                        <div id="metric-badges" class="text-2xl font-bold text-purple-400 mt-1">0</div>
                    </div>
                    <div class="surface-card rounded-2xl p-5">
                        <span class="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">Release Distribution</span>
                        <div id="metric-version" class="text-2xl font-bold text-cyan-400 mt-1">-</div>
                    </div>
                </div>

                <div class="surface-card rounded-2xl p-6">
                    <h3 class="text-sm font-bold text-white mb-4">Recent User Synchronizations</h3>
                    <div class="overflow-x-auto">
                        <table class="w-full text-left text-xs">
                            <thead class="text-[10px] uppercase text-slate-400 border-b border-white/[0.06]">
                                <tr>
                                    <th class="py-3 px-4 font-semibold">User Snowflake</th>
                                    <th class="py-3 px-4 font-semibold">Badge Inventory</th>
                                    <th class="py-3 px-4 font-semibold">Clan Tag</th>
                                    <th class="py-3 px-4 font-semibold">Timestamp</th>
                                </tr>
                            </thead>
                            <tbody id="overview-users" class="divide-y divide-white/[0.04]">
                                <tr><td colspan="4" class="text-center py-8 text-slate-500">Querying database...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            <!-- ════ TAB: BADGE STUDIO (CREATE & ASSIGN) ════ -->
            <section id="tab-studio" class="tab-content hidden space-y-6">
                <div class="pb-4 border-b border-white/[0.06]">
                    <h2 class="text-xl font-bold text-white tracking-tight">Badge Studio & User Assignee</h2>
                    <p class="text-xs text-slate-400 mt-0.5">Define custom badges, preview icons, and dynamically manage user badges</p>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">

                    <!-- SECTION 1: BADGE DEFINITION -->
                    <div class="lg:col-span-5 surface-card rounded-2xl p-6 space-y-4">
                        <h3 class="text-sm font-bold text-white flex items-center gap-2">
                            <svg class="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 5v14m-7-7h14"/></svg>
                            <span>Define New Badge</span>
                        </h3>

                        <div>
                            <label class="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Badge Title</label>
                            <input id="create-badge-name" type="text" placeholder="e.g. Endcord Contributor" class="w-full px-3.5 py-2.5 rounded-xl bg-[#0b0e17] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-indigo-500/60">
                        </div>

                        <div>
                            <label class="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Tooltip Description</label>
                            <input id="create-badge-tooltip" type="text" placeholder="e.g. Official Developer & Contributor" class="w-full px-3.5 py-2.5 rounded-xl bg-[#0b0e17] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-indigo-500/60">
                        </div>

                        <!-- Image File Upload or URL -->
                        <div>
                            <label class="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Badge Icon (Upload File or Enter URL)</label>
                            <div class="space-y-2">
                                <label class="flex flex-col items-center justify-center border border-dashed border-white/[0.12] hover:border-indigo-500/50 rounded-xl p-4 cursor-pointer bg-[#0b0e17] transition group">
                                    <svg class="w-6 h-6 text-slate-500 group-hover:text-indigo-400 transition mb-1" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                                    <span class="text-xs text-slate-300 group-hover:text-white font-medium">Select Image File (PNG, GIF, WebP)</span>
                                    <span class="text-[10px] text-slate-500 mt-0.5">Encodes directly into database</span>
                                    <input type="file" id="create-badge-file" accept="image/*" class="hidden" onchange="handleFileUpload(event)">
                                </label>
                                <input id="create-badge-url" type="text" placeholder="Or enter direct image URL..." class="w-full px-3.5 py-2.5 rounded-xl bg-[#0b0e17] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-indigo-500/60" oninput="updateBadgePreview()">
                            </div>
                        </div>

                        <!-- Live Preview Card -->
                        <div class="p-3.5 rounded-xl bg-[#090b11] border border-white/[0.06] flex items-center gap-3">
                            <div class="w-10 h-10 rounded-lg bg-slate-900 border border-white/[0.08] flex items-center justify-center shrink-0 overflow-hidden">
                                <img id="preview-badge-img" src="" class="w-6 h-6 object-contain hidden">
                                <span id="preview-badge-placeholder" class="text-[10px] text-slate-600 font-mono">ICON</span>
                            </div>
                            <div class="overflow-hidden">
                                <span id="preview-badge-title" class="text-xs font-semibold text-white block truncate">Badge Preview</span>
                                <span id="preview-badge-desc" class="text-[10px] text-slate-400 block truncate">Tooltip appears here</span>
                            </div>
                        </div>

                        <button onclick="saveBadgeToCatalog()" class="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition shadow-sm">Save to Catalog</button>
                    </div>

                    <!-- SECTION 2: USER BADGE MANAGER (OVERWRITE / ADD / SUBTRACT) -->
                    <div class="lg:col-span-7 surface-card rounded-2xl p-6 space-y-5">
                        <div class="flex items-center justify-between">
                            <h3 class="text-sm font-bold text-white flex items-center gap-2">
                                <svg class="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                                <span>User Badge Manager</span>
                            </h3>
                            <span class="text-[10px] text-slate-400 font-mono">Dynamic Overwrite Mode</span>
                        </div>

                        <!-- User ID Input -->
                        <div class="flex gap-2">
                            <input id="manage-userid" type="text" placeholder="Discord User ID (Snowflake)..." class="flex-1 px-3.5 py-2.5 rounded-xl bg-[#0b0e17] border border-white/[0.08] text-xs text-white mono focus:outline-none focus:border-indigo-500/60" onkeydown="if(event.key==='Enter') loadUserBadges()">
                            <button onclick="loadUserBadges()" class="px-4 py-2.5 rounded-xl bg-white text-black hover:bg-slate-200 text-xs font-semibold transition shrink-0">Load User</button>
                        </div>

                        <!-- Active Staged Badges for Selected User -->
                        <div>
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Assigned Badges (<span id="staged-count">0</span>)</span>
                                <span class="text-[10px] text-slate-500">Click remove button to subtract badge</span>
                            </div>
                            <div id="staged-badges-list" class="min-h-[140px] max-h-[220px] overflow-y-auto space-y-1.5 p-3 rounded-xl bg-[#090b11] border border-white/[0.06]">
                                <div class="h-full flex items-center justify-center text-slate-500 text-xs py-8">Enter a User ID and load profile to manage badges</div>
                            </div>
                        </div>

                        <!-- Add from Catalog Dropdown / Quick Picker -->
                        <div>
                            <span class="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Append Badge from Catalog</span>
                            <div class="flex gap-2">
                                <select id="catalog-picker" class="flex-1 px-3.5 py-2.5 rounded-xl bg-[#0b0e17] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-indigo-500/60">
                                    <option value="">Choose defined badge from catalog...</option>
                                </select>
                                <button onclick="appendFromCatalog()" class="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition shrink-0">Append Badge</button>
                            </div>
                        </div>

                        <!-- Final Commit / Save Button -->
                        <div class="pt-2 border-t border-white/[0.06] flex items-center justify-between">
                            <span class="text-[11px] text-slate-400">Writes directly into Cloudflare D1</span>
                            <button onclick="saveUserBadgesToD1()" class="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-sm flex items-center gap-2">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                                <span>Save Changes to Database</span>
                            </button>
                        </div>
                    </div>

                </div>

                <!-- CATALOG VIEW SECTION -->
                <div class="surface-card rounded-2xl p-6">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-sm font-bold text-white">Registered Badge Catalog</h3>
                        <span id="catalog-total" class="text-xs font-mono text-slate-400">0 badges</span>
                    </div>
                    <div id="catalog-grid" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        <div class="text-slate-500 text-xs py-6 col-span-full text-center">No badges created yet. Define one above.</div>
                    </div>
                </div>
            </section>

            <!-- ════ TAB: USER DIRECTORY ════ -->
            <section id="tab-users" class="tab-content hidden space-y-6">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.06]">
                    <div>
                        <h2 class="text-xl font-bold text-white tracking-tight">User Directory</h2>
                        <p class="text-xs text-slate-400 mt-0.5">Inspect and regulate all stored Discord users</p>
                    </div>
                    <div class="relative w-full sm:w-72">
                        <input id="user-search" oninput="filterUsers()" type="text" placeholder="Filter by User ID..." class="w-full pl-9 pr-4 py-2 rounded-xl bg-[#0b0e17] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-indigo-500/60">
                        <svg class="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" x2="21" y1="21" y2="16.65"/></svg>
                    </div>
                </div>

                <div class="surface-card rounded-2xl overflow-hidden">
                    <table class="w-full text-left text-xs">
                        <thead class="text-[10px] uppercase text-slate-400 bg-white/[0.02] border-b border-white/[0.06]">
                            <tr>
                                <th class="py-3 px-4 font-semibold">User Snowflake</th>
                                <th class="py-3 px-4 font-semibold">Badges Preview</th>
                                <th class="py-3 px-4 font-semibold">Total</th>
                                <th class="py-3 px-4 font-semibold">Clan Tag</th>
                                <th class="py-3 px-4 font-semibold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="user-table-body" class="divide-y divide-white/[0.04]">
                            <tr><td colspan="5" class="text-center py-8 text-slate-500">Querying database...</td></tr>
                        </tbody>
                    </table>
                </div>
            </section>

            <!-- ════ TAB: OFFICIAL ROLES ════ -->
            <section id="tab-official" class="tab-content hidden space-y-6">
                <div class="pb-4 border-b border-white/[0.06]">
                    <h2 class="text-xl font-bold text-white tracking-tight">Official Badges</h2>
                    <p class="text-xs text-slate-400 mt-0.5">Top-priority administrative badge overrides</p>
                </div>

                <div class="surface-card rounded-2xl p-6 space-y-4">
                    <h3 class="text-sm font-bold text-white">Grant Official Badge</h3>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">User ID</label>
                            <input id="off-userid" type="text" placeholder="1390609041897554050" class="w-full px-3.5 py-2.5 rounded-xl bg-[#0b0e17] border border-white/[0.08] text-xs text-white mono focus:outline-none">
                        </div>
                        <div>
                            <label class="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Role Classification</label>
                            <select id="off-type" class="w-full px-3.5 py-2.5 rounded-xl bg-[#0b0e17] border border-white/[0.08] text-xs text-white focus:outline-none">
                                <option value="OWNER">Owner & Lead Dev</option>
                                <option value="STAFF">Staff & Moderator</option>
                                <option value="VIP">VIP Supporter</option>
                                <option value="DONOR">Donor</option>
                                <option value="BUG_HUNTER">Bug Hunter</option>
                                <option value="CUSTOM">Custom System</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Badge Asset URL</label>
                            <input id="off-url" type="text" placeholder="https://cdn.discordapp.com/..." class="w-full px-3.5 py-2.5 rounded-xl bg-[#0b0e17] border border-white/[0.08] text-xs text-white focus:outline-none">
                        </div>
                        <div>
                            <label class="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Tooltip Text</label>
                            <input id="off-tooltip" type="text" placeholder="e.g. Official Endcord Developer" class="w-full px-3.5 py-2.5 rounded-xl bg-[#0b0e17] border border-white/[0.08] text-xs text-white focus:outline-none">
                        </div>
                    </div>
                    <button onclick="addOfficialBadge()" class="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition">Grant Official Status</button>
                </div>

                <div class="surface-card rounded-2xl overflow-hidden">
                    <table class="w-full text-left text-xs">
                        <thead class="text-[10px] uppercase text-slate-400 bg-white/[0.02] border-b border-white/[0.06]">
                            <tr>
                                <th class="py-3 px-4 font-semibold">Icon</th>
                                <th class="py-3 px-4 font-semibold">User ID</th>
                                <th class="py-3 px-4 font-semibold">Type</th>
                                <th class="py-3 px-4 font-semibold">Tooltip</th>
                                <th class="py-3 px-4 font-semibold text-right">Revoke</th>
                            </tr>
                        </thead>
                        <tbody id="official-table-body" class="divide-y divide-white/[0.04]">
                            <tr><td colspan="5" class="text-center py-8 text-slate-500">Querying records...</td></tr>
                        </tbody>
                    </table>
                </div>
            </section>

            <!-- ════ TAB: RELEASES ════ -->
            <section id="tab-releases" class="tab-content hidden space-y-6">
                <div class="pb-4 border-b border-white/[0.06]">
                    <h2 class="text-xl font-bold text-white tracking-tight">Release Distribution</h2>
                    <p class="text-xs text-slate-400 mt-0.5">Control client app versions and enforce seamless upgrades</p>
                </div>

                <div class="surface-card rounded-2xl p-6 space-y-4">
                    <h3 class="text-sm font-bold text-white">Broadcast New Release</h3>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Target Version</label>
                            <input id="rel-version" type="text" placeholder="1.15.0" class="w-full px-3.5 py-2.5 rounded-xl bg-[#0b0e17] border border-white/[0.08] text-xs text-white focus:outline-none">
                        </div>
                        <div>
                            <label class="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Installer Download URL</label>
                            <input id="rel-url" type="text" value="https://endcord.com/EndcordInstaller.exe" class="w-full px-3.5 py-2.5 rounded-xl bg-[#0b0e17] border border-white/[0.08] text-xs text-white focus:outline-none">
                        </div>
                        <div class="sm:col-span-2">
                            <label class="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Changelog & Notes</label>
                            <textarea id="rel-notes" rows="3" placeholder="Summary of upgrades and stability patches..." class="w-full px-3.5 py-2.5 rounded-xl bg-[#0b0e17] border border-white/[0.08] text-xs text-white focus:outline-none"></textarea>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <input id="rel-force" type="checkbox" class="w-4 h-4 rounded bg-[#0b0e17] border-white/[0.08] text-indigo-600">
                        <label for="rel-force" class="text-xs text-slate-300">Enforce Mandatory Update across all active clients</label>
                    </div>
                    <button onclick="publishRelease()" class="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition">Deploy Release Broadcast</button>
                </div>
            </section>

            <!-- ════ TAB: STORAGE & BACKUP ════ -->
            <section id="tab-storage" class="tab-content hidden space-y-6">
                <div class="pb-4 border-b border-white/[0.06]">
                    <h2 class="text-xl font-bold text-white tracking-tight">Database Operations</h2>
                    <p class="text-xs text-slate-400 mt-0.5">Bulk synchronizations and full JSON backups</p>
                </div>

                <div class="surface-card rounded-2xl p-6">
                    <h3 class="text-sm font-bold text-white mb-2">Bulk JSON Synchronization</h3>
                    <p class="text-xs text-slate-400 mb-4">Ingest massive legacy profiles.json payloads directly into D1 SQLite storage.</p>
                    <textarea id="import-box" rows="8" placeholder='{ "1307705591434575944": [ { "badge": "...", "tooltip": "..." } ] }' class="w-full p-4 rounded-xl bg-[#0b0e17] border border-white/[0.08] text-xs mono text-cyan-300 focus:outline-none mb-4"></textarea>
                    <button onclick="executeBulkImport()" class="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition">Execute D1 Sync</button>
                </div>

                <div class="surface-card rounded-2xl p-6 flex items-center justify-between">
                    <div>
                        <h3 class="text-sm font-bold text-white">Download Full Snapshot</h3>
                        <p class="text-xs text-slate-400 mt-1">Export entire tables (users, catalog, admin badges, releases) into a JSON backup archive.</p>
                    </div>
                    <button onclick="downloadBackup()" class="px-5 py-2.5 rounded-xl bg-white text-black hover:bg-slate-200 font-semibold text-xs transition">Export Snapshot</button>
                </div>
            </section>

            <!-- ════ TAB: SECURITY AUDIT ════ -->
            <section id="tab-security" class="tab-content hidden space-y-6">
                <div class="pb-4 border-b border-white/[0.06]">
                    <h2 class="text-xl font-bold text-white tracking-tight">Security Telemetry</h2>
                    <p class="text-xs text-slate-400 mt-0.5">Cryptographic protection layers guarding the edge deployment</p>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="surface-card rounded-2xl p-5 border-emerald-500/20">
                        <div class="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-3">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                        </div>
                        <h4 class="font-bold text-white text-sm">Parameterized SQL Engine</h4>
                        <p class="text-slate-400 text-xs mt-1">100% Prepared Statements via Cloudflare D1. Zero string concatenation or injection surfaces.</p>
                    </div>

                    <div class="surface-card rounded-2xl p-5 border-emerald-500/20">
                        <div class="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-3">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        </div>
                        <h4 class="font-bold text-white text-sm">IP Rate Limiter Active</h4>
                        <p class="text-slate-400 text-xs mt-1">5 failed attempts per minute locks the client IP with 429 status response.</p>
                    </div>

                    <div class="surface-card rounded-2xl p-5 border-indigo-500/20">
                        <div class="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-3">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="m21 2-2 2m-6 6 7 7-3.5 3.5a2.12 2.12 0 0 1-3 0L10.5 17.5M10.5 17.5l-3 3-3-3 3-3m-3 3L2 12l7-7 4 4"/></svg>
                        </div>
                        <h4 class="font-bold text-white text-sm">High-Entropy 256-bit Key</h4>
                        <p class="text-slate-400 text-xs mt-1">Cryptographically generated authorization token guarding all privileged routes.</p>
                    </div>
                </div>
            </section>

        </main>
    </div>

    <!-- TOAST NOTIFICATION -->
    <div id="toast" class="fixed bottom-6 right-6 z-50 hidden px-4 py-3 rounded-xl font-medium text-xs shadow-2xl transition-all border border-white/[0.08]"></div>

    <script>
        let SECRET = localStorage.getItem("endcord_admin_key") || "";
        let globalData = null;
        let stagedUserBadges = [];
        let currentTargetUserId = "";

        function toast(msg, isErr = false) {
            const t = document.getElementById("toast");
            t.innerText = msg;
            t.className = "fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl font-medium text-xs shadow-2xl transition-all border " +
                (isErr ? "bg-rose-950/90 text-rose-200 border-rose-500/30" : "bg-[#111420]/95 text-white border-white/[0.1]");
            t.classList.remove("hidden");
            setTimeout(() => t.classList.add("hidden"), 3000);
        }

        async function login() {
            const k = document.getElementById("key-input").value.trim();
            if (!k) return;
            SECRET = k;
            localStorage.setItem("endcord_admin_key", k);
            await checkAuth();
        }

        function logout() {
            localStorage.removeItem("endcord_admin_key");
            location.reload();
        }

        async function checkAuth() {
            if (!SECRET) {
                document.getElementById("login-screen").classList.remove("hidden");
                document.getElementById("app").classList.add("hidden");
                return;
            }
            try {
                const res = await fetch("/admin/data", { headers: { "Authorization": "Bearer " + SECRET } });
                if (res.status === 429) {
                    showLoginErr("Rate limit exceeded. Please wait 60 seconds.");
                    return;
                }
                if (!res.ok) {
                    showLoginErr("Invalid secret authorization key.");
                    localStorage.removeItem("endcord_admin_key");
                    return;
                }
                globalData = await res.json();
                document.getElementById("login-screen").classList.add("hidden");
                document.getElementById("app").classList.remove("hidden");
                renderAll();
            } catch (e) {
                showLoginErr("Network connectivity error: " + e.message);
            }
        }

        function showLoginErr(msg) {
            const el = document.getElementById("login-err");
            el.innerText = msg;
            el.classList.remove("hidden");
        }

        function tab(name) {
            document.querySelectorAll(".tab-content").forEach(el => el.classList.add("hidden"));
            document.querySelectorAll(".nav-btn").forEach(el => {
                el.className = "nav-btn w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition text-slate-400 hover:bg-white/[0.03] hover:text-white";
            });
            document.getElementById("tab-" + name).classList.remove("hidden");
            document.getElementById("btn-" + name).className = "nav-btn w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition bg-white/[0.06] text-white border border-white/[0.08]";
        }

        function renderAll() {
            if (!globalData) return;
            document.getElementById("metric-users").innerText = globalData.totalUsers || 0;
            document.getElementById("metric-catalog").innerText = (globalData.catalog || []).length;
            document.getElementById("metric-badges").innerText = (globalData.adminBadges || []).length;
            if (globalData.latestUpdate) {
                document.getElementById("metric-version").innerText = globalData.latestUpdate.version;
            }

            renderOverviewUsers(globalData.users || []);
            renderUserDirectory(globalData.users || []);
            renderOfficialBadges(globalData.adminBadges || []);
            renderCatalog(globalData.catalog || []);
        }

        function renderOverviewUsers(users) {
            const tbody = document.getElementById("overview-users");
            if (!users.length) {
                tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-slate-500">No synchronized records found.</td></tr>';
                return;
            }
            tbody.innerHTML = users.slice(0, 7).map(u => {
                let b = []; try { b = JSON.parse(u.badges || "[]"); } catch {}
                const d = u.updated_at ? new Date(u.updated_at).toLocaleDateString() : "-";
                return \`<tr class="hover:bg-white/[0.02]">
                    <td class="py-3 px-4 mono text-indigo-300 font-semibold">\${u.user_id}</td>
                    <td class="py-3 px-4"><span class="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 font-mono text-[11px]">\${b.length} badges</span></td>
                    <td class="py-3 px-4 text-slate-400">\${u.clan_tag || '-'}</td>
                    <td class="py-3 px-4 text-slate-500 font-mono text-[11px]">\${d}</td>
                </tr>\`;
            }).join("");
        }

        function renderUserDirectory(list) {
            const tbody = document.getElementById("user-table-body");
            if (!list.length) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-slate-500">No users found.</td></tr>';
                return;
            }
            tbody.innerHTML = list.map(u => {
                let badges = []; try { badges = JSON.parse(u.badges || "[]"); } catch {}
                const preview = badges.slice(0, 6).map(b =>
                    \`<img src="\${b.badge || b.icon || ''}" class="w-5 h-5 object-contain inline-block rounded mr-1" onerror="this.style.display='none'">\`
                ).join("");
                return \`<tr class="hover:bg-white/[0.02]">
                    <td class="py-3 px-4 mono text-indigo-300 font-semibold">\${u.user_id}</td>
                    <td class="py-3 px-4">\${preview}</td>
                    <td class="py-3 px-4 font-mono text-[11px] text-slate-400">\${badges.length}</td>
                    <td class="py-3 px-4 text-slate-400 text-xs">\${u.clan_tag || '-'}</td>
                    <td class="py-3 px-4 text-right">
                        <button onclick="editUserInStudio('\${u.user_id}')" class="px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 text-xs font-semibold transition mr-1">Manage</button>
                        <button onclick="deleteUser('\${u.user_id}')" class="px-2 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold transition">Purge</button>
                    </td>
                </tr>\`;
            }).join("");
        }

        function filterUsers() {
            const q = document.getElementById("user-search").value.trim().toLowerCase();
            const list = (globalData?.users || []).filter(u => u.user_id.includes(q));
            renderUserDirectory(list);
        }

        function renderOfficialBadges(badges) {
            const tbody = document.getElementById("official-table-body");
            if (!badges.length) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-slate-500">No official roles assigned.</td></tr>';
                return;
            }
            tbody.innerHTML = badges.map(b => \`<tr class="hover:bg-white/[0.02]">
                <td class="py-3 px-4"><img src="\${b.badge_url}" class="w-6 h-6 object-contain rounded"></td>
                <td class="py-3 px-4 mono text-indigo-300 font-semibold">\${b.user_id}</td>
                <td class="py-3 px-4"><span class="px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 text-[10px] font-bold uppercase tracking-wider">\${b.badge_type}</span></td>
                <td class="py-3 px-4 text-slate-300 text-xs">\${b.tooltip}</td>
                <td class="py-3 px-4 text-right">
                    <button onclick="deleteOfficialBadge(\${b.id})" class="px-2 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold transition">Revoke</button>
                </td>
            </tr>\`).join("");
        }

        // ── BADGE STUDIO & CATALOG LOGIC ──
        function handleFileUpload(event) {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(e) {
                const dataUrl = e.target.result;
                document.getElementById("create-badge-url").value = dataUrl;
                updateBadgePreview();
            };
            reader.readAsDataURL(file);
        }

        function updateBadgePreview() {
            const name = document.getElementById("create-badge-name").value.trim();
            const tooltip = document.getElementById("create-badge-tooltip").value.trim();
            const url = document.getElementById("create-badge-url").value.trim();

            const imgEl = document.getElementById("preview-badge-img");
            const placeholderEl = document.getElementById("preview-badge-placeholder");

            if (url) {
                imgEl.src = url;
                imgEl.classList.remove("hidden");
                placeholderEl.classList.add("hidden");
            } else {
                imgEl.classList.add("hidden");
                placeholderEl.classList.remove("hidden");
            }

            document.getElementById("preview-badge-title").innerText = name || "Badge Preview";
            document.getElementById("preview-badge-desc").innerText = tooltip || "Tooltip appears here";
        }

        document.getElementById("create-badge-name").addEventListener("input", updateBadgePreview);
        document.getElementById("create-badge-tooltip").addEventListener("input", updateBadgePreview);

        async function saveBadgeToCatalog() {
            const name = document.getElementById("create-badge-name").value.trim();
            const tooltip = document.getElementById("create-badge-tooltip").value.trim() || name;
            const iconUrl = document.getElementById("create-badge-url").value.trim();

            if (!name || !iconUrl) return toast("Name and Image are required", true);

            const res = await fetch("/admin/catalog/add", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": "Bearer " + SECRET },
                body: JSON.stringify({ name, tooltip, iconUrl })
            });
            const d = await res.json();
            if (d.ok) {
                toast("Badge registered to catalog!");
                document.getElementById("create-badge-name").value = "";
                document.getElementById("create-badge-tooltip").value = "";
                document.getElementById("create-badge-url").value = "";
                updateBadgePreview();
                refreshData();
            } else {
                toast(d.error || "Save error", true);
            }
        }

        function renderCatalog(catalog) {
            document.getElementById("catalog-total").innerText = catalog.length + " badges";
            const picker = document.getElementById("catalog-picker");
            picker.innerHTML = '<option value="">Choose defined badge from catalog...</option>' +
                catalog.map((c, i) => \`<option value="\${i}">\${c.name} (\${c.tooltip})</option>\`).join("");

            const grid = document.getElementById("catalog-grid");
            if (!catalog.length) {
                grid.innerHTML = '<div class="text-slate-500 text-xs py-6 col-span-full text-center">No badges in catalog yet.</div>';
                return;
            }
            grid.innerHTML = catalog.map(c => \`
                <div class="surface-card rounded-xl p-3 flex items-center gap-3 group relative">
                    <img src="\${c.icon_url}" class="w-8 h-8 object-contain rounded shrink-0 bg-black/40 p-1 border border-white/[0.04]" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22><text y=%2218%22>B</text></svg>'">
                    <div class="overflow-hidden flex-1">
                        <span class="text-xs font-semibold text-white block truncate">\${c.name}</span>
                        <span class="text-[10px] text-slate-400 block truncate">\${c.tooltip}</span>
                    </div>
                    <div class="flex items-center gap-1">
                        <button onclick="quickAssignBadge('\${c.icon_url}', '\${c.tooltip}')" class="p-1 rounded bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 text-[10px] font-semibold transition" title="Append to Staged User">+</button>
                        <button onclick="deleteCatalogBadge(\${c.id})" class="p-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-[10px] transition" title="Delete from Catalog">✕</button>
                    </div>
                </div>
            \`).join("");
        }

        async function deleteCatalogBadge(id) {
            if (!confirm("Delete this badge from catalog?")) return;
            const res = await fetch("/admin/catalog/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": "Bearer " + SECRET },
                body: JSON.stringify({ id })
            });
            const d = await res.json();
            if (d.ok) { toast("Catalog item deleted"); refreshData(); }
            else toast(d.error, true);
        }

        // ── USER BADGE STAGING & MODIFICATION ──
        async function loadUserBadges() {
            const uid = document.getElementById("manage-userid").value.trim();
            if (!uid) return toast("Enter a User ID first", true);
            currentTargetUserId = uid;

            try {
                const res = await fetch("/admin/user/" + uid, { headers: { "Authorization": "Bearer " + SECRET } });
                const data = await res.json();
                stagedUserBadges = Array.isArray(data.badges) ? data.badges : [];
                renderStagedBadges();
                toast("Loaded profile for " + uid);
            } catch (e) {
                toast("Failed to query user: " + e.message, true);
            }
        }

        function editUserInStudio(uid) {
            document.getElementById("manage-userid").value = uid;
            tab("studio");
            loadUserBadges();
        }

        function renderStagedBadges() {
            document.getElementById("staged-count").innerText = stagedUserBadges.length;
            const container = document.getElementById("staged-badges-list");

            if (!stagedUserBadges.length) {
                container.innerHTML = '<div class="h-full flex items-center justify-center text-slate-500 text-xs py-8">User currently has 0 badges. Append badges below.</div>';
                return;
            }

            container.innerHTML = stagedUserBadges.map((b, index) => \`
                <div class="flex items-center justify-between p-2 rounded-lg bg-[#0b0e17] border border-white/[0.04]">
                    <div class="flex items-center gap-2.5 overflow-hidden">
                        <img src="\${b.badge || b.icon || ''}" class="w-6 h-6 object-contain rounded shrink-0" onerror="this.style.display='none'">
                        <div class="overflow-hidden">
                            <span class="text-xs text-white font-medium block truncate">\${b.tooltip || b.description || 'Badge'}</span>
                            <span class="text-[10px] text-slate-500 font-mono block truncate">\${b.badge || b.icon || ''}</span>
                        </div>
                    </div>
                    <button onclick="removeStagedBadge(\${index})" class="px-2 py-1 rounded bg-rose-500/10 hover:bg-rose-500/25 text-rose-300 text-[11px] font-semibold transition ml-2 shrink-0">Remove</button>
                </div>
            \`).join("");
        }

        function removeStagedBadge(index) {
            stagedUserBadges.splice(index, 1);
            renderStagedBadges();
            toast("Badge removed from stage");
        }

        function appendFromCatalog() {
            const picker = document.getElementById("catalog-picker");
            const idx = picker.value;
            if (idx === "" || !globalData?.catalog || !globalData.catalog[idx]) {
                return toast("Select a badge from the catalog first", true);
            }
            const item = globalData.catalog[idx];
            stagedUserBadges.push({
                badge: item.icon_url,
                tooltip: item.tooltip || item.name,
                icon: item.icon_url,
                description: item.name
            });
            renderStagedBadges();
            toast("Appended: " + item.name);
        }

        function quickAssignBadge(url, tooltip) {
            if (!currentTargetUserId) {
                return toast("Enter and load a User ID first in User Badge Manager", true);
            }
            stagedUserBadges.push({ badge: url, tooltip: tooltip, icon: url, description: tooltip });
            renderStagedBadges();
            toast("Appended: " + tooltip);
        }

        async function saveUserBadgesToD1() {
            const uid = document.getElementById("manage-userid").value.trim();
            if (!uid) return toast("User ID is missing", true);

            const res = await fetch("/admin/user/badges/update", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": "Bearer " + SECRET },
                body: JSON.stringify({ userId: uid, badges: stagedUserBadges })
            });
            const d = await res.json();
            if (d.ok) {
                toast("Saved " + stagedUserBadges.length + " badges to D1 database!");
                refreshData();
            } else {
                toast(d.error || "Save failure", true);
            }
        }

        async function deleteUser(uid) {
            if (!confirm("Purge user " + uid + " from database?")) return;
            const res = await fetch("/admin/user/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": "Bearer " + SECRET },
                body: JSON.stringify({ userId: uid })
            });
            const d = await res.json();
            if (d.ok) { toast("User purged"); refreshData(); }
            else toast(d.error, true);
        }

        async function addOfficialBadge() {
            const userId = document.getElementById("off-userid").value.trim();
            const badgeType = document.getElementById("off-type").value;
            const badgeUrl = document.getElementById("off-url").value.trim();
            const tooltip = document.getElementById("off-tooltip").value.trim();
            if (!userId || !badgeUrl) return toast("User ID and Image URL are required", true);

            const res = await fetch("/admin/badge/add", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": "Bearer " + SECRET },
                body: JSON.stringify({ userId, badgeType, badgeUrl, tooltip })
            });
            const d = await res.json();
            if (d.ok) {
                toast("Official role assigned!");
                document.getElementById("off-userid").value = "";
                document.getElementById("off-url").value = "";
                document.getElementById("off-tooltip").value = "";
                refreshData();
            } else toast(d.error, true);
        }

        async function deleteOfficialBadge(id) {
            if (!confirm("Revoke official role?")) return;
            const res = await fetch("/admin/badge/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": "Bearer " + SECRET },
                body: JSON.stringify({ id })
            });
            const d = await res.json();
            if (d.ok) { toast("Role revoked"); refreshData(); }
            else toast(d.error, true);
        }

        async function publishRelease() {
            const version = document.getElementById("rel-version").value.trim();
            const downloadUrl = document.getElementById("rel-url").value.trim();
            const releaseNotes = document.getElementById("rel-notes").value.trim();
            const forceUpdate = document.getElementById("rel-force").checked;
            if (!version) return toast("Version is required", true);

            const res = await fetch("/admin/version/publish", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": "Bearer " + SECRET },
                body: JSON.stringify({ version, downloadUrl, releaseNotes, forceUpdate })
            });
            const d = await res.json();
            if (d.ok) { toast("Release published!"); refreshData(); }
            else toast(d.error, true);
        }

        async function executeBulkImport() {
            const raw = document.getElementById("import-box").value.trim();
            if (!raw) return toast("Paste JSON payload first", true);
            let profiles;
            try { profiles = JSON.parse(raw); } catch (e) { return toast("JSON syntax error: " + e.message, true); }

            const res = await fetch("/admin/import", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": "Bearer " + SECRET },
                body: JSON.stringify({ profiles })
            });
            const d = await res.json();
            if (d.ok) {
                toast(d.message);
                refreshData();
            } else {
                toast(d.error, true);
            }
        }

        async function downloadBackup() {
            try {
                const res = await fetch("/admin/export", { headers: { "Authorization": "Bearer " + SECRET } });
                const data = await res.json();
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = "endcord-backup-" + new Date().toISOString().slice(0,10) + ".json";
                a.click();
                toast("Backup downloaded!");
            } catch (e) {
                toast("Export error: " + e.message, true);
            }
        }

        async function refreshData() {
            await checkAuth();
        }

        checkAuth();
        document.getElementById("key-input").addEventListener("keydown", e => { if (e.key === "Enter") login(); });
    </script>
</body>
</html>`;
}
