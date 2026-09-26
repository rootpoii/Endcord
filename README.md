# Endcord

Endcord is a desktop client mod for Discord. It loads with the official app and adds plugins, themes, and a settings panel inside Discord.

[Website](https://endcord.com) · [Download](https://endcord.com/download) · [Discord](https://discord.gg/endcord)

## Install

Close Discord completely before installing, then open it again when the installer finishes.

### Windows

Windows 10 and 11. Stable, PTB, and Canary.

1. Download [EndcordInstaller.exe](https://endcord.com/EndcordInstaller.exe).
2. If the browser blocks the file, use [EndcordInstaller.zip](https://endcord.com/EndcordInstaller.zip) instead. It contains the same installer.
3. Run the installer and start Discord.

### Linux

Official Discord `.deb`, `.tar.gz`, or Flatpak. Snap is not supported.

```sh
sh -c "$(curl -sS https://endcord.com/install.sh)"
```

Or download [EndcordInstallerCli-linux](https://endcord.com/EndcordInstallerCli-linux) and run it yourself:

```sh
chmod +x EndcordInstallerCli-linux && ./EndcordInstallerCli-linux
```

## Uninstall

On Windows, open the installer again and restore the vanilla client.

On Linux, run the installer again and choose **Uninstall Endcord**.

## Build

Node.js 22 or newer, and [pnpm](https://pnpm.io).

```sh
git clone https://github.com/rootpoii/endcord.git
cd endcord
pnpm install
pnpm build
pnpm inject
```

`pnpm uninject` removes the local install. `pnpm watch` rebuilds while you edit.

## Plugins

Endcord ships with 367 built-in plugins. Turn them on from the Endcord settings tab inside Discord.

Plugin ideas and fixes go through pull requests. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening one.

## License

[GPL-3.0-or-later](LICENSE). Copyright © Vendicated and contributors.

Endcord is not affiliated with Discord Inc.
