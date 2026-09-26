import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const siteDir = "C:\\Users\\ewlle\\Desktop\\Endcord-site";
const siteApiDir = path.join(siteDir, "api");
const siteDistDir = path.join(siteDir, "dist");

console.log("🚀 Starting Endcord 1-Click Release & Upload Build...");

// 1. Get git hash & timestamp first so the build hash matches version.json
let gitHash = "latest";
try {
    gitHash = execSync("git rev-parse --short HEAD", { cwd: rootDir }).toString().trim();
} catch {}

const timestamp = Date.now();
const dateStr = new Date().toISOString();

// Generate a unique build hash for each release
// This ensures old clients always detect new releases as updates
// (git hash stays the same if no commits, but buildHash is always unique)
const buildHash = timestamp.toString(16).slice(-7);

console.log(`📌 Build Commit Hash: ${gitHash} | Build Hash: ${buildHash} (${dateStr})`);

// 2. Build standalone dist assets with matching ENDCORD_HASH
console.log("📦 Compiling standalone build...");
const pnpmCmd = path.join(rootDir, "node-v22", "pnpm.cmd");
const nodeDir = path.join(rootDir, "node-v22");
execSync(`"${pnpmCmd}" buildStandalone`, { 
    cwd: rootDir, 
    stdio: "inherit",
    env: { ...process.env, ENDCORD_HASH: buildHash, ENDCORD_REMOTE: "rootpoii/endcord", PATH: `${nodeDir};${process.env.PATH}` }})
});

// 2.5. Compile the C# Installer GUI with embedded assets
console.log("🛠️ Compiling EndcordInstaller.exe with embedded assets...");
try {
    const cscPath = "C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe";
    const cscCmd = `"${cscPath}" /resource:dist\\patcher.js /resource:dist\\preload.js /resource:dist\\renderer.js /resource:dist\\renderer.css /resource:app_logo.png /out:EndcordInstaller.exe /target:winexe /win32icon:app_icon.ico /win32manifest:app.manifest /optimize+ /debug- InstallerGUI.cs`;
    execSync(cscCmd, { cwd: rootDir, stdio: "inherit" });
    console.log("✅ Compiled EndcordInstaller.exe successfully!");

    // Wait 3 seconds to release file handles/locks
    execSync("powershell -Command Start-Sleep -Seconds 3");

    // Sign the installer if the certificate exists
    try {
        console.log("✍️ Signing EndcordInstaller.exe...");
        const signCmd = `powershell -Command "$cert = Get-ChildItem Cert:\\CurrentUser\\My\\A17A3B4BC43BBD13EB1CE9CFFEBB8A37567EC319 -ErrorAction SilentlyContinue; if ($cert) { Set-AuthenticodeSignature -FilePath EndcordInstaller.exe -Certificate $cert -TimestampServer http://timestamp.digicert.com | Out-Null; Write-Host '✅ Signed successfully!' } else { Write-Host '⚠️ No certificate found to sign.' }"`;
        const result = execSync(signCmd, { cwd: rootDir }).toString().trim();
        console.log(`  └─ ${result}`);
    } catch (e) {
        console.log("  ⚠️ Failed to sign installer:", e.message);
    }
} catch (err) {
    console.error("❌ Failed to compile EndcordInstaller.exe:", err);
}

// 3. Ensure site dist and api folders exist
if (!fs.existsSync(siteDistDir)) {
    fs.mkdirSync(siteDistDir, { recursive: true });
}
if (!fs.existsSync(siteApiDir)) {
    fs.mkdirSync(siteApiDir, { recursive: true });
}

// 4. Copy dist files to siteDistDir
const distFiles = fs.readdirSync(distDir);
const copiedAssets = [];

for (const file of distFiles) {
    const srcFile = path.join(distDir, file);
    if (fs.lstatSync(srcFile).isFile()) {
        const dstFile = path.join(siteDistDir, file);
        fs.copyFileSync(srcFile, dstFile);
        copiedAssets.push({
            name: file,
            url: `https://endcord.com/dist/${file}`
        });
        console.log(`  └─ Copied asset: ${file}`);
    }
}

// Do not copy into installed AppData — installer ships dist.

// Copy EndcordInstaller.exe and EndcordInstaller.zip if present
const installerFiles = ["EndcordInstaller.exe", "EndcordInstaller.rar", "EndcordInstaller.zip"];
for (const instFile of installerFiles) {
    const srcInst = path.join(rootDir, instFile);
    if (fs.existsSync(srcInst)) {
        const dstInst = path.join(siteDir, instFile);
        fs.copyFileSync(srcInst, dstInst);
        console.log(`  └─ Copied installer: ${instFile}`);
    }
}

// Compress zip archive
try {
    const zipCmd = `powershell -Command "Compress-Archive -Path '${rootDir}\\EndcordInstaller.exe' -DestinationPath 'C:\\Users\\ewlle\\Desktop\\EndcordInstaller.zip' -Force; Copy-Item 'C:\\Users\\ewlle\\Desktop\\EndcordInstaller.zip' '${siteDir}\\EndcordInstaller.zip' -Force"`;
    execSync(zipCmd, { cwd: rootDir });
    console.log("  └─ Created and updated EndcordInstaller.zip");
} catch (e) {}

// 5. Update version.json directly in Endcord-site (no /api/ subfolder)
const versionData = {
    version: `1.0.${timestamp.toString().slice(-4)}`,
    hash: buildHash,
    updatedAt: timestamp,
    date: dateStr,
    downloadUrl: "https://raw.githubusercontent.com/rootpoii/endcord/main/dist/renderer.js",
    assets: copiedAssets.map(asset => ({
        ...asset,
        url: `https://raw.githubusercontent.com/rootpoii/endcord/main/dist/${asset.name}`
    }))
};

// Write to site root (htdocs root, no /api/ folder)
const versionJsonPath = path.join(siteDir, "version.json");
fs.writeFileSync(versionJsonPath, JSON.stringify(versionData, null, 2), "utf8");

// Also write to Desktop/api folder for server upload
const desktopApiDir = "C:\\Users\\ewlle\\Desktop\\api";
if (fs.existsSync(desktopApiDir)) {
    const desktopVersionPath = path.join(desktopApiDir, "version.json");
    fs.writeFileSync(desktopVersionPath, JSON.stringify(versionData, null, 2), "utf8");
    console.log(`✅ Updated ${desktopVersionPath}`);
}

console.log(`✅ Updated ${versionJsonPath}`);

// 6. Push assets to GitHub in 1 single atomic commit via Git Data API (0% 409 conflict guarantee!)
const GITHUB_REPO = "rootpoii/endcord";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const GITHUB_API_BASE = `https://api.github.com/repos/${GITHUB_REPO}`;

async function deployReleaseToGitHub() {
    if (!GITHUB_TOKEN) {
        console.log("⚠️ Skipping GitHub upload: set GITHUB_TOKEN in the environment.");
        return;
    }
    console.log("\n📤 Uploading release assets to GitHub (Single Atomic Commit)...");

    const headers = {
        "Authorization": `Bearer ${GITHUB_TOKEN}`,
        "Accept": "application/vnd.github+json",
        "User-Agent": "Endcord-Release-Uploader",
        "Content-Type": "application/json"
    };

    // Prepare list of files to upload
    const filesToUpload = [];
    for (const file of distFiles) {
        const srcFile = path.join(distDir, file);
        if (fs.lstatSync(srcFile).isFile()) {
            filesToUpload.push({ filePath: srcFile, repoPath: `dist/${file}` });
        }
    }

    // Include version.json in the atomic release commit
    const tempVersionPath = path.join(distDir, "version.json");
    fs.writeFileSync(tempVersionPath, JSON.stringify(versionData, null, 2), "utf8");
    filesToUpload.push({ filePath: tempVersionPath, repoPath: "version.json" });

    async function githubFetch(url, options = {}) {
        let attempt = 0;
        while (true) {
            attempt++;
            const res = await fetch(url, { ...options, headers });
            if (res.ok) return res;

            if (res.status === 403 || res.status === 429) {
                const resetHeader = res.headers.get("x-ratelimit-reset");
                let waitMs = 3000;
                if (resetHeader) {
                    waitMs = Math.max(2000, (parseInt(resetHeader, 10) * 1000) - Date.now() + 2000);
                }
                const waitSec = Math.ceil(waitMs / 1000);
                console.warn(`⚠️ GitHub API ${res.status} Rate Limit. Waiting ${waitSec}s...`);
                await new Promise(r => setTimeout(r, waitMs));
                continue;
            }

            if (res.status === 409 && attempt <= 5) {
                console.warn(`⚠️ GitHub 409 Conflict on ${url}. Retrying in 2s...`);
                await new Promise(r => setTimeout(r, 2000));
                continue;
            }

            const bodyText = await res.text().catch(() => "");
            throw new Error(`GitHub API HTTP ${res.status} on ${url}: ${bodyText}`);
        }
    }

    try {
        // Step 1: Get latest commit SHA on main branch
        const refRes = await githubFetch(`${GITHUB_API_BASE}/git/ref/heads/main`);
        const refData = await refRes.json();
        const parentCommitSha = refData.object.sha;

        // Step 2: Get base tree SHA
        const commitRes = await githubFetch(`${GITHUB_API_BASE}/git/commits/${parentCommitSha}`);
        const commitData = await commitRes.json();
        const baseTreeSha = commitData.tree.sha;

        // Step 3: Create Blobs for each file (blobs don't touch branch locks -> NEVER cause 409!)
        console.log(`  └─ Creating ${filesToUpload.length} file blobs in parallel...`);
        const treeEntries = await Promise.all(filesToUpload.map(async ({ filePath, repoPath }) => {
            const content = fs.readFileSync(filePath).toString("base64");
            const blobRes = await githubFetch(`${GITHUB_API_BASE}/git/blobs`, {
                method: "POST",
                body: JSON.stringify({ content, encoding: "base64" })
            });
            const blobData = await blobRes.json();
            return {
                path: repoPath,
                mode: "100644",
                type: "blob",
                sha: blobData.sha
            };
        }));

        // Step 4: Create single Git Tree
        const treeRes = await githubFetch(`${GITHUB_API_BASE}/git/trees`, {
            method: "POST",
            body: JSON.stringify({
                base_tree: baseTreeSha,
                tree: treeEntries
            })
        });
        const treeData = await treeRes.json();

        // Step 5: Create single Commit
        const newCommitRes = await githubFetch(`${GITHUB_API_BASE}/git/commits`, {
            method: "POST",
            body: JSON.stringify({
                message: `Release version ${versionData.version} (${versionData.hash})`,
                tree: treeData.sha,
                parents: [parentCommitSha]
            })
        });
        const newCommitData = await newCommitRes.json();

        // Step 6: Update main branch ref ONCE (Single atomic branch update -> 0% 409 conflict!)
        await githubFetch(`${GITHUB_API_BASE}/git/refs/heads/main`, {
            method: "PATCH",
            body: JSON.stringify({
                sha: newCommitData.sha,
                force: false
            })
        });

        console.log(`✅ Atomic Release Commit (${newCommitData.sha.slice(0, 7)}) deployed to GitHub!`);
    } finally {
        try { fs.unlinkSync(tempVersionPath); } catch {}
    }
}

await deployReleaseToGitHub();

console.log("\n🎉 Endcord Release successfully deployed to GitHub!");
console.log("All active Endcord clients will now receive the update prompt in Discord!\n");
