/**
 * Endcord Cloudflare Worker Backend & Management Dashboard v2
 * Domain: api.endcord.com | Database: Cloudflare D1 (endcord-db)
 */

const ADMIN_SECRET = "ec_sec_f24b417136199503edf4cd5289caa6d0a2a3277d66105ada4bf72663185066a4";

// ── Rate Limiting (Brute Force Protection) ──
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

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const path = url.pathname;
        const method = request.method.toUpperCase();

        if (method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });

        const db = env.DB;
        if (!db) return json({ error: "D1 Database 'DB' binding not found in Worker settings." }, 500);

        const clientIP = request.headers.get("CF-Connecting-IP") || "unknown";

        try {
            // ── Health ──
            if (path === "/" || path === "/health") {
                return json({ status: "online", service: "Endcord API", domain: "api.endcord.com", timestamp: Date.now() });
            }

            // ── Version & Updates ──
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
                if (!userId) return json({ error: "Missing user ID" }, 400);

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

            // ── Save Profile ──
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

                return json({ ok: true, message: "Saved!", userId, updatedAt: now });
            }

            // ── Admin Panel ──
            if (path.startsWith("/admin")) {
                if (method === "GET" && (path === "/admin" || path === "/admin/")) {
                    return new Response(renderDashboardHtml(), { headers: { "Content-Type": "text/html; charset=utf-8", ...CORS_HEADERS } });
                }

                // Brute Force Guard
                if (!checkRateLimit(clientIP)) {
                    return json({ error: "Too many failed attempts. Try again in 60s." }, 429);
                }

                const auth = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim() || request.headers.get("X-Admin-Secret");
                if (auth !== ADMIN_SECRET) {
                    recordFail(clientIP);
                    return json({ error: "Unauthorized: Invalid secret key" }, 401);
                }
                rateLimitMap.delete(clientIP);

                // Admin: Data overview
                if (path === "/admin/data" && method === "GET") {
                    const [badges, userCount, update, users] = await Promise.all([
                        db.prepare("SELECT * FROM admin_badges ORDER BY id DESC").all(),
                        db.prepare("SELECT COUNT(*) as count FROM users").first(),
                        db.prepare("SELECT * FROM app_updates ORDER BY id DESC LIMIT 1").first(),
                        db.prepare("SELECT user_id, badges, clan_tag, updated_at FROM users ORDER BY updated_at DESC LIMIT 500").all()
                    ]);
                    return json({ ok: true, adminBadges: badges?.results || [], totalUsers: userCount?.count || 0, latestUpdate: update || null, users: users?.results || [] });
                }

                // Admin: Single user details
                if (path.startsWith("/admin/user/") && method === "GET") {
                    const uid = path.split("/").pop();
                    const [user, badges] = await Promise.all([
                        db.prepare("SELECT * FROM users WHERE user_id = ?").bind(uid).first(),
                        db.prepare("SELECT * FROM admin_badges WHERE user_id = ?").bind(uid).all()
                    ]);
                    return json({ ok: true, user: user || null, adminBadges: badges?.results || [] });
                }

                // Admin: Delete user
                if (path === "/admin/user/delete" && method === "POST") {
                    const { userId } = await request.json();
                    await db.prepare("DELETE FROM users WHERE user_id = ?").bind(userId).run();
                    return json({ ok: true, message: "User deleted" });
                }

                // Admin: Add official badge
                if (path === "/admin/badge/add" && method === "POST") {
                    const { userId, badgeUrl, tooltip, badgeType } = await request.json();
                    if (!userId || !badgeUrl) return json({ error: "Missing fields" }, 400);
                    await db.prepare(`
                        INSERT INTO admin_badges (user_id, badge_url, tooltip, badge_type, created_at)
                        VALUES (?, ?, ?, ?, ?)
                    `).bind(userId, badgeUrl, tooltip || "Official Badge", badgeType || "OFFICIAL", Date.now()).run();
                    return json({ ok: true, message: "Badge added" });
                }

                // Admin: Delete official badge
                if (path === "/admin/badge/delete" && method === "POST") {
                    const { id } = await request.json();
                    await db.prepare("DELETE FROM admin_badges WHERE id = ?").bind(id).run();
                    return json({ ok: true, message: "Badge deleted" });
                }

                // Admin: Publish Update
                if (path === "/admin/version/publish" && method === "POST") {
                    const { version, minVersion, releaseNotes, downloadUrl, forceUpdate } = await request.json();
                    await db.prepare(`
                        INSERT INTO app_updates (version, min_version, release_notes, download_url, force_update, created_at)
                        VALUES (?, ?, ?, ?, ?, ?)
                    `).bind(version, minVersion || "1.0.0", releaseNotes || "", downloadUrl || "https://endcord.com/EndcordInstaller.exe", forceUpdate ? 1 : 0, Date.now()).run();
                    return json({ ok: true, message: `Version ${version} published` });
                }

                // Admin: Bulk Import (profiles.json format)
                if (path === "/admin/import" && method === "POST") {
                    const { profiles } = await request.json();
                    if (!profiles || typeof profiles !== "object") return json({ error: "Invalid format" }, 400);
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
                    return json({ ok: true, message: `Imported ${count} profiles successfully!`, imported: count });
                }

                // Admin: Export backup
                if (path === "/admin/export" && method === "GET") {
                    const [users, badges, updates] = await Promise.all([
                        db.prepare("SELECT * FROM users").all(),
                        db.prepare("SELECT * FROM admin_badges").all(),
                        db.prepare("SELECT * FROM app_updates ORDER BY id DESC").all()
                    ]);
                    return json({ exportedAt: Date.now(), users: users?.results || [], adminBadges: badges?.results || [], updates: updates?.results || [] });
                }
            }

            return json({ error: "Not Found", path }, 404);
        } catch (e) {
            return json({ error: "Server Error", message: e.message || String(e) }, 500);
        }
    }
};

// ── HTML Dashboard GUI (Tailwind CSS Dark Theme) ──
function renderDashboardHtml() {
    return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Endcord Management Panel</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Inter', sans-serif; }
        code, .mono { font-family: 'JetBrains Mono', monospace; }
        .glass { background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,0.07); }
        .glass-card { background: rgba(30, 41, 59, 0.5); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.06); }
    </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen">

    <!-- LOGIN MODAL -->
    <div id="login-screen" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-xl p-4">
        <div class="glass w-full max-w-md rounded-2xl p-8 text-center shadow-2xl border border-indigo-500/20">
            <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-tr from-indigo-500 to-cyan-400 flex items-center justify-center text-3xl shadow-lg shadow-indigo-500/30">⚡</div>
            <h1 class="text-2xl font-black tracking-tight text-white mb-1">Endcord Admin</h1>
            <p class="text-slate-400 text-sm mb-6">Cloudflare API & Badge Management</p>
            <div class="text-left mb-4">
                <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Owner Secret Key</label>
                <input id="key-input" type="password" placeholder="ec_sec_..." class="w-full px-4 py-3 rounded-xl bg-slate-900/90 border border-slate-700 text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition">
            </div>
            <button onclick="login()" class="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 font-semibold text-white shadow-lg shadow-indigo-500/25 transition">Enter Panel</button>
            <p id="login-err" class="text-rose-400 text-xs mt-3 hidden"></p>
        </div>
    </div>

    <!-- MAIN APP -->
    <div id="app" class="hidden min-h-screen flex flex-col md:flex-row">
        <!-- SIDEBAR -->
        <aside class="w-full md:w-64 glass md:min-h-screen p-5 flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-800">
            <div>
                <div class="flex items-center gap-3 pb-6 border-b border-slate-800/80 mb-6">
                    <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-cyan-400 flex items-center justify-center text-xl shadow-md shadow-indigo-500/20">⚡</div>
                    <div>
                        <h2 class="font-black text-white text-base">Endcord</h2>
                        <span class="text-[11px] font-medium text-emerald-400 flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span> Live API</span>
                    </div>
                </div>
                <nav class="space-y-1.5">
                    <button onclick="tab('overview')" id="btn-overview" class="nav-btn w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">📊 Dashboard</button>
                    <button onclick="tab('profiles')" id="btn-profiles" class="nav-btn w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition text-slate-400 hover:bg-slate-800/50 hover:text-white">👥 User Profiles</button>
                    <button onclick="tab('badges')" id="btn-badges" class="nav-btn w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition text-slate-400 hover:bg-slate-800/50 hover:text-white">🎖️ Official Badges</button>
                    <button onclick="tab('updates')" id="btn-updates" class="nav-btn w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition text-slate-400 hover:bg-slate-800/50 hover:text-white">🚀 App Updates</button>
                    <button onclick="tab('import')" id="btn-import" class="nav-btn w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition text-slate-400 hover:bg-slate-800/50 hover:text-white">📦 Import / Export</button>
                    <button onclick="tab('security')" id="btn-security" class="nav-btn w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition text-slate-400 hover:bg-slate-800/50 hover:text-white">🛡️ Security Status</button>
                </nav>
            </div>
            <div class="pt-6 border-t border-slate-800/80">
                <button onclick="logout()" class="w-full py-2 px-3 rounded-lg text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition border border-rose-500/20">🚪 Sign Out</button>
            </div>
        </aside>

        <!-- CONTENT -->
        <main class="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full">
            <!-- TAB: OVERVIEW -->
            <section id="tab-overview" class="tab-content space-y-6">
                <div class="flex items-center justify-between">
                    <div>
                        <h2 class="text-2xl font-black tracking-tight text-white">Dashboard Overview</h2>
                        <p class="text-slate-400 text-sm">System stats and realtime status</p>
                    </div>
                    <button onclick="refresh()" class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-semibold transition border border-slate-700">🔄 Refresh Data</button>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div class="glass-card rounded-2xl p-5 border-indigo-500/20">
                        <span class="text-slate-400 text-xs font-semibold uppercase">Total Users</span>
                        <div id="stat-users" class="text-3xl font-black text-white mt-1">0</div>
                    </div>
                    <div class="glass-card rounded-2xl p-5 border-purple-500/20">
                        <span class="text-slate-400 text-xs font-semibold uppercase">Official Badges</span>
                        <div id="stat-badges" class="text-3xl font-black text-purple-400 mt-1">0</div>
                    </div>
                    <div class="glass-card rounded-2xl p-5 border-cyan-500/20">
                        <span class="text-slate-400 text-xs font-semibold uppercase">Current Version</span>
                        <div id="stat-version" class="text-3xl font-black text-cyan-400 mt-1">-</div>
                    </div>
                    <div class="glass-card rounded-2xl p-5 border-emerald-500/20">
                        <span class="text-slate-400 text-xs font-semibold uppercase">Database Status</span>
                        <div class="text-3xl font-black text-emerald-400 mt-1">D1 Active</div>
                    </div>
                </div>

                <div class="glass-card rounded-2xl p-6">
                    <h3 class="text-base font-bold text-white mb-4">Recent Users & Badges</h3>
                    <div class="overflow-x-auto">
                        <table class="w-full text-left text-sm">
                            <thead class="text-xs uppercase text-slate-400 border-b border-slate-800">
                                <tr>
                                    <th class="py-3 px-4">User ID</th>
                                    <th class="py-3 px-4">Badges</th>
                                    <th class="py-3 px-4">Clan Tag</th>
                                    <th class="py-3 px-4">Updated</th>
                                </tr>
                            </thead>
                            <tbody id="overview-recent-users" class="divide-y divide-slate-800/60">
                                <tr><td colspan="4" class="text-center py-6 text-slate-500">Loading...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            <!-- TAB: PROFILES -->
            <section id="tab-profiles" class="tab-content hidden space-y-6">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h2 class="text-2xl font-black tracking-tight text-white">Registered User Profiles</h2>
                        <p class="text-slate-400 text-sm">Search, inspect and manage user badges</p>
                    </div>
                    <input id="search-input" oninput="filterProfiles()" type="text" placeholder="Search User ID..." class="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm focus:outline-none focus:border-indigo-500 w-full sm:w-72">
                </div>

                <div class="glass-card rounded-2xl overflow-hidden">
                    <div class="overflow-x-auto">
                        <table class="w-full text-left text-sm">
                            <thead class="text-xs uppercase text-slate-400 bg-slate-900/60 border-b border-slate-800">
                                <tr>
                                    <th class="py-3.5 px-4">User ID</th>
                                    <th class="py-3.5 px-4">Badges Preview</th>
                                    <th class="py-3.5 px-4">Count</th>
                                    <th class="py-3.5 px-4">Tag</th>
                                    <th class="py-3.5 px-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody id="profiles-table" class="divide-y divide-slate-800/60">
                                <tr><td colspan="5" class="text-center py-6 text-slate-500">Loading profiles...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            <!-- TAB: BADGES -->
            <section id="tab-badges" class="tab-content hidden space-y-6">
                <div>
                    <h2 class="text-2xl font-black tracking-tight text-white">Official Badges</h2>
                    <p class="text-slate-400 text-sm">Assign permanent official badges to staff, owners and VIPs</p>
                </div>

                <div class="glass-card rounded-2xl p-6">
                    <h3 class="text-base font-bold text-white mb-4">Grant Official Badge</h3>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label class="block text-xs font-semibold text-slate-400 mb-1.5">Discord User ID</label>
                            <input id="b-userid" type="text" placeholder="e.g. 1390609041897554050" class="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:border-indigo-500 focus:outline-none">
                        </div>
                        <div>
                            <label class="block text-xs font-semibold text-slate-400 mb-1.5">Role Type</label>
                            <select id="b-type" class="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:border-indigo-500 focus:outline-none">
                                <option value="OWNER">👑 Owner / Developer</option>
                                <option value="STAFF">⚡ Staff / Moderator</option>
                                <option value="VIP">💎 VIP Supporter</option>
                                <option value="DONOR">💜 Donor</option>
                                <option value="BUG_HUNTER">🐛 Bug Hunter</option>
                                <option value="CUSTOM">🔧 Custom</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-semibold text-slate-400 mb-1.5">Badge Image URL</label>
                            <input id="b-url" type="text" placeholder="https://cdn.discordapp.com/..." class="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:border-indigo-500 focus:outline-none">
                        </div>
                        <div>
                            <label class="block text-xs font-semibold text-slate-400 mb-1.5">Hover Tooltip Text</label>
                            <input id="b-tooltip" type="text" placeholder="e.g. Official Endcord Owner" class="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:border-indigo-500 focus:outline-none">
                        </div>
                    </div>
                    <button onclick="addBadge()" class="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition">Grant Official Badge</button>
                </div>

                <div class="glass-card rounded-2xl overflow-hidden">
                    <table class="w-full text-left text-sm">
                        <thead class="text-xs uppercase text-slate-400 bg-slate-900/60 border-b border-slate-800">
                            <tr>
                                <th class="py-3 px-4">Icon</th>
                                <th class="py-3 px-4">User ID</th>
                                <th class="py-3 px-4">Type</th>
                                <th class="py-3 px-4">Tooltip</th>
                                <th class="py-3 px-4 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody id="badges-table" class="divide-y divide-slate-800/60">
                            <tr><td colspan="5" class="text-center py-6 text-slate-500">Loading...</td></tr>
                        </tbody>
                    </table>
                </div>
            </section>

            <!-- TAB: UPDATES -->
            <section id="tab-updates" class="tab-content hidden space-y-6">
                <div>
                    <h2 class="text-2xl font-black tracking-tight text-white">App Updates & Versioning</h2>
                    <p class="text-slate-400 text-sm">Release updates that the Endcord client and installer fetch automatically</p>
                </div>

                <div class="glass-card rounded-2xl p-6">
                    <h3 class="text-base font-bold text-white mb-4">Publish New Update</h3>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label class="block text-xs font-semibold text-slate-400 mb-1.5">Version String</label>
                            <input id="u-version" type="text" placeholder="1.15.0" class="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:border-indigo-500 focus:outline-none">
                        </div>
                        <div>
                            <label class="block text-xs font-semibold text-slate-400 mb-1.5">Installer Download URL</label>
                            <input id="u-url" type="text" value="https://endcord.com/EndcordInstaller.exe" class="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:border-indigo-500 focus:outline-none">
                        </div>
                        <div class="sm:col-span-2">
                            <label class="block text-xs font-semibold text-slate-400 mb-1.5">Release Notes</label>
                            <textarea id="u-notes" rows="3" placeholder="What's new in this release..." class="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:border-indigo-500 focus:outline-none"></textarea>
                        </div>
                    </div>
                    <div class="flex items-center gap-2 mb-4">
                        <input id="u-force" type="checkbox" class="w-4 h-4 rounded text-indigo-600 bg-slate-900 border-slate-700">
                        <label for="u-force" class="text-sm font-medium text-slate-300">Force Update (Notify users to update immediately)</label>
                    </div>
                    <button onclick="publishVersion()" class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold text-sm transition">Publish Version Broadcast</button>
                </div>
            </section>

            <!-- TAB: IMPORT/EXPORT -->
            <section id="tab-import" class="tab-content hidden space-y-6">
                <div>
                    <h2 class="text-2xl font-black tracking-tight text-white">Import & Export</h2>
                    <p class="text-slate-400 text-sm">Bulk import from old profiles.json or download complete database backups</p>
                </div>

                <div class="glass-card rounded-2xl p-6">
                    <h3 class="text-base font-bold text-white mb-2">📥 Bulk Import profiles.json</h3>
                    <p class="text-slate-400 text-xs mb-4">Paste your full JSON dictionary containing all user IDs and their badge arrays.</p>
                    <textarea id="import-json" rows="8" placeholder='{ "1307705591434575944": [ { "badge": "...", "tooltip": "..." } ] }' class="w-full p-4 rounded-xl bg-slate-900 border border-slate-700 text-xs text-cyan-300 mono focus:border-indigo-500 focus:outline-none mb-4"></textarea>
                    <button onclick="bulkImport()" class="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition">Import All Profiles Into D1</button>
                    <div id="import-msg" class="mt-4 hidden p-3 rounded-xl text-xs font-semibold"></div>
                </div>

                <div class="glass-card rounded-2xl p-6">
                    <h3 class="text-base font-bold text-white mb-2">📤 Export Backup</h3>
                    <p class="text-slate-400 text-xs mb-4">Download a complete JSON snapshot of all database tables (users, official badges, updates).</p>
                    <button onclick="exportBackup()" class="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition">Download Full Backup JSON</button>
                </div>
            </section>

            <!-- TAB: SECURITY -->
            <section id="tab-security" class="tab-content hidden space-y-6">
                <div>
                    <h2 class="text-2xl font-black tracking-tight text-white">Security & Integrity Status</h2>
                    <p class="text-slate-400 text-sm">Active protection layers guarding the API and D1 Database</p>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="glass-card rounded-2xl p-5 border-emerald-500/20">
                        <div class="text-emerald-400 text-2xl mb-2">🛡️</div>
                        <h4 class="font-bold text-white text-sm">SQL Injection Safe</h4>
                        <p class="text-slate-400 text-xs mt-1">100% Parameterized D1 queries using prepared statements (.bind). No raw string injection possible.</p>
                    </div>
                    <div class="glass-card rounded-2xl p-5 border-emerald-500/20">
                        <div class="text-emerald-400 text-2xl mb-2">🔒</div>
                        <h4 class="font-bold text-white text-sm">Brute Force Guard</h4>
                        <p class="text-slate-400 text-xs mt-1">IP rate limiter actively blocks IPs exceeding 5 failed authentication attempts per minute.</p>
                    </div>
                    <div class="glass-card rounded-2xl p-5 border-indigo-500/20">
                        <div class="text-indigo-400 text-2xl mb-2">🔑</div>
                        <h4 class="font-bold text-white text-sm">256-bit Cryptographic Key</h4>
                        <p class="text-slate-400 text-xs mt-1">High-entropy hex token generated with cryptographically secure random bytes.</p>
                    </div>
                </div>
            </section>
        </main>
    </div>

    <!-- USER DETAIL MODAL -->
    <div id="user-modal" class="fixed inset-0 z-50 hidden flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
        <div class="glass w-full max-w-2xl rounded-2xl p-6 border border-slate-800 max-h-[85vh] overflow-y-auto">
            <div class="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
                <h3 class="font-bold text-lg text-white" id="modal-uid">User Details</h3>
                <button onclick="closeModal()" class="text-slate-400 hover:text-white text-xl">✕</button>
            </div>
            <div id="modal-body" class="space-y-4"></div>
        </div>
    </div>

    <!-- TOAST -->
    <div id="toast" class="fixed bottom-6 right-6 z-50 hidden px-5 py-3 rounded-xl font-semibold text-sm shadow-xl transition-all"></div>

    <script>
        let SECRET = localStorage.getItem("endcord_admin_key") || "";
        let globalData = null;

        function notify(msg, err = false) {
            const t = document.getElementById("toast");
            t.innerText = msg;
            t.className = "fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl font-semibold text-sm shadow-xl " + (err ? "bg-rose-600 text-white" : "bg-indigo-600 text-white");
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
                    showErr("Rate limit exceeded. Please wait 60 seconds.");
                    return;
                }
                if (!res.ok) {
                    showErr("Invalid secret key!");
                    localStorage.removeItem("endcord_admin_key");
                    return;
                }
                globalData = await res.json();
                document.getElementById("login-screen").classList.add("hidden");
                document.getElementById("app").classList.remove("hidden");
                render();
            } catch (e) {
                showErr("Connection failed: " + e.message);
            }
        }

        function showErr(msg) {
            const el = document.getElementById("login-err");
            el.innerText = msg;
            el.classList.remove("hidden");
        }

        function tab(name) {
            document.querySelectorAll(".tab-content").forEach(el => el.classList.add("hidden"));
            document.querySelectorAll(".nav-btn").forEach(el => {
                el.className = "nav-btn w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition text-slate-400 hover:bg-slate-800/50 hover:text-white";
            });
            document.getElementById("tab-" + name).classList.remove("hidden");
            document.getElementById("btn-" + name).className = "nav-btn w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition bg-indigo-500/15 text-indigo-400 border border-indigo-500/30";
        }

        function render() {
            if (!globalData) return;
            document.getElementById("stat-users").innerText = globalData.totalUsers || 0;
            document.getElementById("stat-badges").innerText = (globalData.adminBadges || []).length;
            if (globalData.latestUpdate) document.getElementById("stat-version").innerText = globalData.latestUpdate.version;

            // Overview recent users
            const tbody = document.getElementById("overview-recent-users");
            const users = globalData.users || [];
            if (!users.length) {
                tbody.innerHTML = '<tr><td colspan="4" class="text-center py-6 text-slate-500">No users found.</td></tr>';
            } else {
                tbody.innerHTML = users.slice(0, 8).map(u => {
                    let b = []; try { b = JSON.parse(u.badges || "[]"); } catch {}
                    const d = u.updated_at ? new Date(u.updated_at).toLocaleDateString() : "-";
                    return \`<tr class="hover:bg-slate-900/40">
                        <td class="py-3 px-4 mono text-cyan-400">\${u.user_id}</td>
                        <td class="py-3 px-4"><span class="px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-300 text-xs font-semibold">\${b.length} badges</span></td>
                        <td class="py-3 px-4 text-slate-300">\${u.clan_tag || '-'}</td>
                        <td class="py-3 px-4 text-slate-500 text-xs">\${d}</td>
                    </tr>\`;
                }).join("");
            }

            renderProfilesTable(users);
            renderBadgesTable(globalData.adminBadges || []);
        }

        function renderProfilesTable(list) {
            const tbody = document.getElementById("profiles-table");
            if (!list.length) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center py-6 text-slate-500">No profiles.</td></tr>';
                return;
            }
            tbody.innerHTML = list.map(u => {
                let badges = []; try { badges = JSON.parse(u.badges || "[]"); } catch {}
                const preview = badges.slice(0, 6).map(b =>
                    \`<img src="\${b.badge || b.icon || ''}" class="w-5 h-5 object-contain inline-block rounded mr-1" onerror="this.style.display='none'">\`
                ).join("");
                return \`<tr class="hover:bg-slate-900/40">
                    <td class="py-3 px-4 mono text-cyan-400 font-semibold">\${u.user_id}</td>
                    <td class="py-3 px-4">\${preview}</td>
                    <td class="py-3 px-4"><span class="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-xs font-semibold">\${badges.length}</span></td>
                    <td class="py-3 px-4 text-slate-300 text-xs">\${u.clan_tag || '-'}</td>
                    <td class="py-3 px-4 text-right">
                        <button onclick="inspectUser('\${u.user_id}')" class="px-3 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 text-xs font-semibold transition mr-1">Inspect</button>
                        <button onclick="deleteUser('\${u.user_id}')" class="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-semibold transition">Delete</button>
                    </td>
                </tr>\`;
            }).join("");
        }

        function filterProfiles() {
            const q = document.getElementById("search-input").value.trim().toLowerCase();
            const list = (globalData?.users || []).filter(u => u.user_id.includes(q));
            renderProfilesTable(list);
        }

        function renderBadgesTable(badges) {
            const tbody = document.getElementById("badges-table");
            if (!badges.length) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center py-6 text-slate-500">No official badges assigned.</td></tr>';
                return;
            }
            tbody.innerHTML = badges.map(b => \`<tr class="hover:bg-slate-900/40">
                <td class="py-3 px-4"><img src="\${b.badge_url}" class="w-6 h-6 object-contain rounded" onerror="this.src='https://cdn.discordapp.com/emojis/1026533090627174460.png'"></td>
                <td class="py-3 px-4 mono text-cyan-400 font-semibold">\${b.user_id}</td>
                <td class="py-3 px-4"><span class="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 text-xs font-bold">\${b.badge_type}</span></td>
                <td class="py-3 px-4 text-slate-300 text-xs">\${b.tooltip}</td>
                <td class="py-3 px-4 text-right">
                    <button onclick="deleteBadge(\${b.id})" class="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-semibold transition">Delete</button>
                </td>
            </tr>\`).join("");
        }

        async function inspectUser(uid) {
            document.getElementById("modal-uid").innerText = "User Profile: " + uid;
            document.getElementById("modal-body").innerHTML = '<p class="text-slate-400 text-sm">Loading profile...</p>';
            document.getElementById("user-modal").classList.remove("hidden");

            try {
                const res = await fetch("/admin/user/" + uid, { headers: { "Authorization": "Bearer " + SECRET } });
                const data = await res.json();
                let badges = []; try { badges = JSON.parse(data.user?.badges || "[]"); } catch {}

                let html = \`<div class="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1">
                    <div><span class="text-slate-400">User ID:</span> <span class="mono text-cyan-400 font-semibold">\${uid}</span></div>
                    <div><span class="text-slate-400">Clan Tag:</span> \${data.user?.clan_tag || 'None'}</div>
                    <div><span class="text-slate-400">Last Update:</span> \${data.user?.updated_at ? new Date(data.user.updated_at).toLocaleString() : '-'}</div>
                </div>\`;

                if (data.adminBadges?.length) {
                    html += '<div><h4 class="text-xs font-bold text-purple-400 uppercase tracking-wider mb-2">Official Badges</h4><div class="space-y-1.5">';
                    data.adminBadges.forEach(b => {
                        html += \`<div class="flex items-center gap-2 p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs">
                            <img src="\${b.badge_url}" class="w-5 h-5 object-contain">
                            <span class="font-semibold text-white">\${b.tooltip}</span>
                            <span class="ml-auto px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-bold">\${b.badge_type}</span>
                        </div>\`;
                    });
                    html += '</div></div>';
                }

                html += \`<div>
                    <h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">User Badges (\${badges.length})</h4>
                    <div class="max-h-48 overflow-y-auto space-y-1.5">\`;
                badges.forEach(b => {
                    html += \`<div class="flex items-center gap-2 p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs">
                        <img src="\${b.badge || b.icon || ''}" class="w-5 h-5 object-contain" onerror="this.style.display='none'">
                        <span class="text-white">\${b.tooltip || b.description || 'Badge'}</span>
                    </div>\`;
                });
                html += '</div></div>';

                html += \`<div>
                    <h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Raw JSON</h4>
                    <pre class="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] mono text-cyan-300 overflow-x-auto max-h-48">\${JSON.stringify({ userId: uid, badges, customProfile: data.user?.custom_profile }, null, 2)}</pre>
                </div>\`;

                document.getElementById("modal-body").innerHTML = html;
            } catch (e) {
                document.getElementById("modal-body").innerHTML = '<p class="text-rose-400 text-sm">Failed to load user</p>';
            }
        }

        function closeModal() {
            document.getElementById("user-modal").classList.add("hidden");
        }

        async function deleteUser(uid) {
            if (!confirm("Are you sure you want to delete profile " + uid + "?")) return;
            const res = await fetch("/admin/user/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": "Bearer " + SECRET },
                body: JSON.stringify({ userId: uid })
            });
            const d = await res.json();
            if (d.ok) { notify("User deleted"); refresh(); }
            else notify(d.error, true);
        }

        async function addBadge() {
            const userId = document.getElementById("b-userid").value.trim();
            const badgeType = document.getElementById("b-type").value;
            const badgeUrl = document.getElementById("b-url").value.trim();
            const tooltip = document.getElementById("b-tooltip").value.trim();
            if (!userId || !badgeUrl) return notify("User ID and Image URL are required", true);

            const res = await fetch("/admin/badge/add", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": "Bearer " + SECRET },
                body: JSON.stringify({ userId, badgeType, badgeUrl, tooltip })
            });
            const d = await res.json();
            if (d.ok) {
                notify("Official badge added!");
                document.getElementById("b-userid").value = "";
                document.getElementById("b-url").value = "";
                document.getElementById("b-tooltip").value = "";
                refresh();
            } else notify(d.error, true);
        }

        async function deleteBadge(id) {
            if (!confirm("Remove this badge?")) return;
            const res = await fetch("/admin/badge/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": "Bearer " + SECRET },
                body: JSON.stringify({ id })
            });
            const d = await res.json();
            if (d.ok) { notify("Badge deleted"); refresh(); }
            else notify(d.error, true);
        }

        async function publishVersion() {
            const version = document.getElementById("u-version").value.trim();
            const downloadUrl = document.getElementById("u-url").value.trim();
            const releaseNotes = document.getElementById("u-notes").value.trim();
            const forceUpdate = document.getElementById("u-force").checked;
            if (!version) return notify("Version is required", true);

            const res = await fetch("/admin/version/publish", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": "Bearer " + SECRET },
                body: JSON.stringify({ version, downloadUrl, releaseNotes, forceUpdate })
            });
            const d = await res.json();
            if (d.ok) { notify("Version published!"); refresh(); }
            else notify(d.error, true);
        }

        async function bulkImport() {
            const raw = document.getElementById("import-json").value.trim();
            if (!raw) return notify("Please paste profiles.json content", true);
            let profiles;
            try { profiles = JSON.parse(raw); } catch (e) { return notify("Invalid JSON syntax", true); }

            const res = await fetch("/admin/import", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": "Bearer " + SECRET },
                body: JSON.stringify({ profiles })
            });
            const d = await res.json();
            const el = document.getElementById("import-msg");
            el.classList.remove("hidden");
            if (d.ok) {
                el.className = "mt-4 p-3 rounded-xl text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/20";
                el.innerText = d.message;
                notify("Import completed!");
                refresh();
            } else {
                el.className = "mt-4 p-3 rounded-xl text-xs font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/20";
                el.innerText = d.error;
            }
        }

        async function exportBackup() {
            try {
                const res = await fetch("/admin/export", { headers: { "Authorization": "Bearer " + SECRET } });
                const data = await res.json();
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = "endcord-db-backup-" + new Date().toISOString().slice(0,10) + ".json";
                a.click();
                notify("Backup downloaded!");
            } catch (e) {
                notify("Export failed", true);
            }
        }

        async function refresh() {
            await checkAuth();
        }

        checkAuth();
        document.getElementById("key-input").addEventListener("keydown", e => { if (e.key === "Enter") login(); });
    </script>
</body>
</html>`;
}
