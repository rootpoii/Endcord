#!/usr/bin/env python3
# Endcord Linux installer GUI — same layout/colors as InstallerGUI.cs
from __future__ import print_function

import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.request import urlopen, Request

HOME = os.path.expanduser("~")
if os.environ.get("SUDO_USER") and os.geteuid() == 0:
    try:
        import pwd
        HOME = pwd.getpwnam(os.environ["SUDO_USER"]).pw_dir
    except Exception:
        HOME = "/home/" + os.environ["SUDO_USER"]

CONFIG = os.environ.get("XDG_CONFIG_HOME") or os.path.join(HOME, ".config")
DIST_DIR = os.path.join(CONFIG, "Endcord", "dist")
FILES = ("patcher.js", "preload.js", "renderer.js", "renderer.css")
MIRRORS = (
    "https://raw.githubusercontent.com/rootpoii/endcord/main/dist",
    "https://endcord.com/dist",
)
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
HERE = Path(SCRIPT_DIR)
QUIT = threading.Event()

LOADER_JS = """const { join } = require('path');
const appData = process.env.APPDATA || (process.platform === 'darwin' ? join(process.env.HOME, 'Library/Application Support') : join(process.env.HOME, '.config'));
const patcherPath = join(appData, 'Endcord', 'dist', 'patcher.js');
require(patcherPath);
"""
LOADER_PKG = '{\n  "name": "discord",\n  "main": "index.js"\n}\n'

CANDIDATES = [
    ("Discord Stable", "/opt/discord", "Discord"),
    ("Discord Stable", "/opt/Discord", "Discord"),
    ("Discord Stable", "/usr/share/discord", "discord"),
    ("Discord Stable", "/usr/share/Discord", "Discord"),
    ("Discord Stable", "/usr/lib64/discord", "discord"),
    ("Discord Stable", "/usr/lib/discord", "discord"),
    ("Discord Stable", os.path.join(HOME, ".local/share/discord"), "Discord"),
    ("Discord Canary", "/opt/discord-canary", "DiscordCanary"),
    ("Discord Canary", "/usr/share/discord-canary", "discord-canary"),
    ("Discord Canary", os.path.join(HOME, ".local/share/discord-canary"), "DiscordCanary"),
    ("Discord PTB", "/opt/discord-ptb", "DiscordPTB"),
    ("Discord PTB", "/usr/share/discord-ptb", "discord-ptb"),
    ("Discord PTB", os.path.join(HOME, ".local/share/discord-ptb"), "DiscordPTB"),
    ("Discord Dev", "/opt/discord-development", "DiscordDevelopment"),
    ("Discord Dev", "/usr/share/discord-development", "discord-development"),
    ("Discord Stable (Flatpak)", "/var/lib/flatpak/app/com.discordapp.Discord/current/active/files/discord", "Discord"),
    ("Discord Stable (Flatpak)", os.path.join(HOME, ".local/share/flatpak/app/com.discordapp.Discord/current/active/files/discord"), "Discord"),
    ("Discord Canary (Flatpak)", "/var/lib/flatpak/app/com.discordapp.DiscordCanary/current/active/files/discord-canary", "DiscordCanary"),
    ("Discord Canary (Flatpak)", os.path.join(HOME, ".local/share/flatpak/app/com.discordapp.DiscordCanary/current/active/files/discord-canary"), "DiscordCanary"),
]


def _is_discord_res(res):
    return (
        os.path.isfile(os.path.join(res, "app.asar"))
        or os.path.isfile(os.path.join(res, "_app.asar"))
        or os.path.isfile(os.path.join(res, "app", "index.js"))
    )


def resource_dirs(root):
    root = os.path.abspath(root)
    found = []
    try:
        for name in sorted(os.listdir(root)):
            if name.startswith("app-"):
                res = os.path.join(root, name, "resources")
                if os.path.isdir(res) and _is_discord_res(res):
                    found.append(res)
    except OSError:
        pass
    res = os.path.join(root, "resources")
    if not found and os.path.isdir(res) and _is_discord_res(res):
        found.append(res)
    return found


def read_version(root, res):
    for p in (
        os.path.join(root, "resources", "build_info.json"),
        os.path.join(res, "build_info.json"),
    ):
        try:
            data = json.loads(Path(p).read_text(encoding="utf-8"))
            v = data.get("version") or data.get("versionHash")
            if v:
                return str(v)
        except Exception:
            pass
    parent = os.path.basename(os.path.dirname(res))
    return parent if parent.startswith("app-") else "resources"


def has_endcord(res):
    idx = os.path.join(res, "app", "index.js")
    try:
        return os.path.isfile(idx) and "Endcord" in Path(idx).read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return False


def is_running(proc):
    try:
        r = subprocess.run(["pgrep", "-x", proc], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return r.returncode == 0
    except OSError:
        return False


def snap_warning():
    return os.path.isdir("/snap/discord")


def scan_clients(extra_roots=None):
    seen = set()
    out = []
    rows = list(CANDIDATES)
    for root in extra_roots or []:
        rows.append(("Custom Path", root, "Discord"))
    for name, root, proc in rows:
        if not root or not os.path.isdir(root):
            continue
        key = os.path.realpath(root)
        if key in seen:
            continue
        ress = resource_dirs(root)
        if not ress:
            continue
        seen.add(key)
        res = ress[-1]
        out.append({
            "name": name,
            "root": root,
            "resources": res,
            "proc": proc,
            "version": read_version(root, res),
            "running": is_running(proc),
            "injected": any(has_endcord(r) for r in ress),
            "writable": os.access(os.path.dirname(res), os.W_OK),
        })
    return out


def find_local_dist():
    for p in (
        HERE / "dist",
        HERE.parent / "dist",
        Path(os.getcwd()) / "dist",
    ):
        if (p / "patcher.js").is_file():
            return p
    return None


def fetch_dist():
    os.makedirs(DIST_DIR, exist_ok=True)
    local = find_local_dist()
    if local:
        for f in FILES:
            shutil.copy2(str(local / f), os.path.join(DIST_DIR, f))
        return "local " + str(local)
    last = None
    for mirror in MIRRORS:
        try:
            for f in FILES:
                req = Request(mirror + "/" + f, headers={"User-Agent": "EndcordInstaller"})
                with urlopen(req, timeout=30) as r, open(os.path.join(DIST_DIR, f), "wb") as out:
                    out.write(r.read())
            return mirror
        except Exception as e:
            last = e
    raise RuntimeError("Could not download dist: %s" % last)


def write_loader(app_dir):
    os.makedirs(app_dir, exist_ok=True)
    Path(os.path.join(app_dir, "package.json")).write_text(LOADER_PKG, encoding="utf-8")
    Path(os.path.join(app_dir, "index.js")).write_text(LOADER_JS, encoding="utf-8")


def _patch_res(res):
    asar = os.path.join(res, "app.asar")
    backup = os.path.join(res, "_app.asar")
    app = os.path.join(res, "app")
    if os.path.isdir(asar):
        shutil.rmtree(asar, ignore_errors=True)
    if os.path.isfile(asar):
        size = os.path.getsize(backup) if os.path.isfile(backup) else 0
        if size < 100000:
            if os.path.isfile(backup):
                os.remove(backup)
            os.rename(asar, backup)
        else:
            os.remove(asar)
    if os.path.isdir(app):
        shutil.rmtree(app, ignore_errors=True)
    write_loader(app)


def _restore_res(res):
    asar = os.path.join(res, "app.asar")
    backup = os.path.join(res, "_app.asar")
    app = os.path.join(res, "app")
    if os.path.isdir(app):
        shutil.rmtree(app, ignore_errors=True)
    if os.path.isdir(asar):
        shutil.rmtree(asar, ignore_errors=True)
    if os.path.isfile(backup):
        if os.path.isfile(asar):
            os.remove(asar)
        try:
            os.rename(backup, asar)
        except OSError:
            shutil.copy2(backup, asar)
            os.remove(backup)


PRIV_BASH = r"""#!/usr/bin/env bash
set -euo pipefail
mode="$1"
res="$2"
asar="$res/app.asar"
backup="$res/_app.asar"
app="$res/app"
if [ "$mode" = patch ]; then
  [ -d "$asar" ] && rm -rf "$asar"
  if [ -f "$asar" ]; then
    bsz=0
    [ -f "$backup" ] && bsz=$(stat -c%s "$backup" 2>/dev/null || echo 0)
    if [ "$bsz" -lt 100000 ]; then
      rm -f "$backup"
      mv "$asar" "$backup"
    else
      rm -f "$asar"
    fi
  fi
  rm -rf "$app"
  mkdir -p "$app"
  printf '%s\n' '{"name":"discord","main":"index.js"}' > "$app/package.json"
  cat > "$app/index.js" <<'EOF'
const { join } = require('path');
const appData = process.env.APPDATA || (process.platform === 'darwin' ? join(process.env.HOME, 'Library/Application Support') : join(process.env.HOME, '.config'));
const patcherPath = join(appData, 'Endcord', 'dist', 'patcher.js');
require(patcherPath);
EOF
else
  rm -rf "$app"
  [ -d "$asar" ] && rm -rf "$asar"
  if [ -f "$backup" ]; then
    rm -f "$asar"
    mv "$backup" "$asar" 2>/dev/null || { cp -f "$backup" "$asar"; rm -f "$backup"; }
  fi
fi
"""


def run_priv(mode, res):
    fd, path = tempfile.mkstemp(prefix="endcord-", suffix=".sh")
    os.close(fd)
    try:
        Path(path).write_text(PRIV_BASH, encoding="utf-8")
        os.chmod(path, 0o700)
        env = os.environ.copy()
        cmds = []
        if shutil.which("pkexec"):
            cmds.append(["pkexec", "bash", path, mode, res])
        if shutil.which("sudo"):
            cmds.append(["sudo", "bash", path, mode, res])
        last = None
        for cmd in cmds:
            try:
                subprocess.run(cmd, check=True, env=env)
                return
            except Exception as e:
                last = e
        raise RuntimeError("Need admin rights for %s (%s)" % (res, last))
    finally:
        try:
            os.remove(path)
        except OSError:
            pass


def apply_res(mode, res):
    parent = os.path.dirname(res)
    try:
        if os.access(parent, os.W_OK):
            (_patch_res if mode == "patch" else _restore_res)(res)
            return
    except PermissionError:
        pass
    run_priv(mode, res)


def close_discord():
    names = (
        "Discord", "DiscordCanary", "DiscordPTB", "DiscordDevelopment",
        "discord", "discord-canary", "discord-ptb", "discord-development",
    )
    for n in names:
        subprocess.run(["pkill", "-x", n], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)


def launch_client(root, proc):
    for name in (proc, proc.lower(), "Discord", "discord"):
        exe = os.path.join(root, name)
        if os.path.isfile(exe) and os.access(exe, os.X_OK):
            subprocess.Popen([exe], start_new_session=True)
            return
    desktop = {
        "Discord": "discord",
        "DiscordCanary": "discord-canary",
        "DiscordPTB": "discord-ptb",
    }.get(proc)
    if desktop:
        subprocess.Popen(["gtk-launch", desktop], start_new_session=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def do_action(action, roots, relaunch):
    logs = []
    def log(msg):
        logs.append(msg)

    clients = [c for c in scan_clients(roots) if c["root"] in roots or c["root"].rstrip("/") in roots]
    if action != "kill" and not clients:
        # custom path may not be in CANDIDATES
        for root in roots:
            for res in resource_dirs(root):
                clients.append({
                    "name": "Custom Path", "root": root, "resources": res,
                    "proc": "Discord", "version": read_version(root, res),
                    "running": False, "injected": has_endcord(res), "writable": True,
                })

    if action == "kill":
        close_discord()
        log("Closed Discord processes.")
        return logs

    close_discord()
    log("Closed Discord.")

    if action in ("install", "repair"):
        src = fetch_dist()
        log("Dist ready (%s)." % src)

    for c in clients:
        for res in resource_dirs(c["root"]):
            try:
                if action == "uninstall":
                    apply_res("restore", res)
                    log("Restored %s" % c["name"])
                else:
                    apply_res("patch", res)
                    log("Patched %s → %s/app" % (c["name"], res))
            except Exception as e:
                log("ERROR %s: %s" % (c["name"], e))

    if action == "uninstall":
        shutil.rmtree(os.path.join(CONFIG, "Endcord"), ignore_errors=True)
        log("Removed ~/.config/Endcord")

    if relaunch and action != "uninstall":
        for c in clients:
            try:
                launch_client(c["root"], c["proc"])
            except Exception:
                pass
        log("Relaunch requested.")
    return logs


HTML = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Endcord Installer</title>
<style>
  :root {
    --bg: #0a0b12;
    --sidebar: #10111c;
    --card: #17192a;
    --card-hov: #1f2138;
    --accent: #6366f1;
    --accent-light: #818cf8;
    --green: #10b981;
    --red: #ef4444;
    --amber: #f59e0b;
    --blue: #3b82f6;
    --text: #f3f4f6;
    --dim: #9ca3af;
    --dark: #4b5563;
    --border: #1f2937;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; overflow: hidden; background: var(--bg); color: var(--text);
    font-family: "Segoe UI", "Ubuntu", "Noto Sans", sans-serif; user-select: none; }
  #app { display: flex; flex-direction: column; height: 100%; }
  #title {
    height: 44px; background: var(--sidebar); display: flex; align-items: center;
    padding: 0 8px 0 14px; border-bottom: 1px solid rgba(55,65,81,.18); flex-shrink: 0;
  }
  .logo {
    width: 28px; height: 28px; border-radius: 50%;
    background: linear-gradient(135deg, #5865f2, #7289da);
    color: #fff; font-weight: 700; font-size: 14px;
    display: flex; align-items: center; justify-content: center; margin-right: 8px;
  }
  .brand { font-weight: 700; font-size: 16px; }
  .brand span { font-weight: 400; color: #8c9be6; margin-left: 4px; }
  .winbtns { margin-left: auto; display: flex; }
  .winbtn { width: 44px; height: 44px; border: 0; background: transparent; color: var(--dim); cursor: pointer; font-size: 14px; font-weight: 700; }
  .winbtn:hover { color: #fff; background: #4b5563; }
  .winbtn.close:hover { background: var(--red); }
  #body { display: flex; flex: 1; min-height: 0; }
  #side {
    width: 210px; background: var(--sidebar); position: relative; overflow: hidden; flex-shrink: 0;
    border-right: 1px solid rgba(55,65,81,.14);
  }
  #beam {
    position: absolute; right: 0; width: 5px; height: 86px;
    background: linear-gradient(180deg, transparent, rgba(255,255,255,.52), transparent);
    animation: sweep 7.5s linear infinite; pointer-events: none;
  }
  @keyframes sweep { from { top: 110%; } to { top: -120px; } }
  .tab {
    margin: 10px 10px 0; padding: 10px 12px 10px 18px; border-radius: 8px; cursor: pointer;
    border: 1px solid transparent; transition: background .15s, border-color .15s, color .15s;
  }
  .tab .t { font-size: 13px; font-weight: 650; color: var(--dim); }
  .tab .d { font-size: 11px; color: var(--dark); margin-top: 2px; }
  .tab:hover { background: rgba(30,33,58,.25); border-color: rgba(129,140,248,.2); }
  .tab:hover .t { color: #fff; }
  .tab.active {
    background: linear-gradient(180deg, rgba(99,102,241,.24), rgba(99,102,241,.06));
    border-color: rgba(129,140,248,.55);
    box-shadow: 0 0 0 1px rgba(129,140,248,.12), 0 0 18px rgba(99,102,241,.12);
    position: relative;
  }
  .tab.active::before {
    content: ""; position: absolute; left: 0; top: 15px; width: 3px; height: 24px;
    background: #fff; border-radius: 2px;
  }
  .tab.active .t { color: #fff; }
  .tab.active .d { color: var(--accent-light); }
  #main { flex: 1; display: flex; flex-direction: column; padding: 16px 20px; min-width: 0; }
  .head { display: flex; align-items: center; height: 32px; }
  .head h2 { margin: 0; font-size: 11px; letter-spacing: .08em; color: var(--dark); font-weight: 600; }
  .links { margin-left: auto; display: flex; gap: 16px; }
  .link { color: var(--dim); font-size: 13px; cursor: pointer; }
  .link:hover { color: var(--accent-light); }
  #cards { margin-top: 8px; max-height: 248px; overflow: auto; display: flex; flex-direction: column; gap: 8px; }
  .card {
    height: 78px; background: var(--card); border: 1px solid var(--border); border-radius: 10px;
    display: flex; align-items: center; padding: 0 16px 0 16px; cursor: pointer; transition: .15s;
  }
  .card:hover { background: var(--card-hov); }
  .card.sel {
    background: linear-gradient(135deg, #262a5a, #161936);
    border-color: var(--accent-light);
    box-shadow: 0 0 16px rgba(129,140,248,.18);
  }
  .chk {
    width: 20px; height: 20px; border-radius: 6px; border: 1.5px solid var(--dark);
    margin-right: 16px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
  }
  .card.sel .chk { background: var(--accent); border-color: #fff; }
  .chk svg { display: none; }
  .card.sel .chk svg { display: block; }
  .meta { min-width: 0; flex: 1; }
  .meta .n { font-size: 14px; font-weight: 650; }
  .meta .s { font-size: 12px; color: var(--dim); margin-top: 2px; display: flex; align-items: center; gap: 6px; }
  .meta .s.live { color: var(--green); }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--green); box-shadow: 0 0 8px var(--green); }
  .meta .p { font-size: 11px; color: var(--dark); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .badges { display: flex; gap: 8px; margin-left: 12px; flex-shrink: 0; }
  .badge { font-size: 11px; padding: 4px 10px; border-radius: 6px; border: 1px solid; }
  .b-stable { color: var(--blue); background: rgba(59,130,246,.12); border-color: rgba(59,130,246,.45); }
  .b-canary { color: var(--amber); background: rgba(245,158,11,.12); border-color: rgba(245,158,11,.45); }
  .b-ptb { color: var(--accent); background: rgba(99,102,241,.12); border-color: rgba(99,102,241,.45); }
  .b-dev { color: var(--red); background: rgba(239,68,68,.12); border-color: rgba(239,68,68,.45); }
  .b-custom { color: var(--dim); background: rgba(156,163,175,.08); border-color: rgba(156,163,175,.35); }
  .b-end { color: var(--green); background: rgba(16,185,129,.1); border-color: rgba(16,185,129,.45); }
  .b-van { color: var(--amber); background: rgba(245,158,11,.1); border-color: rgba(245,158,11,.45); }
  .opts { height: 32px; display: flex; align-items: center; gap: 22px; margin: 8px 0; font-size: 13px; color: var(--dim); }
  .opts label { cursor: pointer; display: flex; align-items: center; gap: 8px; }
  .opts input { accent-color: var(--accent); }
  #log {
    flex: 1; background: var(--sidebar); border-radius: 8px; padding: 10px 12px;
    font-family: Consolas, "Ubuntu Mono", monospace; font-size: 12px; color: var(--dim);
    overflow: auto; white-space: pre-wrap; min-height: 80px;
  }
  .log-ok { color: var(--green); }
  .log-err { color: var(--red); }
  .log-warn { color: var(--amber); }
  #act { height: 52px; display: flex; align-items: center; justify-content: flex-end; }
  #go {
    height: 44px; min-width: 220px; border: 0; border-radius: 9px; cursor: pointer;
    color: #fff; font-weight: 700; letter-spacing: .04em; font-size: 13px;
    background: linear-gradient(90deg, var(--accent), var(--accent-light));
    box-shadow: 0 6px 20px rgba(99,102,241,.28);
  }
  #go:hover { filter: brightness(1.08); }
  #go:disabled { background: var(--border); box-shadow: none; cursor: default; }
  #status {
    height: 36px; background: var(--sidebar); display: flex; align-items: center;
    padding: 0 16px; color: var(--dim); font-size: 13px; flex-shrink: 0;
    border-top: 1px solid rgba(55,65,81,.14);
  }
  #bar { margin-left: auto; width: 220px; height: 6px; background: var(--card); border-radius: 3px; overflow: hidden; display: none; }
  #bar > i { display: block; height: 100%; width: 0; background: linear-gradient(90deg, var(--accent), var(--accent-light)); }
  .empty { color: var(--amber); padding: 24px 8px; font-size: 13px; }
</style>
</head>
<body>
<div id="app">
  <div id="title">
    <div class="logo">E</div>
    <div class="brand">Endcord<span>Installer</span></div>
    <div class="winbtns">
      <button class="winbtn" onclick="document.body.style.visibility='hidden'">—</button>
      <button class="winbtn close" onclick="quit()">✕</button>
    </div>
  </div>
  <div id="body">
    <div id="side">
      <div id="beam"></div>
      <div class="tab active" data-i="0" onclick="tab(0)"><div class="t">Install Endcord</div><div class="d">Inject client mod</div></div>
      <div class="tab" data-i="1" onclick="tab(1)"><div class="t">Uninstall</div><div class="d">Restore vanilla</div></div>
      <div class="tab" data-i="2" onclick="tab(2)"><div class="t">Repair Install</div><div class="d">Fix broken files</div></div>
      <div class="tab" data-i="3" onclick="tab(3)"><div class="t">Close Discord</div><div class="d">Force exit clients</div></div>
    </div>
    <div id="main">
      <div class="head">
        <h2>DETECTED DISCORD INSTALLATIONS</h2>
        <div class="links">
          <div class="link" onclick="addPath()">+ Custom Path</div>
          <div class="link" onclick="refresh()">Refresh</div>
        </div>
      </div>
      <div id="cards"></div>
      <div class="opts">
        <label><input type="checkbox" id="all" checked onchange="selAll(this.checked)"> Select All</label>
        <label><input type="checkbox" id="relaunch" checked> Relaunch Discord after action</label>
      </div>
      <div id="log"></div>
      <div id="act"><button id="go" onclick="go()">INSTALL ENDCORD</button></div>
    </div>
  </div>
  <div id="status">Ready<div id="bar"><i></i></div></div>
</div>
<script>
const ACTIONS = ["install","uninstall","repair","kill"];
const LABELS = ["INSTALL ENDCORD","UNINSTALL ENDCORD","REPAIR INSTALLATION","CLOSE ALL DISCORD"];
const MODES = ["Install","Uninstall","Repair","Close Discord"];
let mode = 0, clients = [], extra = [], selected = new Set();

function log(msg, cls) {
  const el = document.getElementById("log");
  const d = document.createElement("div");
  if (cls) d.className = cls;
  d.textContent = msg;
  el.appendChild(d);
  el.scrollTop = el.scrollHeight;
}
function status(t) { document.querySelector("#status").firstChild.textContent = t; }
function edition(name) {
  if (name.includes("Stable")) return ["STABLE","b-stable"];
  if (name.includes("Canary")) return ["CANARY","b-canary"];
  if (name.includes("PTB")) return ["PTB","b-ptb"];
  if (name.includes("Dev")) return ["DEV","b-dev"];
  return ["CUSTOM","b-custom"];
}
function render() {
  const box = document.getElementById("cards");
  box.innerHTML = "";
  if (!clients.length) {
    box.innerHTML = '<div class="empty">No Discord installations detected. Use + Custom Path, or install the .deb / .tar.gz / Flatpak build (Snap is not supported).</div>';
    return;
  }
  clients.forEach((c, i) => {
    const on = selected.has(c.root);
    const ed = edition(c.name);
    const div = document.createElement("div");
    div.className = "card" + (on ? " sel" : "");
    div.onclick = () => { if (selected.has(c.root)) selected.delete(c.root); else selected.add(c.root); render(); };
    div.innerHTML = `<div class="chk"><svg width="12" height="10" viewBox="0 0 12 10"><path d="M1 5l3 3 7-7" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg></div>
      <div class="meta">
        <div class="n">${esc(c.name)}</div>
        <div class="s${c.running?" live":""}">${c.running?'<span class="dot"></span>':""}${esc(c.version)} • ${c.running?"Running":"Closed"}</div>
        <div class="p">${esc(c.resources)}</div>
      </div>
      <div class="badges">
        <span class="badge ${ed[1]}">${ed[0]}</span>
        <span class="badge ${c.injected?"b-end":"b-van"}">${c.injected?"ENDCORD":"VANILLA"}</span>
      </div>`;
    box.appendChild(div);
  });
  document.getElementById("all").checked = clients.length > 0 && clients.every(c => selected.has(c.root));
}
function esc(s){ return String(s).replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }
function tab(i){
  mode = i;
  document.querySelectorAll(".tab").forEach((t,n)=>t.classList.toggle("active", n===i));
  document.getElementById("go").textContent = LABELS[i];
  clients.forEach(c => selected.add(c.root));
  render();
  status("Selected Mode: " + MODES[i]);
}
function selAll(on){ clients.forEach(c => on ? selected.add(c.root) : selected.delete(c.root)); render(); }
async function refresh(){
  const r = await fetch("/api/scan", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({extra})});
  const data = await r.json();
  clients = data.clients || [];
  selected = new Set(clients.map(c => c.root));
  render();
  if (data.snap) log("Snap Discord is read-only — Endcord cannot patch it.", "log-warn");
  if (!clients.length) { log("No Discord installations detected on this machine.", "log-warn"); status("No Discord installations found"); }
  else { log("Detected " + clients.length + " Discord client installation(s).", "log-ok"); status("Ready"); }
}
async function addPath(){
  const p = prompt("Discord folder (contains resources/app.asar):");
  if (!p) return;
  extra.push(p);
  await refresh();
}
function setBusy(on, pct){
  document.getElementById("go").disabled = on;
  const bar = document.getElementById("bar");
  bar.style.display = on ? "block" : "none";
  bar.firstChild.style.width = (pct||0) + "%";
}
async function go(){
  const roots = [...selected];
  if (mode !== 3 && !roots.length) { log("Select at least one Discord.", "log-err"); return; }
  setBusy(true, 15);
  status("Working…");
  try {
    setBusy(true, 40);
    const r = await fetch("/api/action", {method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({action: ACTIONS[mode], roots, relaunch: document.getElementById("relaunch").checked})});
    const data = await r.json();
    setBusy(true, 90);
    (data.logs||[]).forEach(l => log(l, /ERROR/i.test(l)?"log-err":"log-ok"));
    if (data.error) log(data.error, "log-err");
    await refresh();
    status(data.error ? "Failed" : "Done");
  } catch (e) {
    log(String(e), "log-err");
    status("Failed");
  }
  setBusy(false, 100);
}
async function quit(){ try { await fetch("/api/quit"); } catch(e) {} window.close(); }
refresh();
</script>
</body>
</html>
"""


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        return

    def _json(self, obj, code=200):
        raw = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def _html(self):
        raw = HTML.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path in ("/", "/index.html"):
            self._html()
        elif path == "/api/quit":
            self._json({"ok": True})
            QUIT.set()
        else:
            self.send_error(404)

    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0)
        try:
            body = json.loads(self.rfile.read(n) or b"{}")
        except Exception:
            body = {}
        path = self.path.split("?", 1)[0]
        if path == "/api/scan":
            extra = body.get("extra") or []
            self._json({"clients": scan_clients(extra), "snap": snap_warning()})
        elif path == "/api/action":
            try:
                logs = do_action(body.get("action") or "install", body.get("roots") or [], bool(body.get("relaunch")))
                self._json({"logs": logs})
            except Exception as e:
                self._json({"logs": [], "error": str(e)}, 500)
        elif path == "/api/quit":
            self._json({"ok": True})
            QUIT.set()
        else:
            self.send_error(404)


def try_gtk(url):
    try:
        import gi
        gi.require_version("Gtk", "3.0")
        try:
            gi.require_version("WebKit2", "4.1")
        except ValueError:
            gi.require_version("WebKit2", "4.0")
        from gi.repository import Gtk, WebKit2, GLib
    except Exception:
        return False

    win = Gtk.Window(title="Endcord Installer")
    win.set_default_size(880, 620)
    win.set_resizable(False)
    web = WebKit2.WebView()
    web.load_uri(url)
    win.add(web)
    win.connect("destroy", lambda *_: (QUIT.set(), Gtk.main_quit()))

    def poll():
        if QUIT.is_set():
            Gtk.main_quit()
            return False
        return True

    GLib.timeout_add(250, poll)
    win.show_all()
    Gtk.main()
    return True


def try_chrome(url):
    bins = (
        "google-chrome", "google-chrome-stable", "chromium", "chromium-browser",
        "microsoft-edge", "microsoft-edge-stable", "brave-browser",
    )
    for b in bins:
        path = shutil.which(b)
        if not path:
            continue
        profile = tempfile.mkdtemp(prefix="endcord-chrome-")
        try:
            p = subprocess.Popen([
                path, "--app=" + url, "--window-size=880,620",
                "--user-data-dir=" + profile, "--no-first-run", "--no-default-browser-check",
            ])
            while p.poll() is None and not QUIT.is_set():
                time.sleep(0.2)
            if p.poll() is None:
                p.terminate()
            return True
        except Exception:
            continue
        finally:
            shutil.rmtree(profile, ignore_errors=True)
    return False


def open_window(url):
    if try_gtk(url):
        return
    if try_chrome(url):
        return
    webbrowser.open(url)
    print("Opened Endcord Installer in your browser:", url)
    QUIT.wait()


def main():
    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
    sock.close()
    httpd = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    url = "http://127.0.0.1:%d/" % port
    try:
        open_window(url)
    finally:
        QUIT.set()
        httpd.shutdown()


if __name__ == "__main__":
    if "--cli" in sys.argv:
        print("Use ../install.sh --cli")
        sys.exit(2)
    main()
