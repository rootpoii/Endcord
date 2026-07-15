/*
 * Endcord, a modification for Discord's desktop app
 * Copyright (c) 2023 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
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
