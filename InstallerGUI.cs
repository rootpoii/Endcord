using System;
using System.IO;
using System.Reflection;
using System.Diagnostics;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.Windows.Forms;
using System.Threading;
using System.Runtime.InteropServices;

[assembly: AssemblyTitle("Endcord Installer")]
[assembly: AssemblyDescription("Native Win32 fast installer, uninstaller and repair utility for Endcord.")]
[assembly: AssemblyConfiguration("")]
[assembly: AssemblyCompany("Endcord Inc.")]
[assembly: AssemblyProduct("Endcord")]
[assembly: AssemblyCopyright("Copyright © 2026 Endcord")]
[assembly: AssemblyTrademark("")]
[assembly: AssemblyCulture("")]
[assembly: AssemblyVersion("4.0.0.0")]
[assembly: AssemblyFileVersion("4.0.0.0")]

namespace EndcordInstaller
{
    static class Program
    {
        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new MainForm());
        }
    }

    // ═══════════════════════════════ NATIVE WIN32 KERNEL ENGINE ══════════════════════════════
    static class Win32Kernel
    {
        public const uint FILE_ATTRIBUTE_NORMAL = 0x80;
        public const uint PROCESS_TERMINATE     = 0x0001;
        public const uint TH32CS_SNAPPROCESS    = 0x00000002;

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
        public struct PROCESSENTRY32
        {
            public uint dwSize;
            public uint cntUsage;
            public uint th32ProcessID;
            public IntPtr th32DefaultHeapID;
            public uint dwFlags;
            public uint cntThreads;
            public uint th32ParentProcessID;
            public int pcPriClassBase;
            public uint dwFlags2;
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)]
            public string szExeFile;
        }

        [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
        public static extern bool DeleteFile(string lpFileName);

        [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
        public static extern bool RemoveDirectory(string lpPathName);

        [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
        public static extern bool SetFileAttributes(string lpFileName, uint dwFileAttributes);

        [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
        public static extern bool CopyFile(string lpExistingFileName, string lpNewFileName, bool bFailIfExists);

        [DllImport("kernel32.dll", SetLastError = true)]
        public static extern IntPtr CreateToolhelp32Snapshot(uint dwFlags, uint th32ProcessID);

        [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Auto)]
        public static extern bool Process32First(IntPtr hSnapshot, ref PROCESSENTRY32 lppe);

        [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Auto)]
        public static extern bool Process32Next(IntPtr hSnapshot, ref PROCESSENTRY32 lppe);

        [DllImport("kernel32.dll", SetLastError = true)]
        public static extern IntPtr OpenProcess(uint dwDesiredAccess, bool bInheritHandle, uint dwProcessId);

        [DllImport("kernel32.dll", SetLastError = true)]
        public static extern bool TerminateProcess(IntPtr hProcess, uint uExitCode);

        [DllImport("kernel32.dll", SetLastError = true)]
        public static extern bool CloseHandle(IntPtr hObject);

        public static void ForceKillProcessByName(string processName)
        {
            IntPtr hSnap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
            if (hSnap == IntPtr.Zero || hSnap == (IntPtr)(-1)) return;

            PROCESSENTRY32 pe = new PROCESSENTRY32();
            pe.dwSize = (uint)Marshal.SizeOf(typeof(PROCESSENTRY32));

            if (Process32First(hSnap, ref pe))
            {
                do
                {
                    if (string.Equals(pe.szExeFile, processName, StringComparison.OrdinalIgnoreCase))
                    {
                        IntPtr hProc = OpenProcess(PROCESS_TERMINATE, false, pe.th32ProcessID);
                        if (hProc != IntPtr.Zero)
                        {
                            TerminateProcess(hProc, 0);
                            CloseHandle(hProc);
                        }
                    }
                } while (Process32Next(hSnap, ref pe));
            }
            CloseHandle(hSnap);
        }

        public static void DirectWin32DeleteDir(string path)
        {
            if (!Directory.Exists(path)) return;
            try
            {
                foreach (string file in Directory.GetFiles(path, "*", SearchOption.AllDirectories))
                {
                    SetFileAttributes(file, FILE_ATTRIBUTE_NORMAL);
                    DeleteFile(file);
                }
            }
            catch { }

            try
            {
                foreach (string dir in Directory.GetDirectories(path, "*", SearchOption.AllDirectories))
                {
                    RemoveDirectory(dir);
                }
            }
            catch { }

            RemoveDirectory(path);
        }
    }

    // ═══════════════════════════════ COLOR PALETTE & DESIGN SYSTEM ══════════════════════════════
    static class C
    {
        public static readonly Color Bg          = Color.FromArgb(10, 11, 18);
        public static readonly Color Sidebar     = Color.FromArgb(16, 17, 28);
        public static readonly Color Card        = Color.FromArgb(23, 25, 42);
        public static readonly Color CardHov     = Color.FromArgb(31, 33, 56);
        public static readonly Color CardSel     = Color.FromArgb(28, 32, 68);
        public static readonly Color Accent      = Color.FromArgb(99, 102, 241);      // Indigo Accent
        public static readonly Color AccentLight = Color.FromArgb(129, 140, 248);
        public static readonly Color AccentLo    = Color.FromArgb(55, 58, 140);
        public static readonly Color Green       = Color.FromArgb(16, 185, 129);      // Emerald Green
        public static readonly Color GreenBg     = Color.FromArgb(25, 16, 185, 129);
        public static readonly Color Red         = Color.FromArgb(239, 68, 68);
        public static readonly Color Amber       = Color.FromArgb(245, 158, 11);
        public static readonly Color AmberBg     = Color.FromArgb(25, 245, 158, 11);
        public static readonly Color Blue        = Color.FromArgb(59, 130, 246);
        public static readonly Color Text        = Color.FromArgb(243, 244, 246);
        public static readonly Color TextDim     = Color.FromArgb(156, 163, 175);
        public static readonly Color TextDark    = Color.FromArgb(75, 85, 99);
        public static readonly Color Border      = Color.FromArgb(31, 41, 55);
        public static readonly Color BorderLight = Color.FromArgb(55, 65, 81);
    }

    static class F
    {
        public static readonly Font LargeTitle = new Font("Segoe UI", 15, FontStyle.Bold);
        public static readonly Font Title      = new Font("Segoe UI Semibold", 10.5f, FontStyle.Bold);
        public static readonly Font Subtitle   = new Font("Segoe UI", 8.5f, FontStyle.Regular);
        public static readonly Font Code       = new Font("Consolas", 8.5f, FontStyle.Regular);
        public static readonly Font TabText    = new Font("Segoe UI Semibold", 9.5f, FontStyle.Bold);
        public static readonly Font ButtonText = new Font("Segoe UI Semibold", 10, FontStyle.Bold);
        public static readonly Font LabelText  = new Font("Segoe UI", 8.5f, FontStyle.Regular);
        public static readonly Font MutedText  = new Font("Segoe UI", 7.5f, FontStyle.Regular);
    }

    // ═══════════════════════════════ GRAPHICS DRAWING HELPERS ═══════════════════════════════
    static class Gfx
    {
        public static GraphicsPath RoundRect(Rectangle r, int rad)
        {
            var path = new GraphicsPath();
            int d = rad * 2;
            path.AddArc(r.X, r.Y, d, d, 180, 90);
            path.AddArc(r.Right - d, r.Y, d, d, 270, 90);
            path.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90);
            path.AddArc(r.X, r.Bottom - d, d, d, 90, 90);
            path.CloseFigure();
            return path;
        }

        public static void FillRoundRect(Graphics g, Rectangle r, int rad, Color color)
        {
            using (var path = RoundRect(r, rad))
            using (var brush = new SolidBrush(color))
                g.FillPath(brush, path);
        }

        public static void DrawRoundRect(Graphics g, Rectangle r, int rad, Color color, float width)
        {
            using (var path = RoundRect(r, rad))
            using (var pen = new Pen(color, width))
                g.DrawPath(pen, path);
        }

        public static void FillGradientRoundRect(Graphics g, Rectangle r, int rad, Color c1, Color c2, float angle)
        {
            using (var path = RoundRect(r, rad))
            using (var brush = new LinearGradientBrush(r, c1, c2, angle))
                g.FillPath(brush, path);
        }
    }

    // ═══════════════════════════════ DISCORD CLIENT MODEL ═══════════════════════════════
    class DiscordClient
    {
        public string Name          { get; set; }
        public string RootPath      { get; set; }
        public string AppPath       { get; set; }
        public string ResourcesPath { get; set; }
        public string ExeName       { get; set; }

        public bool IsInjected()
        {
            try
            {
                if (!Directory.Exists(RootPath)) return false;
                var appDirs = Directory.GetDirectories(RootPath, "app-*");
                foreach (var appVerDir in appDirs)
                {
                    string res = Path.Combine(appVerDir, "resources");
                    string appDir = Path.Combine(res, "app");
                    string asarDir = Path.Combine(res, "app.asar");

                    if (Directory.Exists(appDir))
                    {
                        string indexJs = Path.Combine(appDir, "index.js");
                        if (File.Exists(indexJs) && File.ReadAllText(indexJs).Contains("patcher.js"))
                            return true;
                    }

                    if (Directory.Exists(asarDir))
                    {
                        string indexJs = Path.Combine(asarDir, "index.js");
                        if (File.Exists(indexJs) && File.ReadAllText(indexJs).Contains("patcher.js"))
                            return true;
                    }
                }
            }
            catch { }
            return false;
        }

        public bool IsRunning()
        {
            string n = Path.GetFileName(ExeName ?? "Discord.exe");
            foreach (var p in Process.GetProcesses())
            {
                try
                {
                    if (string.Equals(p.ProcessName + ".exe", n, StringComparison.OrdinalIgnoreCase)) return true;
                }
                catch { }
            }
            return false;
        }

        public void Kill()
        {
            try
            {
                string exe = ExeName ?? "Discord.exe";
                Win32Kernel.ForceKillProcessByName(exe);
                var psi = new ProcessStartInfo("cmd.exe", "/c taskkill /f /im \"" + exe + "\" /t")
                {
                    CreateNoWindow = true,
                    UseShellExecute = false
                };
                var p = Process.Start(psi);
                if (p != null) p.WaitForExit(3000);
            }
            catch { }

            try
            {
                string rootLower = RootPath.ToLower();
                foreach (var proc in Process.GetProcesses())
                {
                    try
                    {
                        string mainModule = proc.MainModule != null ? proc.MainModule.FileName : null;
                        if (!string.IsNullOrEmpty(mainModule) && mainModule.ToLower().StartsWith(rootLower))
                        {
                            proc.Kill();
                        }
                    }
                    catch { }
                }
            }
            catch { }
        }

        public void Launch()
        {
            try
            {
                string exe = Path.Combine(AppPath, ExeName ?? "Discord.exe");
                if (!File.Exists(exe)) exe = Path.Combine(RootPath, ExeName ?? "Discord.exe");
                if (File.Exists(exe)) Process.Start(exe);
            }
            catch { }
        }

        public string Version
        {
            get { return Path.GetFileName(AppPath); }
        }
    }

    // ═══════════════════════════════ MAIN WINDOW ═══════════════════════════════
    class MainForm : Form
    {
        [DllImport("Gdi32.dll", EntryPoint = "CreateRoundRectRgn")]
        private static extern IntPtr CreateRoundRectRgn(int nLeft, int nTop, int nRight, int nBottom, int nWidthEllipse, int nHeightEllipse);

        [DllImport("gdi32.dll", EntryPoint = "DeleteObject")]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool DeleteObject(IntPtr hObject);

        static readonly string DistPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "Endcord", "dist");

        List<DiscordClient> clients = new List<DiscordClient>();
        List<ClientCard>    cards   = new List<ClientCard>();

        // Controls
        Panel sidebarPanel, mainContent, titleBar, statusBar;
        FlowLayoutPanel clientFlow;
        RichTextBox logBox;
        CustomProgress progress;
        CustomCheckBox chkAll, chkRestart;
        CustomLink btnRefresh, btnAddPath;
        Label lblStatus;
        CustomActionButton btnAction;
        SidebarTab[] sidebarTabs = new SidebarTab[4];

        static readonly Image LogoImg = GetEmbeddedLogo();

        private static Image GetEmbeddedLogo()
        {
            try
            {
                var assembly = Assembly.GetExecutingAssembly();
                foreach (var name in assembly.GetManifestResourceNames())
                {
                    if (name.EndsWith("app_logo.png", StringComparison.OrdinalIgnoreCase) ||
                        name.EndsWith("logo.png", StringComparison.OrdinalIgnoreCase))
                    {
                        using (var stream = assembly.GetManifestResourceStream(name))
                        {
                            if (stream != null) return Image.FromStream(stream);
                        }
                    }
                }
            }
            catch { }

            try
            {
                string localPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "app_logo.png");
                if (File.Exists(localPath)) return Image.FromFile(localPath);
            }
            catch { }

            try
            {
                Bitmap bmp = new Bitmap(28, 28);
                using (Graphics g = Graphics.FromImage(bmp))
                {
                    g.SmoothingMode = SmoothingMode.AntiAlias;
                    using (Brush b = new LinearGradientBrush(new Rectangle(0, 0, 28, 28), Color.FromArgb(88, 101, 242), Color.FromArgb(114, 137, 218), 45f))
                    {
                        g.FillEllipse(b, 0, 0, 28, 28);
                    }
                    using (Font font = new Font("Segoe UI", 12, FontStyle.Bold))
                    {
                        TextRenderer.DrawText(g, "E", font, new Rectangle(0, 0, 28, 28), Color.White, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
                    }
                }
                return bmp;
            }
            catch { }

            return null;
        }

        int activeTab = 0; // 0=Install, 1=Uninstall, 2=Repair, 3=Kill Discord

        public MainForm()
        {
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint | ControlStyles.DoubleBuffer, true);
            try
            {
                this.Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
            }
            catch { }
            SuspendLayout();
            BuildUI();
            ResumeLayout(false);
            RefreshClients();
        }

        protected override void OnResize(EventArgs e)
        {
            base.OnResize(e);
            IntPtr ptr = CreateRoundRectRgn(0, 0, Width, Height, 20, 20);
            Region = System.Drawing.Region.FromHrgn(ptr);
            DeleteObject(ptr);
        }

        void BuildUI()
        {
            Text            = "Endcord Installer";
            ClientSize      = new Size(820, 580);
            MinimumSize     = new Size(820, 580);
            BackColor       = C.Bg;
            ForeColor       = C.Text;
            FormBorderStyle = FormBorderStyle.None;
            StartPosition   = FormStartPosition.CenterScreen;

            // ── TITLE BAR ──────────────────────────────────────────
            titleBar = new DBPanel();
            titleBar.Dock = DockStyle.Top;
            titleBar.Height = 44;
            titleBar.BackColor = C.Sidebar;
            titleBar.Paint += (s, e) =>
            {
                var g = e.Graphics;
                g.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;
                int textX = 16;
                if (LogoImg != null)
                {
                    g.DrawImage(LogoImg, new Rectangle(14, 8, 28, 28));
                    textX = 50;
                }
                TextRenderer.DrawText(g, "Endcord Installer", F.Title,
                    new Rectangle(textX, 0, 260, 44), C.Text,
                    TextFormatFlags.VerticalCenter | TextFormatFlags.Left);
            };

            var bClose = WinBtn("r", C.Red, DockStyle.Right);
            var bMin   = WinBtn("0", C.TextDim, DockStyle.Right);
            bClose.Click += (s, e) => Application.Exit();
            bMin.Click   += (s, e) => WindowState = FormWindowState.Minimized;
            titleBar.Controls.Add(bClose);
            titleBar.Controls.Add(bMin);

            // Drag window events
            bool drag = false; Point dp = Point.Empty;
            titleBar.MouseDown += (s, e) => { if (e.Button == MouseButtons.Left) { drag = true; dp = e.Location; } };
            titleBar.MouseMove += (s, e) => { if (drag) Location = new Point(Location.X + e.X - dp.X, Location.Y + e.Y - dp.Y); };
            titleBar.MouseUp   += (s, e) => drag = false;

            // ── SIDEBAR PANEL ───────────────────────────────────────
            sidebarPanel = new DBPanel();
            sidebarPanel.Dock = DockStyle.Left;
            sidebarPanel.Width = 210;
            sidebarPanel.BackColor = C.Sidebar;

            string[] tabTitles = { "Install Endcord", "Uninstall", "Repair Install", "Close Discord" };
            string[] tabDesc   = { "Inject client mod", "Restore vanilla", "Fix system files", "Force exit clients" };

            for (int i = 0; i < 4; i++)
            {
                int idx = i;
                var tab = new SidebarTab(tabTitles[i], tabDesc[i], idx == 0);
                tab.Top = 16 + i * 58;
                tab.Left = 10;
                tab.Width = 190;
                tab.Click += (s, e) => SwitchTab(idx);
                sidebarTabs[i] = tab;
                sidebarPanel.Controls.Add(tab);
            }

            // ── STATUS BAR ──────────────────────────────────────────
            statusBar = new DBPanel();
            statusBar.Dock = DockStyle.Bottom;
            statusBar.Height = 36;
            statusBar.BackColor = C.Sidebar;

            lblStatus = new Label();
            lblStatus.Font = F.Subtitle;
            lblStatus.ForeColor = C.TextDim;
            lblStatus.Location = new Point(16, 9);
            lblStatus.AutoSize = true;
            lblStatus.Text = "Ready";
            statusBar.Controls.Add(lblStatus);

            progress = new CustomProgress();
            progress.Dock = DockStyle.Right;
            progress.Width = 220;
            progress.Visible = false;
            statusBar.Controls.Add(progress);

            // ── MAIN CONTENT AREA ────────────────────────────────────
            mainContent = new DBPanel();
            mainContent.Dock = DockStyle.Fill;
            mainContent.Padding = new Padding(20, 16, 20, 16);

            // Header bar
            var headPanel = new DBPanel();
            headPanel.Dock = DockStyle.Top;
            headPanel.Height = 32;

            var lblDetected = new Label();
            lblDetected.Text = "DETECTED DISCORD INSTALLATIONS";
            lblDetected.Font = F.MutedText;
            lblDetected.ForeColor = C.TextDark;
            lblDetected.Location = new Point(0, 8);
            lblDetected.AutoSize = true;
            headPanel.Controls.Add(lblDetected);

            btnRefresh = new CustomLink("Refresh");
            btnRefresh.Dock = DockStyle.Right;
            btnRefresh.Width = 65;
            btnRefresh.Click += (s, e) => RefreshClients();
            headPanel.Controls.Add(btnRefresh);

            btnAddPath = new CustomLink("+ Custom Path");
            btnAddPath.Dock = DockStyle.Right;
            btnAddPath.Width = 100;
            btnAddPath.Click += BtnAddPath_Click;
            headPanel.Controls.Add(btnAddPath);

            mainContent.Controls.Add(headPanel);

            // Client Cards Flow
            clientFlow = new FlowLayoutPanel();
            clientFlow.Dock = DockStyle.Top;
            clientFlow.Height = 220;
            clientFlow.AutoScroll = true;
            clientFlow.WrapContents = false;
            clientFlow.FlowDirection = FlowDirection.TopDown;
            clientFlow.Padding = new Padding(0, 4, 0, 4);
            mainContent.Controls.Add(clientFlow);

            // Options Bar
            var optsPanel = new DBPanel();
            optsPanel.Dock = DockStyle.Top;
            optsPanel.Height = 32;

            chkAll = new CustomCheckBox("Select All");
            chkAll.Location = new Point(0, 4);
            chkAll.Width = 100;
            chkAll.CheckedChanged += (s, e) =>
            {
                foreach (var c in cards) c.Selected = chkAll.Checked;
            };
            optsPanel.Controls.Add(chkAll);

            chkRestart = new CustomCheckBox("Relaunch Discord after action");
            chkRestart.Location = new Point(120, 4);
            chkRestart.Width = 230;
            chkRestart.Checked = true;
            optsPanel.Controls.Add(chkRestart);

            mainContent.Controls.Add(optsPanel);

            // Console Log Box
            logBox = new RichTextBox();
            logBox.Dock = DockStyle.Fill;
            logBox.BackColor = C.Sidebar;
            logBox.ForeColor = C.TextDim;
            logBox.BorderStyle = BorderStyle.None;
            logBox.Font = F.Code;
            logBox.ReadOnly = true;
            logBox.Margin = new Padding(0, 8, 0, 8);
            mainContent.Controls.Add(logBox);

            // Bottom Action Bar
            var actPanel = new DBPanel();
            actPanel.Dock = DockStyle.Bottom;
            actPanel.Height = 52;

            btnAction = new CustomActionButton("INSTALL ENDCORD");
            btnAction.Dock = DockStyle.Right;
            btnAction.Width = 220;
            btnAction.Click += (s, e) =>
            {
                if (activeTab == 3) DoKill();
                else DoOperation();
            };
            actPanel.Controls.Add(btnAction);

            mainContent.Controls.Add(actPanel);

            // Assemble Form
            Controls.Add(mainContent);
            Controls.Add(sidebarPanel);
            Controls.Add(statusBar);
            Controls.Add(titleBar);
        }

        Control WinBtn(string sym, Color hovCol, DockStyle dock)
        {
            var b = new Label();
            b.Text = sym == "r" ? "✕" : "—";
            b.Font = new Font("Segoe UI", 9, FontStyle.Bold);
            b.ForeColor = C.TextDim;
            b.TextAlign = ContentAlignment.MiddleCenter;
            b.Size = new Size(44, 44);
            b.Dock = dock;
            b.Cursor = Cursors.Hand;
            b.MouseEnter += (s, e) => { b.BackColor = hovCol; b.ForeColor = Color.White; };
            b.MouseLeave += (s, e) => { b.BackColor = Color.Transparent; b.ForeColor = C.TextDim; };
            return b;
        }

        void SwitchTab(int idx)
        {
            activeTab = idx;
            for (int i = 0; i < 4; i++) sidebarTabs[i].SetActive(i == idx);

            chkAll.Checked = true;
            foreach (var c in cards) c.Selected = true;

            string[] actionTexts = { "INSTALL ENDCORD", "UNINSTALL ENDCORD", "REPAIR INSTALLATION", "CLOSE ALL DISCORD" };
            btnAction.Text = actionTexts[activeTab];
            SetStatus("Selected Mode: " + tabTitlesText[activeTab]);
        }

        static readonly string[] tabTitlesText = { "Install", "Uninstall", "Repair", "Kill Discord" };

        // ── DETECT DISCORD INSTALLATIONS ────────────────────────────
        void RefreshClients()
        {
            clients.Clear(); cards.Clear(); clientFlow.Controls.Clear();

            string local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            string[,] paths = {
                { "Discord Stable",Path.Combine(local, "Discord"),            "Discord.exe" },
                { "Discord Canary",Path.Combine(local, "DiscordCanary"),     "DiscordCanary.exe" },
                { "Discord PTB",   Path.Combine(local, "DiscordPTB"),        "DiscordPTB.exe" },
                { "Discord Dev",   Path.Combine(local, "DiscordDevelopment"),"DiscordDevelopment.exe" }
            };

            var allDetected = new List<DiscordClient>();
            for (int i = 0; i < 4; i++)
            {
                var c = GetClient(paths[i, 0], paths[i, 1], paths[i, 2]);
                if (c != null) allDetected.Add(c);
            }

            foreach (var c in allDetected)
            {
                clients.Add(c);
                var card = new ClientCard(c);
                card.Width = 560;
                card.Selected = true;
                cards.Add(card);
                clientFlow.Controls.Add(card);
            }
            chkAll.Checked = true;

            if (clients.Count == 0)
            {
                Log("No Discord installations detected on this machine.", C.Amber);
                SetStatus("No Discord installations found");
            }
            else
            {
                Log("Detected " + clients.Count + " Discord client installation(s).", C.Green);
                SetStatus("Ready");
            }
        }

        DiscordClient GetClient(string name, string root, string exe)
        {
            if (!Directory.Exists(root)) return null;
            var dirs = Directory.GetDirectories(root, "app-*");
            if (dirs.Length == 0) return null;

            Array.Sort(dirs, (a, b) =>
            {
                string vaStr = Path.GetFileName(a).Replace("app-", "");
                string vbStr = Path.GetFileName(b).Replace("app-", "");
                Version va, vb;
                if (Version.TryParse(vaStr, out va) && Version.TryParse(vbStr, out vb))
                    return va.CompareTo(vb);
                return string.Compare(a, b, StringComparison.OrdinalIgnoreCase);
            });

            string latest = dirs[dirs.Length - 1];
            string res = Path.Combine(latest, "resources");
            if (!Directory.Exists(res)) return null;

            return new DiscordClient
            {
                Name = name, RootPath = root,
                AppPath = latest, ResourcesPath = res, ExeName = exe
            };
        }

        bool TryAddClient(string name, string root, string exe)
        {
            var c = GetClient(name, root, exe);
            if (c == null) return false;
            clients.Add(c);
            var card = new ClientCard(c);
            card.Width = 560;
            card.Selected = true;
            cards.Add(card);
            clientFlow.Controls.Add(card);
            return true;
        }

        void BtnAddPath_Click(object sender, EventArgs e)
        {
            using (var dlg = new PathDialog())
            {
                if (dlg.ShowDialog() != DialogResult.OK) return;
                string p = dlg.SelectedPath.Trim();
                if (!Directory.Exists(p)) { Log("Directory does not exist: " + p, C.Red); return; }
                bool ok = TryAddClient("Custom Path", p, "Discord.exe");
                if (!ok)
                {
                    var parent = Directory.GetParent(p);
                    if (parent != null) ok = TryAddClient("Custom Path", parent.FullName, "Discord.exe");
                }
                if (ok) Log("Added custom path: " + p, C.Green);
                else Log("Failed to find valid Discord in: " + p, C.Red);
            }
        }

        // ── ACTION LOGIC ───────────────────────────────────────────
        void DoKill()
        {
            SetBusy(true);
            new Thread(() =>
            {
                SafeLog("Stopping all running Discord instances...", C.TextDim);
                KillAllDiscordInstances();
                SafeLog("All Discord instances closed successfully.", C.Green);
                Invoke(new Action(() => { SetBusy(false); SetStatus("Discord terminated"); }));
            }) { IsBackground = true }.Start();
        }

        void DoOperation()
        {
            var targets = new List<DiscordClient>();
            for (int i = 0; i < cards.Count; i++)
                if (cards[i].Selected) targets.Add(clients[i]);

            if (targets.Count == 0) { Log("Please select at least one Discord version.", C.Amber); return; }

            SetBusy(true);
            progress.Value = 0; progress.Visible = true;

            new Thread(() =>
            {
                try
                {
                    SafeLog("Closing selected target Discord instances...", C.TextDim);
                    KillTargetDiscordClients(targets);
                    Thread.Sleep(1200);

                    if (activeTab == 0 || activeTab == 2)
                        DoInstall(targets, activeTab == 2);
                    else
                        DoUninstall(targets);

                    Thread.Sleep(1000);
                    if (chkRestart.Checked)
                    {
                        foreach (var c in targets)
                        {
                            SafeLog("Relaunching " + c.Name + "...", C.Blue);
                            c.Launch();
                        }
                    }
                    SafeLog("Operation finished successfully.", C.Green);
                }
                catch (Exception ex) { SafeLog("Error occurred: " + ex.Message, C.Red); }
                finally
                {
                    Invoke(new Action(() =>
                    {
                        progress.Visible = false;
                        SetBusy(false);
                        RefreshClients();
                    }));
                }
            }) { IsBackground = true }.Start();
        }

        static void SafeDeleteDir(string path)
        {
            if (!Directory.Exists(path)) return;
            Win32Kernel.DirectWin32DeleteDir(path);
        }

        static void SafeDeleteFile(string path)
        {
            if (!File.Exists(path)) return;
            Win32Kernel.SetFileAttributes(path, Win32Kernel.FILE_ATTRIBUTE_NORMAL);
            Win32Kernel.DeleteFile(path);
        }

        // ─── INJECTION HELPERS ───────────────────────────────────────────────────

        // Returns the path to discord_desktop_core index.js if found in modules folder
        static string FindDesktopCoreIndex(string appVerDir)
        {
            string modulesDir = Path.Combine(appVerDir, "modules");
            if (!Directory.Exists(modulesDir)) return null;

            foreach (string dir in Directory.GetDirectories(modulesDir, "discord_desktop_core-*"))
            {
                // e.g. modules/discord_desktop_core-1/discord_desktop_core/index.js
                string inner = Path.Combine(dir, "discord_desktop_core", "index.js");
                if (File.Exists(inner)) return inner;
            }
            return null;
        }

        // Injects our patcher require into index.js (prepend, idempotent)
        static void InjectDesktopCore(string indexJs)
        {
            string patcherLine = "require(require('path').join(process.env.APPDATA, 'Endcord', 'dist', 'patcher.js'));";

            string existing = File.Exists(indexJs) ? File.ReadAllText(indexJs) : "";

            // Make a backup of original if none exists
            string bakPath = indexJs + ".bak";
            if (!File.Exists(bakPath))
                File.WriteAllText(bakPath, existing);

            // Already patched? Skip.
            if (existing.Contains("Endcord"))
                return;

            // Prepend our require line
            File.WriteAllText(indexJs, patcherLine + "\n" + existing);
        }

        // Restores original index.js from .bak, or removes our patcher line
        static void RestoreDesktopCore(string indexJs)
        {
            string bakPath = indexJs + ".bak";
            if (File.Exists(bakPath))
            {
                File.Copy(bakPath, indexJs, overwrite: true);
                File.Delete(bakPath);
            }
            else if (File.Exists(indexJs))
            {
                // Strip our patcher line manually
                string content = File.ReadAllText(indexJs);
                string[] lines = content.Split('\n');
                var filtered = new System.Collections.Generic.List<string>();
                foreach (var line in lines)
                    if (!line.Contains("Endcord") && !line.Contains("patcher.js"))
                        filtered.Add(line);
                File.WriteAllText(indexJs, string.Join("\n", filtered));
            }
        }

        static void SafeBackupAsar(string origAsar, string backupAsar)
        {
            if (!File.Exists(origAsar)) return;
            if (File.Exists(backupAsar) && new FileInfo(backupAsar).Length > 100000) return;
            Win32Kernel.CopyFile(origAsar, backupAsar, false);
        }

        static void SafeRestoreAsar(string resDir)
        {
            string appDir     = Path.Combine(resDir, "app");
            string origAsar   = Path.Combine(resDir, "app.asar");
            string backupAsar = Path.Combine(resDir, "_app.asar");

            if (Directory.Exists(origAsar))
            {
                string trapped = Path.Combine(origAsar, "_app.asar");
                if (File.Exists(trapped) && new FileInfo(trapped).Length > 100000)
                {
                    SafeDeleteFile(backupAsar);
                    try { File.Move(trapped, backupAsar); } catch { }
                }
                SafeDeleteDir(origAsar);
            }

            if (Directory.Exists(appDir))
            {
                string idxFile = Path.Combine(appDir, "index.js");
                if (File.Exists(idxFile)) SafeDeleteFile(idxFile);
                SafeDeleteDir(appDir);
            }

            if (File.Exists(backupAsar))
            {
                SafeDeleteFile(origAsar);
                Win32Kernel.CopyFile(backupAsar, origAsar, false);
                if (File.Exists(origAsar) && new FileInfo(origAsar).Length > 100000)
                    SafeDeleteFile(backupAsar);
            }
        }

        void DoInstall(List<DiscordClient> targets, bool repair)
        {
            SafeLog(repair ? "Starting Endcord repair..." : "Starting Endcord installation...", C.AccentLight);
            SetProg(5);

            // ── Step 1: Extract dist files ────────────────────────────────────────
            try
            {
                Directory.CreateDirectory(DistPath);
                string[] files = { "patcher.js","patcher.js.map","preload.js","preload.js.map",
                                   "renderer.js","renderer.js.map","renderer.css","renderer.css.map" };
                SafeLog("Extracting Endcord system files...", C.TextDim);
                for (int i = 0; i < files.Length; i++)
                {
                    string dest = Path.Combine(DistPath, files[i]);
                    SafeDeleteFile(dest);
                    ExtractRes(files[i], dest);
                    SetProg(5 + 40 * (i + 1) / files.Length);
                }
            }
            catch (Exception ex) { SafeLog("Extraction failed: " + ex.Message, C.Red); return; }

            SafeLog("Injecting patcher into Discord clients...", C.TextDim);
            SetProg(48);

            // ── Step 2: Inject into each Discord version ──────────────────────────
            for (int i = 0; i < targets.Count; i++)
            {
                var c = targets[i];
                try
                {
                    c.Kill();
                    Thread.Sleep(600);

                    var appDirs = Directory.GetDirectories(c.RootPath, "app-*");
                    if (appDirs.Length == 0)
                        SafeLog("No app-* version folders found for " + c.Name, C.Red);

                    bool patchedAny = false;
                    foreach (var appVerDir in appDirs)
                    {
                        // ── PRIMARY: discord_desktop_core injection (modern Discord) ──
                        string coreIndex = FindDesktopCoreIndex(appVerDir);
                        if (coreIndex != null)
                        {
                            SafeLog("  [core] " + coreIndex, C.TextDim);
                            InjectDesktopCore(coreIndex);
                            patchedAny = true;
                            continue;
                        }

                        // ── FALLBACK: legacy resources/app/index.js injection ────────
                        string res = Path.Combine(appVerDir, "resources");
                        if (!Directory.Exists(res)) continue;

                        string appDir     = Path.Combine(res, "app");
                        string origAsar   = Path.Combine(res, "app.asar");
                        string backupAsar = Path.Combine(res, "_app.asar");

                        if (Directory.Exists(origAsar)) SafeRestoreAsar(res);
                        SafeBackupAsar(origAsar, backupAsar);

                        if (Directory.Exists(appDir)) SafeDeleteDir(appDir);
                        Directory.CreateDirectory(appDir);

                        File.WriteAllText(Path.Combine(appDir, "package.json"),
                            "{\n  \"name\": \"discord\",\n  \"main\": \"index.js\"\n}");

                        File.WriteAllText(Path.Combine(appDir, "index.js"),
                            "require(require('path').join(process.env.APPDATA, 'Endcord', 'dist', 'patcher.js'));\n");

                        SafeLog("  [legacy] " + appDir, C.TextDim);
                        patchedAny = true;
                    }

                    if (patchedAny)
                        SafeLog("Successfully patched " + c.Name + " (" + c.Version + ")", C.Green);
                    else
                        SafeLog("No patchable paths found for " + c.Name, C.Red);
                }
                catch (Exception ex) { SafeLog("Failed patching " + c.Name + ": " + ex.Message, C.Red); }
                SetProg(48 + 52 * (i + 1) / targets.Count);
            }
            SafeLog("Operations complete.", C.AccentLight);
            SetProg(100);
        }

        void DoUninstall(List<DiscordClient> targets)
        {
            SafeLog("Removing Endcord from selected installations...", C.AccentLight);
            for (int i = 0; i < targets.Count; i++)
            {
                var c = targets[i];
                try
                {
                    ForceKillClient(c);
                    Thread.Sleep(600);

                    var appDirs = Directory.GetDirectories(c.RootPath, "app-*");
                    foreach (var appVerDir in appDirs)
                    {
                        // ── PRIMARY: restore discord_desktop_core ──────────────────
                        string coreIndex = FindDesktopCoreIndex(appVerDir);
                        if (coreIndex != null)
                        {
                            RestoreDesktopCore(coreIndex);
                            continue;
                        }

                        // ── FALLBACK: restore legacy resources/app ─────────────────
                        string res = Path.Combine(appVerDir, "resources");
                        if (!Directory.Exists(res)) continue;
                        SafeRestoreAsar(res);
                    }
                    SafeLog("Successfully uninstalled from " + c.Name, C.Green);
                }
                catch (Exception ex) { SafeLog("Failed to restore " + c.Name + ": " + ex.Message, C.Red); }
                SetProg(100 * (i + 1) / targets.Count);
            }

            try
            {
                if (Directory.Exists(DistPath)) SafeDeleteDir(DistPath);
            }
            catch { }

            SafeLog("Uninstall complete.", C.AccentLight);
        }

        static void ForceKillClient(DiscordClient c)
        {
            if (c == null) return;
            try
            {
                string exeName = Path.GetFileName(c.ExeName ?? "Discord.exe");
                Win32Kernel.ForceKillProcessByName(exeName);
            }
            catch { }
        }

        static void KillTargetDiscordClients(List<DiscordClient> targets)
        {
            foreach (var c in targets)
            {
                try { ForceKillClient(c); } catch { }
            }
        }

        static void KillAllDiscordInstances()
        {
            string[] exes = { "Discord.exe", "DiscordCanary.exe", "DiscordPTB.exe", "DiscordDevelopment.exe", "Update.exe" };
            foreach (var exe in exes)
            {
                try
                {
                    Win32Kernel.ForceKillProcessByName(exe);
                }
                catch { }
            }
        }

        static void ExtractRes(string name, string dest)
        {
            var asm = Assembly.GetExecutingAssembly();
            string match = null;
            foreach (var n in asm.GetManifestResourceNames())
                if (n.EndsWith(name, StringComparison.OrdinalIgnoreCase)) { match = n; break; }
            if (match == null) throw new Exception("Embedded asset not found: " + name);
            using (var s = asm.GetManifestResourceStream(match))
            using (var f = new FileStream(dest, FileMode.Create))
                s.CopyTo(f);
        }

        // ── HELPERS ────────────────────────────────────────────────
        void Log(string msg, Color col)
        {
            logBox.SelectionStart = logBox.TextLength;
            logBox.SelectionColor = col;
            logBox.AppendText(DateTime.Now.ToString("[HH:mm:ss]  ") + msg + "\n");
            logBox.ScrollToCaret();
        }
        void SafeLog(string m, Color c)
        { if (InvokeRequired) Invoke(new Action(() => Log(m, c))); else Log(m, c); }
        void SetProg(int v)
        { if (InvokeRequired) Invoke(new Action(() => progress.Value = v)); else progress.Value = v; }
        void SetStatus(string s)
        { if (InvokeRequired) Invoke(new Action(() => lblStatus.Text = s)); else lblStatus.Text = s; }
        void SetBusy(bool b)
        {
            btnAction.Enabled = !b;
            btnRefresh.Enabled = !b;
            btnAddPath.Enabled = !b;
            chkAll.Enabled = !b;
        }
    }

    // ═══════════════════════════════ CUSTOM CONTROLS & RENDERING ═══════════════════════════════
    class DBPanel : Panel
    {
        public DBPanel()
        {
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint | ControlStyles.DoubleBuffer | ControlStyles.OptimizedDoubleBuffer, true);
        }
    }

    class SidebarTab : Control
    {
        bool _active = false;
        bool _hov = false;
        string _title, _desc;

        public SidebarTab(string title, string desc, bool active)
        {
            _title = title; _desc = desc; _active = active;
            Height = 50; Cursor = Cursors.Hand; DoubleBuffered = true;
            MouseEnter += (s, e) => { _hov = true; Invalidate(); };
            MouseLeave += (s, e) => { _hov = false; Invalidate(); };
        }

        public void SetActive(bool a) { _active = a; Invalidate(); }

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;

            var r = new Rectangle(0, 0, Width - 1, Height - 1);
            if (_active)
            {
                Gfx.FillRoundRect(g, r, 6, C.CardSel);
                Gfx.DrawRoundRect(g, r, 6, C.Accent, 1.25f);
            }
            else if (_hov)
            {
                Gfx.FillRoundRect(g, r, 6, C.CardHov);
            }

            TextRenderer.DrawText(g, _title, F.TabText, new Rectangle(14, 8, Width - 20, 20),
                _active ? C.Text : (_hov ? C.Text : C.TextDim), TextFormatFlags.Left);

            TextRenderer.DrawText(g, _desc, F.MutedText, new Rectangle(14, 28, Width - 20, 16),
                _active ? C.AccentLight : C.TextDark, TextFormatFlags.Left);
        }
    }

    class ClientCard : Control
    {
        DiscordClient dc;
        bool _sel = false;
        bool _hov = false;

        public bool Selected
        {
            get { return _sel; }
            set { _sel = value; Invalidate(); }
        }

        public ClientCard(DiscordClient client)
        {
            dc = client;
            Height = 72; Margin = new Padding(0, 0, 0, 8);
            Cursor = Cursors.Hand; DoubleBuffered = true;
            MouseEnter += (s, e) => { _hov = true; Invalidate(); };
            MouseLeave += (s, e) => { _hov = false; Invalidate(); };
            Click += (s, e) => { Selected = !_sel; };
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;

            var r = new Rectangle(0, 0, Width - 1, Height - 1);

            Color bg = _sel ? C.CardSel : (_hov ? C.CardHov : C.Card);
            Gfx.FillRoundRect(g, r, 8, bg);

            if (_sel)
                Gfx.DrawRoundRect(g, r, 8, Color.FromArgb(140, C.Accent), 1.25f);
            else if (_hov)
                Gfx.DrawRoundRect(g, r, 8, Color.FromArgb(60, C.Accent), 1f);
            else
                Gfx.DrawRoundRect(g, r, 8, C.Border, 1f);

            int cx = 24, cy = Height / 2;
            var chkRect = new Rectangle(cx - 9, cy - 9, 18, 18);
            if (_sel)
            {
                Gfx.FillRoundRect(g, chkRect, 5, C.Accent);
                using (var p = new Pen(Color.White, 2f))
                {
                    g.DrawLine(p, cx - 4, cy, cx - 1, cy + 3);
                    g.DrawLine(p, cx - 1, cy + 3, cx + 4, cy - 3);
                }
            }
            else
            {
                Gfx.DrawRoundRect(g, chkRect, 5, _hov ? C.TextDim : C.TextDark, 1.5f);
            }

            int tx = 52;
            bool running = dc.IsRunning();

            if (running)
            {
                using (var b = new SolidBrush(C.Green))
                    g.FillEllipse(b, tx, (Height - 8) / 2, 8, 8);
                tx += 14;
            }

            TextRenderer.DrawText(g, dc.Name, F.Title,
                new Rectangle(tx, 8, Width - tx - 160, 20),
                C.Text, TextFormatFlags.Left | TextFormatFlags.EndEllipsis);

            string info = dc.Version + (running ? "  ·  Running" : "  ·  Closed");
            TextRenderer.DrawText(g, info, F.Subtitle,
                new Rectangle(tx, 28, Width - 200, 18),
                running ? C.Green : C.TextDim, TextFormatFlags.Left);

            TextRenderer.DrawText(g, dc.ResourcesPath, F.MutedText,
                new Rectangle(tx, 48, Width - 200, 14),
                C.TextDim, TextFormatFlags.Left | TextFormatFlags.EndEllipsis);

            string editionStr = "CUSTOM";
            Color edColor = C.TextDim;
            Color edBgColor = Color.FromArgb(20, C.TextDim);
            if (dc.Name.Contains("Stable")) { editionStr = "STABLE"; edColor = C.Blue; edBgColor = Color.FromArgb(25, C.Blue); }
            else if (dc.Name.Contains("Canary")) { editionStr = "CANARY"; edColor = C.Amber; edBgColor = Color.FromArgb(25, C.Amber); }
            else if (dc.Name.Contains("PTB")) { editionStr = "PTB"; edColor = C.Accent; edBgColor = Color.FromArgb(25, C.Accent); }
            else if (dc.Name.Contains("Dev")) { editionStr = "DEV"; edColor = C.Red; edBgColor = Color.FromArgb(25, C.Red); }

            var edSize = TextRenderer.MeasureText(editionStr, F.MutedText);
            bool injected = dc.IsInjected();
            string statusStr = injected ? "ENDCORD PATCHED" : "VANILLA";
            Color statusColor = injected ? C.Green : C.Amber;
            Color statusBgColor = injected ? C.GreenBg : C.AmberBg;
            var statusSize = TextRenderer.MeasureText(statusStr, F.MutedText);

            int margin = 16;
            int badgeY = (Height - 22) / 2;

            int statusW = statusSize.Width + 14;
            var statusRect = new Rectangle(Width - statusW - margin, badgeY, statusW, 22);

            int edW = edSize.Width + 14;
            var edRect = new Rectangle(statusRect.Left - edW - 8, badgeY, edW, 22);

            Gfx.FillRoundRect(g, edRect, 5, edBgColor);
            Gfx.DrawRoundRect(g, edRect, 5, Color.FromArgb(70, edColor), 1f);
            TextRenderer.DrawText(g, editionStr, F.MutedText, edRect, edColor,
                TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);

            Gfx.FillRoundRect(g, statusRect, 5, statusBgColor);
            Gfx.DrawRoundRect(g, statusRect, 5, Color.FromArgb(70, statusColor), 1f);
            TextRenderer.DrawText(g, statusStr, F.MutedText, statusRect, statusColor,
                TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
        }
    }

    class CustomCheckBox : Control
    {
        bool _checked = false;
        bool _hov = false;

        public event EventHandler CheckedChanged;

        public bool Checked
        {
            get { return _checked; }
            set { _checked = value; Invalidate(); if (CheckedChanged != null) CheckedChanged(this, EventArgs.Empty); }
        }

        public CustomCheckBox(string text)
        {
            Text = text; Height = 22; Cursor = Cursors.Hand; DoubleBuffered = true;
            MouseEnter += (s, e) => { _hov = true; Invalidate(); };
            MouseLeave += (s, e) => { _hov = false; Invalidate(); };
            Click += (s, e) => Checked = !_checked;
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;

            var chkRect = new Rectangle(0, 3, 16, 16);
            if (_checked)
            {
                Gfx.FillRoundRect(g, chkRect, 4, C.Accent);
                using (var p = new Pen(Color.White, 2f))
                {
                    g.DrawLine(p, 3, 10, 6, 13);
                    g.DrawLine(p, 6, 13, 12, 6);
                }
            }
            else
            {
                Gfx.DrawRoundRect(g, chkRect, 4, _hov ? C.TextDim : C.TextDark, 1.5f);
            }

            TextRenderer.DrawText(g, Text, F.LabelText, new Rectangle(24, 0, Width - 24, Height),
                _hov ? C.Text : C.TextDim, TextFormatFlags.VerticalCenter | TextFormatFlags.Left);
        }
    }

    class CustomLink : Control
    {
        bool _hov = false;
        public CustomLink(string text)
        {
            Text = text; Height = 20; Cursor = Cursors.Hand; DoubleBuffered = true;
            MouseEnter += (s, e) => { _hov = true; Invalidate(); };
            MouseLeave += (s, e) => { _hov = false; Invalidate(); };
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics;
            g.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;
            TextRenderer.DrawText(g, Text, F.Subtitle, new Rectangle(0, 0, Width, Height),
                _hov ? C.AccentLight : C.TextDim, TextFormatFlags.VerticalCenter | TextFormatFlags.Right);
        }
    }

    class CustomProgress : Control
    {
        int _val = 0;
        public int Value
        {
            get { return _val; }
            set { _val = Math.Max(0, Math.Min(100, value)); Invalidate(); }
        }

        public CustomProgress() { Height = 8; DoubleBuffered = true; }

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;

            var r = new Rectangle(0, (Height - 6) / 2, Width, 6);
            Gfx.FillRoundRect(g, r, 3, C.Card);

            if (_val > 0)
            {
                int w = (int)(Width * (_val / 100f));
                if (w > 6)
                {
                    var pr = new Rectangle(0, (Height - 6) / 2, w, 6);
                    Gfx.FillGradientRoundRect(g, pr, 3, C.Accent, C.AccentLight, 0f);
                }
            }
        }
    }

    class CustomActionButton : Control
    {
        bool _hov = false;
        bool _down = false;

        public CustomActionButton(string text)
        {
            Text = text; Height = 42; Cursor = Cursors.Hand; DoubleBuffered = true;
            MouseEnter += (s, e) => { _hov = true; Invalidate(); };
            MouseLeave += (s, e) => { _hov = false; _down = false; Invalidate(); };
            MouseDown  += (s, e) => { _down = true; Invalidate(); };
            MouseUp    += (s, e) => { _down = false; Invalidate(); };
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;

            var r = new Rectangle(0, 0, Width - 1, Height - 1);
            if (!Enabled)
            {
                Gfx.FillRoundRect(g, r, 8, C.Border);
                TextRenderer.DrawText(g, Text, F.ButtonText, r, C.TextDark, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
                return;
            }

            Color c1 = _down ? C.AccentLo : (_hov ? C.AccentLight : C.Accent);
            Color c2 = _down ? C.Accent : (_hov ? C.Accent : C.AccentLo);

            Gfx.FillGradientRoundRect(g, r, 8, c1, c2, 45f);
            TextRenderer.DrawText(g, Text, F.ButtonText, r, Color.White, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
        }
    }

    class PathDialog : Form
    {
        public string SelectedPath { get; private set; }
        TextBox txt;

        public PathDialog()
        {
            Text = "Custom Discord Path";
            Size = new Size(480, 160);
            BackColor = C.Sidebar;
            ForeColor = C.Text;
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false; MinimizeBox = false;
            StartPosition = FormStartPosition.CenterParent;

            var lbl = new Label { Text = "Select or paste path to Discord app folder:", Left = 20, Top = 16, AutoSize = true, Font = F.Subtitle, ForeColor = C.TextDim };
            txt = new TextBox { Left = 20, Top = 42, Width = 424, Font = F.Subtitle, BackColor = C.Bg, ForeColor = C.Text, BorderStyle = BorderStyle.FixedSingle };

            var btnOk = new Button { Text = "Add", Left = 264, Top = 80, Width = 80, Height = 30, DialogResult = DialogResult.OK, BackColor = C.Accent, ForeColor = Color.White, FlatStyle = FlatStyle.Flat };
            var btnCancel = new Button { Text = "Cancel", Left = 364, Top = 80, Width = 80, Height = 30, DialogResult = DialogResult.Cancel, BackColor = C.Card, ForeColor = C.Text, FlatStyle = FlatStyle.Flat };

            btnOk.Click += (s, e) => SelectedPath = txt.Text;

            Controls.Add(lbl); Controls.Add(txt); Controls.Add(btnOk); Controls.Add(btnCancel);
        }
    }
}
