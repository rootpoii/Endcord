/*
 * Endcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export const enum IpcEvents {
    INIT_FILE_WATCHERS = "EndcordInitFileWatchers",

    OPEN_QUICKCSS = "EndcordOpenQuickCss",
    GET_QUICK_CSS = "EndcordGetQuickCss",
    SET_QUICK_CSS = "EndcordSetQuickCss",
    QUICK_CSS_UPDATE = "EndcordQuickCssUpdate",

    GET_SETTINGS = "EndcordGetSettings",
    SET_SETTINGS = "EndcordSetSettings",

    GET_THEMES_LIST = "EndcordGetThemesList",
    GET_THEME_DATA = "EndcordGetThemeData",
    GET_THEME_SYSTEM_VALUES = "EndcordGetThemeSystemValues",
    THEME_UPDATE = "EndcordThemeUpdate",

    OPEN_EXTERNAL = "EndcordOpenExternal",
    OPEN_THEMES_FOLDER = "EndcordOpenThemesFolder",
    OPEN_SETTINGS_FOLDER = "EndcordOpenSettingsFolder",

    GET_UPDATES = "EndcordGetUpdates",
    GET_REPO = "EndcordGetRepo",
    UPDATE = "EndcordUpdate",
    BUILD = "EndcordBuild",

    OPEN_MONACO_EDITOR = "EndcordOpenMonacoEditor",
    GET_MONACO_THEME = "EndcordGetMonacoTheme",

    GET_PLUGIN_IPC_METHOD_MAP = "EndcordGetPluginIpcMethodMap",

    CSP_IS_DOMAIN_ALLOWED = "EndcordCspIsDomainAllowed",
    CSP_REMOVE_OVERRIDE = "EndcordCspRemoveOverride",
    CSP_REQUEST_ADD_OVERRIDE = "EndcordCspRequestAddOverride",

    GET_RENDERER_CSS = "EndcordGetRendererCss",
    RENDERER_CSS_UPDATE = "EndcordRendererCssUpdate",
    PRELOAD_GET_RENDERER_JS = "EndcordPreloadGetRendererJs",

    SUPPORTS_WINDOWS_MATERIAL = "EndcordSupportsWindowsMaterial",
}
