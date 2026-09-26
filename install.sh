#!/bin/sh
# Endcord Linux installer — same download flow as Vencord:
#   sh -c "$(curl -sS https://endcord.com/install.sh)"
# Manual: chmod +x EndcordInstallerCli-linux && ./EndcordInstallerCli-linux
set -e

if [ "$(id -u)" -eq 0 ]; then
    echo "Run me as normal user, not root!"
    exit 1
fi

if [ -f /etc/lsb-release ] && grep -q "CHROMEOS_RELEASE_NAME" /etc/lsb-release 2>/dev/null; then
    echo "ChromeOS is not supported."
    exit 1
fi

echo "Downloading Installer..."

CONFIG="${XDG_CONFIG_HOME:-$HOME/.config}"
DIST_DIR="$CONFIG/Endcord/dist"
LOADER_DIR="$CONFIG/Endcord"

dl() {
    url="$1"
    dest="$2"
    if command -v curl >/dev/null 2>&1; then
        curl -sS --fail --location "$url" --output "$dest"
    elif command -v wget >/dev/null 2>&1; then
        wget -qO "$dest" "$url"
    else
        echo "curl or wget is required"
        return 1
    fi
}

mkdir -p "$DIST_DIR"
ok=0
for base in \
    "https://endcord.com/dist" \
    "https://raw.githubusercontent.com/rootpoii/endcord/main/dist"
do
    if dl "$base/patcher.js" "$DIST_DIR/patcher.js" \
        && dl "$base/preload.js" "$DIST_DIR/preload.js" \
        && dl "$base/renderer.js" "$DIST_DIR/renderer.js" \
        && dl "$base/renderer.css" "$DIST_DIR/renderer.css"
    then
        ok=1
        break
    fi
done

if [ "$ok" != 1 ]; then
    script_dir=$(CDPATH= cd -- "$(dirname -- "$0" 2>/dev/null)" && pwd 2>/dev/null) || script_dir=""
    if [ -n "$script_dir" ] && [ -f "$script_dir/dist/patcher.js" ]; then
        cp -f "$script_dir/dist/patcher.js" "$DIST_DIR/patcher.js"
        cp -f "$script_dir/dist/preload.js" "$DIST_DIR/preload.js"
        cp -f "$script_dir/dist/renderer.js" "$DIST_DIR/renderer.js"
        cp -f "$script_dir/dist/renderer.css" "$DIST_DIR/renderer.css"
        ok=1
    fi
fi

if [ "$ok" != 1 ]; then
    echo "Could not download Endcord files. Is https://endcord.com/dist online?"
    exit 1
fi

echo "Found Endcord files."

is_discord() {
    [ -f "$1/resources/app.asar" ] || [ -f "$1/resources/_app.asar" ] || [ -f "$1/resources/app/index.js" ]
}

CLIENTS=""
add() {
    name="$1"
    root="$2"
    [ -n "$root" ] || return 0
    [ -d "$root" ] || return 0
    is_discord "$root" || return 0
    case "$CLIENTS" in
        *"|$root|"*) return 0 ;;
    esac
    CLIENTS="$CLIENTS
$name|$root|"
}

add "Discord Stable" /opt/discord
add "Discord Stable" /opt/Discord
add "Discord Stable" /usr/share/discord
add "Discord Stable" /usr/share/Discord
add "Discord Stable" /usr/lib/discord
add "Discord Stable" /usr/lib64/discord
add "Discord Stable" "$HOME/.local/share/discord"
add "Discord Canary" /opt/discord-canary
add "Discord Canary" /usr/share/discord-canary
add "Discord Canary" "$HOME/.local/share/discord-canary"
add "Discord PTB" /opt/discord-ptb
add "Discord PTB" /usr/share/discord-ptb
add "Discord PTB" "$HOME/.local/share/discord-ptb"
add "Discord Dev" /opt/discord-development
add "Discord Stable (Flatpak)" /var/lib/flatpak/app/com.discordapp.Discord/current/active/files/discord
add "Discord Stable (Flatpak)" "$HOME/.local/share/flatpak/app/com.discordapp.Discord/current/active/files/discord"
add "Discord Canary (Flatpak)" /var/lib/flatpak/app/com.discordapp.DiscordCanary/current/active/files/discord-canary

if [ -d /snap/discord ]; then
    echo "Snap Discord is not supported. Use the official .deb or Flatpak."
fi

if [ -z "$(printf '%s' "$CLIENTS" | tr -d '[:space:]')" ]; then
    echo "No Discord install found. Snap is not supported."
    echo "Hint: install Discord from https://discord.com/download (.deb) or Flatpak."
    exit 1
fi

echo ""
echo "What would you like to do?"
echo "  1) Install Endcord"
echo "  2) Repair Endcord"
echo "  3) Uninstall Endcord"
echo "  4) Quit"
printf "Choice [1]: "
read choice || choice=1
case "$choice" in
    2) ACTION=repair ;;
    3) ACTION=uninstall ;;
    4|q|Q) exit 0 ;;
    *) ACTION=install ;;
esac

echo ""
echo "Select Discord install:"
i=0
printf '%s\n' "$CLIENTS" | while IFS= read -r line; do
    [ -n "$line" ] || continue
    i=$((i + 1))
    name=${line%%|*}
    rest=${line#*|}
    root=${rest%%|*}
    echo "  $i) $name  ($root)"
done

# rebuild numbered list for selection (POSIX: second pass)
n=0
printf '%s\n' "$CLIENTS" | while IFS= read -r line; do
    [ -n "$line" ] || continue
    n=$((n + 1))
done

printf "Choice [all]: "
read pick || pick=""

close_discord() {
    for n in Discord DiscordCanary DiscordPTB DiscordDevelopment discord discord-canary discord-ptb discord-development; do
        pkill -x "$n" 2>/dev/null || true
    done
    sleep 1
}

priv() {
    dir="$1"
    shift
    if [ -w "$dir" ]; then
        "$@"
    elif command -v sudo >/dev/null 2>&1; then
        echo "Running with sudo"
        sudo "$@"
    elif command -v doas >/dev/null 2>&1; then
        echo "Running with doas"
        doas "$@"
    elif command -v pkexec >/dev/null 2>&1; then
        echo "Running with pkexec"
        pkexec "$@"
    else
        echo "Neither sudo nor doas were found. Please install either of them to proceed."
        return 1
    fi
}

write_loader() {
    app="$1"
    mkdir -p "$app"
    printf '%s\n' '{"name":"discord","main":"index.js"}' > "$app/package.json"
    cat > "$app/index.js" <<'EOF'
const { join } = require('path');
const appData = process.env.APPDATA || (process.platform === 'darwin' ? join(process.env.HOME, 'Library/Application Support') : join(process.env.HOME, '.config'));
const patcherPath = join(appData, 'Endcord', 'dist', 'patcher.js');
require(patcherPath);
EOF
}

patch_one() {
    res="$1/resources"
    asar="$res/app.asar"
    backup="$res/_app.asar"
    app="$res/app"
    if [ -d "$asar" ]; then rm -rf "$asar"; fi
    if [ -f "$asar" ]; then
        bsz=0
        [ -f "$backup" ] && bsz=$(wc -c < "$backup" | tr -d ' ')
        if [ "$bsz" -lt 100000 ]; then
            rm -f "$backup"
            mv "$asar" "$backup"
        else
            rm -f "$asar"
        fi
    fi
    rm -rf "$app"
    write_loader "$app"
}

restore_one() {
    res="$1/resources"
    asar="$res/app.asar"
    backup="$res/_app.asar"
    app="$res/app"
    rm -rf "$app"
    [ -d "$asar" ] && rm -rf "$asar"
    if [ -f "$backup" ]; then
        rm -f "$asar"
        mv "$backup" "$asar" 2>/dev/null || { cp -f "$backup" "$asar"; rm -f "$backup"; }
    fi
}

do_root() {
    root="$1"
    parent="$root"
    [ -w "$parent" ] || parent=$(dirname "$root")
    case "$ACTION" in
        uninstall)
            priv "$root" sh -c "res=\"$root/resources\"; asar=\"\$res/app.asar\"; backup=\"\$res/_app.asar\"; app=\"\$res/app\"; rm -rf \"\$app\"; [ -d \"\$asar\" ] && rm -rf \"\$asar\"; if [ -f \"\$backup\" ]; then rm -f \"\$asar\"; mv \"\$backup\" \"\$asar\" 2>/dev/null || { cp -f \"\$backup\" \"\$asar\"; rm -f \"\$backup\"; }; fi"
            echo "Restored $root"
            ;;
        *)
            priv "$root" sh -c "
res=\"$root/resources\"
asar=\"\$res/app.asar\"
backup=\"\$res/_app.asar\"
app=\"\$res/app\"
[ -d \"\$asar\" ] && rm -rf \"\$asar\"
if [ -f \"\$asar\" ]; then
  bsz=0
  [ -f \"\$backup\" ] && bsz=\$(wc -c < \"\$backup\")
  if [ \"\$bsz\" -lt 100000 ]; then rm -f \"\$backup\"; mv \"\$asar\" \"\$backup\"; else rm -f \"\$asar\"; fi
fi
rm -rf \"\$app\"
mkdir -p \"\$app\"
printf '%s\\n' '{\"name\":\"discord\",\"main\":\"index.js\"}' > \"\$app/package.json\"
cat > \"\$app/index.js\" <<'ENDJS'
const { join } = require('path');
const appData = process.env.APPDATA || (process.platform === 'darwin' ? join(process.env.HOME, 'Library/Application Support') : join(process.env.HOME, '.config'));
const patcherPath = join(appData, 'Endcord', 'dist', 'patcher.js');
require(patcherPath);
ENDJS
"
            echo "Patched $root"
            ;;
    esac
}

close_discord

idx=0
printf '%s\n' "$CLIENTS" | while IFS= read -r line; do
    [ -n "$line" ] || continue
    idx=$((idx + 1))
    name=${line%%|*}
    rest=${line#*|}
    root=${rest%%|*}
    if [ -n "$pick" ] && [ "$pick" != "all" ] && [ "$pick" != "$idx" ]; then
        continue
    fi
    echo "==> $name"
    do_root "$root"
done

if [ "$ACTION" = uninstall ]; then
    rm -rf "$LOADER_DIR"
    echo "Uninstalled."
else
    echo "Done. Start Discord — Endcord loads from $DIST_DIR"
fi
