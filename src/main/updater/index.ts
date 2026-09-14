/*
 * Endcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { existsSync } from "fs";
import { join } from "path";

if (!IS_UPDATER_DISABLED) {
    const hasGit = existsSync(join(__dirname, "..", ".git"));
    require(hasGit && !IS_STANDALONE ? "./git" : "./http");
}

