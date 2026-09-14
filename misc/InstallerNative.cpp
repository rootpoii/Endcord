#include <windows.h>
#include <tlhelp32.h>
#include <iostream>
#include <string>
#include <vector>

void ForceKillProcess(const wchar_t* processName) {
    HANDLE hSnap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    if (hSnap == INVALID_HANDLE_VALUE) return;

    PROCESSENTRY32W pe;
    pe.dwSize = sizeof(pe);

    if (Process32FirstW(hSnap, &pe)) {
        do {
            if (_wcsicmp(pe.szExeFile, processName) == 0) {
                HANDLE hProc = OpenProcess(PROCESS_TERMINATE, FALSE, pe.th32ProcessID);
                if (hProc) {
                    TerminateProcess(hProc, 0);
                    CloseHandle(hProc);
                }
            }
        } while (Process32NextW(hSnap, &pe));
    }
    CloseHandle(hSnap);
}

void SafeDeleteDirectory(const std::wstring& path) {
    std::wstring searchPath = path + L"\\*.*";
    WIN32_FIND_DATAW fd;
    HANDLE hFind = FindFirstFileW(searchPath.c_str(), &fd);

    if (hFind != INVALID_HANDLE_VALUE) {
        do {
            if (wcscmp(fd.cFileName, L".") != 0 && wcscmp(fd.cFileName, L"..") != 0) {
                std::wstring fullPath = path + L"\\" + fd.cFileName;
                if (fd.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) {
                    SafeDeleteDirectory(fullPath);
                } else {
                    SetFileAttributesW(fullPath.c_str(), FILE_ATTRIBUTE_NORMAL);
                    DeleteFileW(fullPath.c_str());
                }
            }
        } while (FindNextFileW(hFind, &fd));
        FindClose(hFind);
    }
    RemoveDirectoryW(path.c_str());
}

int WINAPI WinMain(HINSTANCE hInstance, HINSTANCE hPrevInstance, LPSTR lpCmdLine, int nCmdShow) {
    ForceKillProcess(L"Discord.exe");
    ForceKillProcess(L"DiscordCanary.exe");
    ForceKillProcess(L"DiscordPTB.exe");
    
    MessageBoxW(NULL, L"Endcord Native Win32 Engine Initialized Successfully.", L"Endcord Native", MB_OK | MB_ICONINFORMATION);
    return 0;
}
