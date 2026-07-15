using System;
using System.IO;
using System.Reflection;
using System.Diagnostics;
using System.Collections.Generic;

namespace EndcordInstaller
{
    class Program
    {
        static string EndcordDistPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "Endcord", "dist"
        );

        static void Main(string[] args)
        {
            Console.OutputEncoding = System.Text.Encoding.UTF8;
            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine("==================================================");
            Console.WriteLine("           ENDCORD KURULUM YÖNETİCİSİ             ");
            Console.WriteLine("==================================================");
            Console.ResetColor();

            while (true)
            {
                var clients = DetectDiscordClients();
                Console.WriteLine();
                Console.ForegroundColor = ConsoleColor.Yellow;
                Console.WriteLine("Lütfen Yapmak İstediğiniz İşlemi Seçin:");
                Console.ResetColor();
                Console.WriteLine("1. Endcord Kur (Install)");
                Console.WriteLine("2. Endcord Kaldır (Uninstall)");
                Console.WriteLine("3. Endcord Onar (Repair)");
                Console.WriteLine("4. Çalışan Discord Süreçlerini Kapat");
                Console.WriteLine("5. Çıkış");
                Console.Write("\nSeçiminiz (1-5): ");
                
                string choice = Console.ReadLine();
                if (choice == "5") break;

                switch (choice)
                {
                    case "1":
                        HandleInstall(clients, false);
                        break;
                    case "2":
                        HandleUninstall(clients);
                        break;
                    case "3":
                        HandleInstall(clients, true);
                        break;
                    case "4":
                        KillDiscordProcesses();
                        Console.ForegroundColor = ConsoleColor.Green;
                        Console.WriteLine("Discord süreçleri kapatıldı.");
                        Console.ResetColor();
                        break;
                    default:
                        Console.ForegroundColor = ConsoleColor.Red;
                        Console.WriteLine("Geçersiz seçim!");
                        Console.ResetColor();
                        break;
                }
            }
        }

        static List<DiscordClient> DetectDiscordClients()
        {
            var clients = new List<DiscordClient>();
            string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);

            var searchFolders = new Dictionary<string, string>
            {
                { "Discord", Path.Combine(localAppData, "Discord") },
                { "Discord Canary", Path.Combine(localAppData, "DiscordCanary") },
                { "Discord PTB", Path.Combine(localAppData, "DiscordPTB") },
                { "Discord Development", Path.Combine(localAppData, "DiscordDevelopment") }
            };

            Console.ForegroundColor = ConsoleColor.Blue;
            Console.WriteLine("\nTespit Edilen Discord Sürümleri:");
            Console.ResetColor();

            int index = 1;
            foreach (var kvp in searchFolders)
            {
                string name = kvp.Key;
                string path = kvp.Value;
                if (Directory.Exists(path))
                {
                    var appDirs = Directory.GetDirectories(path, "app-*");
                    if (appDirs.Length > 0)
                    {
                        Array.Sort(appDirs);
                        string latestAppDir = appDirs[appDirs.Length - 1];
                        string resourcesPath = Path.Combine(latestAppDir, "resources");
                        if (Directory.Exists(resourcesPath))
                        {
                            var client = new DiscordClient
                            {
                                Name = name,
                                RootPath = path,
                                AppPath = latestAppDir,
                                ResourcesPath = resourcesPath
                            };
                            clients.Add(client);
                            string status = client.IsInjected() ? "KURULU" : "KURULU DEĞİL";
                            Console.WriteLine(string.Format("{0}. {1} ({2}) [{3}]", index, client.Name, Path.GetFileName(client.AppPath), status));
                            index++;
                        }
                    }
                }
            }

            if (clients.Count == 0)
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("Hiçbir Discord sürümü tespit edilemedi!");
                Console.ResetColor();
            }

            return clients;
        }

        static void HandleInstall(List<DiscordClient> clients, bool isRepair)
        {
            if (clients.Count == 0) return;

            Console.Write("\nHangi Discord sürümüne kurmak istersiniz? (Numara girin veya hepsi için 'H' yazın): ");
            string rawInput = Console.ReadLine();
            string targetInput = rawInput != null ? rawInput.Trim().ToUpper() : "";

            var targets = new List<DiscordClient>();
            if (targetInput == "H")
            {
                targets.AddRange(clients);
            }
            else
            {
                int idx;
                if (int.TryParse(targetInput, out idx) && idx >= 1 && idx <= clients.Count)
                {
                    targets.Add(clients[idx - 1]);
                }
                else
                {
                    Console.ForegroundColor = ConsoleColor.Red;
                    Console.WriteLine("Geçersiz seçim!");
                    Console.ResetColor();
                    return;
                }
            }

            Console.Write("Çalışan Discord süreçlerini otomatik kapatmak ister misiniz? (E/H): ");
            string closeInput = Console.ReadLine();
            if (closeInput != null && closeInput.Trim().ToUpper() == "E")
            {
                KillDiscordProcesses();
            }

            // Extract files
            try
            {
                Directory.CreateDirectory(EndcordDistPath);
                string[] filesToExtract = new string[] {
                    "patcher.js", "patcher.js.map",
                    "preload.js", "preload.js.map",
                    "renderer.js", "renderer.js.map",
                    "renderer.css", "renderer.css.map"
                };

                Console.WriteLine("\n[1/2] Endcord dosyaları çıkartılıyor...");
                foreach (var file in filesToExtract)
                {
                    string dest = Path.Combine(EndcordDistPath, file);
                    ExtractResource(file, dest);
                    Console.WriteLine("Çıkartıldı: " + file);
                }
            }
            catch (Exception ex)
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("Endcord dosyaları çıkartılırken hata oluştu: " + ex.Message);
                Console.ResetColor();
                return;
            }

            // Inject into clients
            Console.WriteLine("[2/2] Discord'a enjekte ediliyor...");
            foreach (var client in targets)
            {
                try
                {
                    string appDir = Path.Combine(client.ResourcesPath, "app");
                    string originalAsar = Path.Combine(client.ResourcesPath, "app.asar");
                    string backupAsar = Path.Combine(client.ResourcesPath, "_app.asar");

                    if (File.Exists(originalAsar) && !File.Exists(backupAsar))
                    {
                        File.Move(originalAsar, backupAsar);
                    }

                    Directory.CreateDirectory(appDir);

                    string pkgJson = "{\n  \"name\": \"discord\",\n  \"main\": \"index.js\"\n}";
                    File.WriteAllText(Path.Combine(appDir, "package.json"), pkgJson);

                    string loaderJs = @"const { join } = require('path');
const appData = process.env.APPDATA || (process.platform === 'darwin' ? join(process.env.HOME, 'Library/Application Support') : join(process.env.HOME, '.config'));
const patcherPath = join(appData, 'Endcord', 'dist', 'patcher.js');
require(patcherPath);";
                    File.WriteAllText(Path.Combine(appDir, "index.js"), loaderJs);

                    Console.ForegroundColor = ConsoleColor.Green;
                    Console.WriteLine("Başarıyla kuruldu/onarıldı: " + client.Name);
                    Console.ResetColor();
                }
                catch (Exception ex)
                {
                    Console.ForegroundColor = ConsoleColor.Red;
                    Console.WriteLine(client.Name + " enjeksiyonu başarısız oldu: " + ex.Message);
                    Console.WriteLine("Lütfen Discord'un kapalı olduğundan ve yönetici izinlerine sahip olduğunuzdan emin olun.");
                    Console.ResetColor();
                }
            }
        }

        static void HandleUninstall(List<DiscordClient> clients)
        {
            if (clients.Count == 0) return;

            Console.Write("\nHangi Discord sürümünden kaldırmak istersiniz? (Numara girin veya hepsi için 'H' yazın): ");
            string rawInput = Console.ReadLine();
            string targetInput = rawInput != null ? rawInput.Trim().ToUpper() : "";

            var targets = new List<DiscordClient>();
            if (targetInput == "H")
            {
                targets.AddRange(clients);
            }
            else
            {
                int idx;
                if (int.TryParse(targetInput, out idx) && idx >= 1 && idx <= clients.Count)
                {
                    targets.Add(clients[idx - 1]);
                }
                else
                {
                    Console.ForegroundColor = ConsoleColor.Red;
                    Console.WriteLine("Geçersiz seçim!");
                    Console.ResetColor();
                    return;
                }
            }

            Console.Write("Çalışan Discord süreçlerini otomatik kapatmak ister misiniz? (E/H): ");
            string closeInput = Console.ReadLine();
            if (closeInput != null && closeInput.Trim().ToUpper() == "E")
            {
                KillDiscordProcesses();
            }

            foreach (var client in targets)
            {
                try
                {
                    string appDir = Path.Combine(client.ResourcesPath, "app");
                    string originalAsar = Path.Combine(client.ResourcesPath, "app.asar");
                    string backupAsar = Path.Combine(client.ResourcesPath, "_app.asar");

                    if (Directory.Exists(appDir))
                    {
                        Directory.Delete(appDir, true);
                    }

                    if (File.Exists(backupAsar))
                    {
                        if (File.Exists(originalAsar))
                        {
                            File.Delete(originalAsar);
                        }
                        File.Move(backupAsar, originalAsar);
                    }

                    Console.ForegroundColor = ConsoleColor.Green;
                    Console.WriteLine("Başarıyla kaldırıldı: " + client.Name);
                    Console.ResetColor();
                }
                catch (Exception ex)
                {
                    Console.ForegroundColor = ConsoleColor.Red;
                    Console.WriteLine(client.Name + " kaldırılması başarısız oldu: " + ex.Message);
                    Console.WriteLine("Lütfen Discord'un kapalı olduğundan emin olun.");
                    Console.ResetColor();
                }
            }
        }

        static void KillDiscordProcesses()
        {
            foreach (var proc in Process.GetProcesses())
            {
                try
                {
                    string name = proc.ProcessName.ToLower();
                    if (name.Contains("discord"))
                    {
                        proc.Kill();
                        proc.WaitForExit(3000);
                    }
                }
                catch { }
            }
        }

        static void ExtractResource(string endsWith, string targetPath)
        {
            var assembly = Assembly.GetExecutingAssembly();
            string match = null;
            foreach (var name in assembly.GetManifestResourceNames())
            {
                if (name.EndsWith(endsWith, StringComparison.OrdinalIgnoreCase))
                {
                    match = name;
                    break;
                }
            }
            if (match == null)
            {
                throw new Exception("Kaynak bulunamadı: " + endsWith);
            }
            using (Stream stream = assembly.GetManifestResourceStream(match))
            using (FileStream fileStream = new FileStream(targetPath, FileMode.Create))
            {
                stream.CopyTo(fileStream);
            }
        }
    }

    class DiscordClient
    {
        public string Name { get; set; }
        public string RootPath { get; set; }
        public string AppPath { get; set; }
        public string ResourcesPath { get; set; }
        public bool IsInjected()
        {
            string appDir = Path.Combine(ResourcesPath, "app");
            string backupAsar = Path.Combine(ResourcesPath, "_app.asar");
            return Directory.Exists(appDir) && File.Exists(backupAsar);
        }
    }
}
