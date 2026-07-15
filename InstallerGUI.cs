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
[assembly: AssemblyDescription("Installer, uninstaller and repair utility for Endcord.")]
[assembly: AssemblyConfiguration("")]
[assembly: AssemblyCompany("Endcord Inc.")]
[assembly: AssemblyProduct("Endcord")]
[assembly: AssemblyCopyright("Copyright © 2026 Endcord")]
[assembly: AssemblyTrademark("")]
[assembly: AssemblyCulture("")]
[assembly: AssemblyVersion("1.0.0.0")]
[assembly: AssemblyFileVersion("1.0.0.0")]

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

    // ═══════════════════════════════ THEME SYSTEM ══════════════════════════════
    static class C
    {
        public static readonly Color Bg          = Color.FromArgb(10, 11, 18);
        public static readonly Color Sidebar     = Color.FromArgb(16, 17, 28);
        public static readonly Color Card        = Color.FromArgb(23, 25, 42);
        public static readonly Color CardHov     = Color.FromArgb(31, 33, 56);
        public static readonly Color CardSel     = Color.FromArgb(28, 32, 68);
        public static readonly Color Accent      = Color.FromArgb(99, 102, 241);      // Indigo Accent
        public static readonly Color AccentLight = Color.FromArgb(129, 140, 248);
        public static readonly Color AccentGlow  = Color.FromArgb(40, 99, 102, 241);
        public static readonly Color AccentLo    = Color.FromArgb(55, 58, 140);
        public static readonly Color Green       = Color.FromArgb(16, 185, 129);      // Emerald Green
        public static readonly Color GreenBg     = Color.FromArgb(15, 16, 185, 129);
        public static readonly Color Red         = Color.FromArgb(239, 68, 68);
        public static readonly Color Amber       = Color.FromArgb(245, 158, 11);
        public static readonly Color AmberBg     = Color.FromArgb(15, 245, 158, 11);
        public static readonly Color Blue        = Color.FromArgb(59, 130, 246);
        public static readonly Color Text        = Color.FromArgb(243, 244, 246);
        public static readonly Color TextDim     = Color.FromArgb(156, 163, 175);
        public static readonly Color TextDark    = Color.FromArgb(75, 85, 99);
        public static readonly Color Border      = Color.FromArgb(31, 41, 55);
        public static readonly Color BorderLight = Color.FromArgb(55, 65, 81);
    }

    static class F
    {
        public static readonly Font LargeTitle = new Font("Segoe UI", 16, FontStyle.Bold);
        public static readonly Font Title      = new Font("Segoe UI Semibold", 11, FontStyle.Bold);
        public static readonly Font Subtitle   = new Font("Segoe UI", 9, FontStyle.Regular);
        public static readonly Font Code       = new Font("Consolas", 8.5f, FontStyle.Regular);
        public static readonly Font TabText    = new Font("Segoe UI Semibold", 9.5f, FontStyle.Bold);
        public static readonly Font ButtonText = new Font("Segoe UI Semibold", 10, FontStyle.Bold);
        public static readonly Font LabelText  = new Font("Segoe UI", 9, FontStyle.Regular);
        public static readonly Font MutedText  = new Font("Segoe UI", 7.5f, FontStyle.Regular);
    }

    // ═══════════════════════════════ DRAWING HELPERS ═══════════════════════════════
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
            return Directory.Exists(Path.Combine(ResourcesPath, "app"))
                && File.Exists(Path.Combine(ResourcesPath, "_app.asar"));
        }

        public bool IsRunning()
        {
            string n = Path.GetFileNameWithoutExtension(ExeName ?? "Discord").ToLower();
            foreach (var p in Process.GetProcesses())
                try { if (p.ProcessName.ToLower() == n) return true; } catch { }
            return false;
        }

        public void Kill()
        {
            string n = Path.GetFileNameWithoutExtension(ExeName ?? "Discord").ToLower();
            var procs = new List<Process>();
            foreach (var p in Process.GetProcesses())
                try { if (p.ProcessName.ToLower() == n) procs.Add(p); } catch { }

            // Graceful shutdown first
            foreach (var p in procs)
                try { p.CloseMainWindow(); } catch { }

            int w = 0;
            while (w < 5000)
            {
                bool done = true;
                foreach (var p in procs)
                    try { if (!p.HasExited) done = false; } catch { }
                if (done) break;
                Thread.Sleep(250); w += 250;
            }

            // Force kill remaining
            foreach (var p in procs)
                try { if (!p.HasExited) { p.Kill(); p.WaitForExit(2000); } } catch { }
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
        Label lblStatus, lblVersion;
        CustomActionButton btnAction;
        SidebarTab[] sidebarTabs = new SidebarTab[4];

        static readonly Image LogoImg = GetEmbeddedLogo();

        private static Image GetEmbeddedLogo()
        {
            try
            {
                var assembly = Assembly.GetExecutingAssembly();
                var names = assembly.GetManifestResourceNames();
                foreach (var name in names)
                {
                    if (name.EndsWith("app_logo.png"))
                    {
                        using (var stream = assembly.GetManifestResourceStream(name))
                        {
                            if (stream != null) return Image.FromStream(stream);
                        }
                    }
                }
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
                    g.DrawImage(LogoImg, new Rectangle(16, 6, 32, 32));
                    textX = 60;
                }
                TextRenderer.DrawText(g, "Endcord", F.Title,
                    new Rectangle(textX, 0, 150, 44), C.Text,
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

            // Sidebar separator line
            sidebarPanel.Paint += (s, e) =>
            {
                using (var p = new Pen(C.Border))
                    e.Graphics.DrawLine(p, sidebarPanel.Width - 1, 0, sidebarPanel.Width - 1, sidebarPanel.Height);
            };

            // Sidebar Navigation Tabs
            string[] tabTitles = { "Install", "Uninstall", "Repair", "Kill Discord" };
            int tabY = 16;
            for (int i = 0; i < tabTitles.Length; i++)
            {
                var tab = new SidebarTab(tabTitles[i], i);
                tab.Location = new Point(14, tabY);
                tab.Width = 182;
                tab.Click += Tab_Click;
                sidebarTabs[i] = tab;
                sidebarPanel.Controls.Add(tab);
                tabY += 46;
            }
            sidebarTabs[0].Active = true; // Set initial active

            // ── MAIN CONTENT AREA ───────────────────────────────────
            mainContent = new Panel();
            mainContent.Dock = DockStyle.Fill;
            mainContent.BackColor = C.Bg;

            // Toolbar
            var toolbar = new DBPanel();
            toolbar.Dock = DockStyle.Top;
            toolbar.Height = 44;
            toolbar.BackColor = C.Bg;
            toolbar.Paint += (s, e) =>
            {
                TextRenderer.DrawText(e.Graphics, "DETECTED INSTALLATIONS", F.MutedText,
                    new Rectangle(20, 16, 200, 18), C.TextDark, TextFormatFlags.Left);
            };

            btnRefresh = new CustomLink("Refresh", C.TextDim);
            btnRefresh.Click += (s, e) => RefreshClients();

            btnAddPath = new CustomLink("+ Custom Path", C.Accent);
            btnAddPath.Click += BtnAddPath_Click;

            toolbar.Controls.Add(btnRefresh);
            toolbar.Controls.Add(btnAddPath);
            toolbar.Resize += (s, e) =>
            {
                btnAddPath.Location = new Point(toolbar.Width - btnAddPath.Width - 20, 12);
                btnRefresh.Location = new Point(btnAddPath.Left - btnRefresh.Width - 12, 12);
            };

            // Client installations layout
            clientFlow = new FlowLayoutPanel
            {
                Dock = DockStyle.Top,
                Height = 224,
                FlowDirection = FlowDirection.TopDown,
                WrapContents = false,
                AutoScroll = true,
                BackColor = C.Bg,
                Padding = new Padding(16, 0, 16, 0)
            };

            // Options bar
            var optBar = new DBPanel();
            optBar.Dock = DockStyle.Top;
            optBar.Height = 40;
            optBar.BackColor = C.Bg;

            chkAll = new CustomCheckBox("Select all clients");
            chkAll.Location = new Point(20, 8);
            chkAll.CheckedChanged += (s, e) => cards.ForEach(c => c.Selected = chkAll.Checked);

            chkRestart = new CustomCheckBox("Restart Discord automatically");
            chkRestart.Checked = true;
            chkRestart.Location = new Point(160, 8);

            optBar.Controls.Add(chkAll);
            optBar.Controls.Add(chkRestart);

            // Log header
            var logHeader = new DBPanel();
            logHeader.Dock = DockStyle.Top;
            logHeader.Height = 24;
            logHeader.BackColor = C.Bg;
            logHeader.Paint += (s, e) =>
            {
                TextRenderer.DrawText(e.Graphics, "LOG OUTPUT", F.MutedText,
                    new Rectangle(20, 6, 150, 16), C.TextDark, TextFormatFlags.Left);
            };

            // Modern Log Box
            logBox = new RichTextBox
            {
                Dock = DockStyle.Fill,
                BackColor = C.Sidebar,
                ForeColor = C.TextDim,
                Font = F.Code,
                ReadOnly = true,
                BorderStyle = BorderStyle.None,
                ScrollBars = RichTextBoxScrollBars.Vertical
            };
            logBox.Padding = new Padding(20, 12, 20, 12);

            // Rounded panel containing log box
            var logBorderPanel = new LogWrapperPanel();
            logBorderPanel.Dock = DockStyle.Fill;
            logBorderPanel.Padding = new Padding(20, 4, 20, 16);
            logBorderPanel.Controls.Add(logBox);

            var bottomInteractiveArea = new Panel();
            bottomInteractiveArea.Dock = DockStyle.Bottom;
            bottomInteractiveArea.Height = 90;
            bottomInteractiveArea.BackColor = C.Bg;

            // Action Button
            btnAction = new CustomActionButton("INSTALL ENDCORD");
            btnAction.Location = new Point(20, 12);
            btnAction.Size = new Size(570, 48);
            btnAction.Click += (s, e) => DoOperation();
            bottomInteractiveArea.Controls.Add(btnAction);

            bottomInteractiveArea.Resize += (s, e) =>
            {
                btnAction.Width = bottomInteractiveArea.Width - 40;
            };

            // Progress bar
            progress = new CustomProgress();
            progress.Dock = DockStyle.Top;
            progress.Height = 4;
            progress.Visible = false;

            mainContent.Controls.Add(logBorderPanel);
            mainContent.Controls.Add(logHeader);
            mainContent.Controls.Add(bottomInteractiveArea);
            mainContent.Controls.Add(progress);
            mainContent.Controls.Add(optBar);
            mainContent.Controls.Add(clientFlow);
            mainContent.Controls.Add(toolbar);

            // ── STATUS BAR ──────────────────────────────────────────
            statusBar = new DBPanel();
            statusBar.Dock = DockStyle.Bottom;
            statusBar.Height = 28;
            statusBar.BackColor = C.Sidebar;
            statusBar.Paint += (s, e) =>
            {
                using (var p = new Pen(C.Border))
                    e.Graphics.DrawLine(p, 0, 0, statusBar.Width, 0);
            };

            lblStatus = new Label
            {
                Text = "Ready", Font = F.MutedText, ForeColor = C.TextDark,
                AutoSize = true, Location = new Point(20, 7), BackColor = Color.Transparent
            };

            statusBar.Controls.Add(lblStatus);

            // Assemble Form
            Controls.Add(mainContent);
            Controls.Add(sidebarPanel);
            Controls.Add(titleBar);
            Controls.Add(statusBar);
        }

        // ── TITLE BAR BUTTONS ──────────────────────────────────────
        Button WinBtn(string text, Color hovColor, DockStyle dock)
        {
            var b = new Button
            {
                Text = text, Font = new Font("Webdings", 9),
                ForeColor = C.TextDark, BackColor = Color.Transparent,
                FlatStyle = FlatStyle.Flat, Size = new Size(44, 44),
                Dock = dock, Cursor = Cursors.Hand, TabStop = false
            };
            b.FlatAppearance.BorderSize = 0;
            b.FlatAppearance.MouseOverBackColor = Color.FromArgb(30, hovColor);
            b.FlatAppearance.MouseDownBackColor = Color.FromArgb(50, hovColor);
            b.MouseEnter += (s, e) => b.ForeColor = C.Text;
            b.MouseLeave += (s, e) => b.ForeColor = C.TextDark;
            return b;
        }

        // ── TAB CLICK HANDLER ──────────────────────────────────────
        void Tab_Click(object sender, EventArgs e)
        {
            var selectedTab = (SidebarTab)sender;
            if (selectedTab.TabIdx == 3)
            {
                DoKill();
                return;
            }

            activeTab = selectedTab.TabIdx;
            for (int i = 0; i < 3; i++)
                sidebarTabs[i].Active = (i == activeTab);

            string[] actionTexts = { "INSTALL ENDCORD", "UNINSTALL ENDCORD", "REPAIR INSTALLATION" };
            btnAction.Text = actionTexts[activeTab];
            SetStatus("Selected Mode: " + tabTitlesText[activeTab]);
        }

        static readonly string[] tabTitlesText = { "Install", "Uninstall", "Repair" };

        // ── DETECT DISCORD INSTALLATIONS ────────────────────────────
        void RefreshClients()
        {
            clients.Clear(); cards.Clear(); clientFlow.Controls.Clear();
            chkAll.Checked = false;

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

            // Filter: if any detected client is running, only show running clients.
            // Otherwise, show all detected clients.
            var runningClients = new List<DiscordClient>();
            foreach (var c in allDetected)
            {
                if (c.IsRunning()) runningClients.Add(c);
            }

            var toShow = runningClients.Count > 0 ? runningClients : allDetected;

            foreach (var c in toShow)
            {
                clients.Add(c);
                var card = new ClientCard(c);
                card.Width = 560; // Safe default width before layout
                cards.Add(card);
                clientFlow.Controls.Add(card);
            }

            if (clients.Count == 0)
            {
                Log("No Discord installations detected.", C.Amber);
                SetStatus("No Discord installations found");
            }
            else
            {
                string msg = runningClients.Count > 0 
                    ? "Showing " + clients.Count + " active/running Discord client(s)."
                    : "Detected " + clients.Count + " closed Discord client(s).";
                Log(msg, C.Green);
                SetStatus("Ready");
            }
        }

        DiscordClient GetClient(string name, string root, string exe)
        {
            if (!Directory.Exists(root)) return null;
            var dirs = Directory.GetDirectories(root, "app-*");
            if (dirs.Length == 0) return null;
            Array.Sort(dirs);
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
            card.Width = 560; // Safe default width before layout
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
                var wasRunning = new List<DiscordClient>();
                foreach (var c in targets)
                    if (c.IsRunning()) wasRunning.Add(c);

                try
                {
                    SafeLog("Closing Discord to release file locks...", C.TextDim);
                    KillAllDiscordInstances();
                    Thread.Sleep(1500);

                    if (activeTab == 0 || activeTab == 2)
                        DoInstall(targets, activeTab == 2);
                    else
                        DoUninstall(targets);

                    Thread.Sleep(1500);
                    foreach (var c in targets)
                    {
                        SafeLog("Launching " + c.Name + "...", C.Blue);
                        c.Launch();
                    }
                    SafeLog("Discord restarted.", C.Green);
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
            for (int i = 0; i < 8; i++)
            {
                try
                {
                    Directory.Delete(path, true);
                    return;
                }
                catch
                {
                    Thread.Sleep(250);
                }
            }
            Directory.Delete(path, true);
        }

        static void SafeDeleteFile(string path)
        {
            if (!File.Exists(path)) return;
            for (int i = 0; i < 8; i++)
            {
                try
                {
                    File.Delete(path);
                    return;
                }
                catch
                {
                    Thread.Sleep(250);
                }
            }
            File.Delete(path);
        }

        static void SafeMoveFile(string src, string dest)
        {
            for (int i = 0; i < 8; i++)
            {
                try
                {
                    if (File.Exists(dest)) SafeDeleteFile(dest);
                    File.Move(src, dest);
                    return;
                }
                catch
                {
                    Thread.Sleep(250);
                }
            }
            File.Move(src, dest);
        }

        void DoInstall(List<DiscordClient> targets, bool repair)
        {
            SafeLog(repair ? "Starting Endcord repair..." : "Starting Endcord installation...", C.AccentLight);
            SetProg(5);

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

            SafeLog("Injecting patcher into Discord client directories...", C.TextDim);
            SetProg(48);

            for (int i = 0; i < targets.Count; i++)
            {
                var c = targets[i];
                try
                {
                    string appDir  = Path.Combine(c.ResourcesPath, "app");
                    string origAsar = Path.Combine(c.ResourcesPath, "app.asar");
                    string backupAsar  = Path.Combine(c.ResourcesPath, "_app.asar");

                    if (File.Exists(origAsar) && !File.Exists(backupAsar)) SafeMoveFile(origAsar, backupAsar);
                    Directory.CreateDirectory(appDir);

                    File.WriteAllText(Path.Combine(appDir, "package.json"),
                        "{\n  \"name\": \"discord\",\n  \"main\": \"index.js\"\n}");

                    File.WriteAllText(Path.Combine(appDir, "index.js"),
                        "const { join } = require('path');\n" +
                        "require.main.path = join(__dirname, '..', '_app.asar');\n" +
                        "const appData = process.env.APPDATA || (process.platform === 'darwin' ?\n" +
                        "  join(process.env.HOME, 'Library/Application Support') :\n" +
                        "  join(process.env.HOME, '.config'));\n" +
                        "require(join(appData, 'Endcord', 'dist', 'patcher.js'));\n");

                    SafeLog("Successfully patched " + c.Name + " (" + c.Version + ")", C.Green);
                }
                catch (Exception ex) { SafeLog("Failed patching " + c.Name + ": " + ex.Message, C.Red); }
                SetProg(48 + 52 * (i + 1) / targets.Count);
            }
            SafeLog("Operations complete.", C.AccentLight);
            SetProg(100);
        }

        void DoUninstall(List<DiscordClient> targets)
        {
            SafeLog("Removing Endcord from installations...", C.AccentLight);
            for (int i = 0; i < targets.Count; i++)
            {
                var c = targets[i];
                try
                {
                    string appDir  = Path.Combine(c.ResourcesPath, "app");
                    string origAsar = Path.Combine(c.ResourcesPath, "app.asar");
                    string backupAsar  = Path.Combine(c.ResourcesPath, "_app.asar");

                    SafeDeleteDir(appDir);
                    if (File.Exists(backupAsar)) SafeMoveFile(backupAsar, origAsar);
                    SafeLog("Successfully uninstalled from " + c.Name, C.Green);
                }
                catch (Exception ex) { SafeLog("Failed to restore " + c.Name + ": " + ex.Message, C.Red); }
                SetProg(100 * (i + 1) / targets.Count);
            }
            SafeLog("Uninstall complete.", C.AccentLight);
        }

        static void KillAllDiscordInstances()
        {
            var procs = new List<Process>();
            foreach (var p in Process.GetProcesses())
                try { if (p.ProcessName.ToLower().Contains("discord")) procs.Add(p); } catch { }

            foreach (var p in procs)
                try { p.CloseMainWindow(); } catch { }

            int w = 0;
            while (w < 5000)
            {
                bool done = true;
                foreach (var p in procs)
                    try { if (!p.HasExited) done = false; } catch { }
                if (done) break;
                Thread.Sleep(250); w += 250;
            }

            foreach (var p in procs)
                try { if (!p.HasExited) { p.Kill(); p.WaitForExit(2000); } } catch { }
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
        {
            if (InvokeRequired) Invoke(new Action(() => { progress.Value = Math.Min(v, 100); progress.Invalidate(); }));
            else { progress.Value = Math.Min(v, 100); progress.Invalidate(); }
        }
        void SetStatus(string s)
        { if (InvokeRequired) Invoke(new Action(() => lblStatus.Text = s)); else lblStatus.Text = s; }
        void SetBusy(bool b)
        {
            btnAction.Enabled = !b; btnRefresh.Enabled = !b;
            btnAddPath.Enabled = !b; chkAll.Enabled = !b;
            for (int i = 0; i < 4; i++) sidebarTabs[i].Enabled = !b;
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            using (var p = new Pen(C.Border, 1))
                e.Graphics.DrawRectangle(p, 0, 0, Width - 1, Height - 1);
        }
    }

    // ═══════════════════════════════ SIDEBAR NAVIGATION TAB ═══════════════════════════════
    class SidebarTab : DBPanel
    {
        public int TabIdx;
        bool _hov, _active;
        string _title;

        public bool Active
        {
            get { return _active; }
            set { _active = value; Invalidate(); }
        }

        public SidebarTab(string title, int index)
        {
            _title = title;
            TabIdx = index;
            Height = 38;
            Cursor = Cursors.Hand;
            MouseEnter += (s, e) => { _hov = true; Invalidate(); };
            MouseLeave += (s, e) => { _hov = false; Invalidate(); };
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;

            var r = new Rectangle(0, 0, Width, Height);

            if (_active)
            {
                Gfx.FillRoundRect(g, r, 6, C.Card);
                // Active indicator line on the left side
                Gfx.FillRoundRect(g, new Rectangle(0, 8, 4, Height - 16), 2, C.Accent);
            }
            else if (_hov)
            {
                Gfx.FillRoundRect(g, r, 6, Color.FromArgb(12, C.Card));
            }

            Color textColor = _active ? C.Text : (_hov ? C.TextDim : C.TextDark);
            TextRenderer.DrawText(g, _title, F.TabText,
                new Rectangle(12, 0, Width - 24, Height), textColor,
                TextFormatFlags.VerticalCenter | TextFormatFlags.Left);
        }
    }

    // ═══════════════════════════════ CLIENT INSTALLATION CARD ═══════════════════════════════
    class ClientCard : DBPanel
    {
        DiscordClient dc;
        bool _sel, _hov;
        public bool Selected { get { return _sel; } set { _sel = value; Invalidate(); } }

        public ClientCard(DiscordClient client)
        {
            dc = client;
            Height = 72;
            Margin = new Padding(0, 0, 0, 8);
            Cursor = Cursors.Hand;
            Click      += (s, e) => { Selected = !_sel; };
            MouseEnter += (s, e) => { _hov = true;  Invalidate(); };
            MouseLeave += (s, e) => { _hov = false; Invalidate(); };
            Paint += DrawCard;
        }

        protected override void OnParentChanged(EventArgs e)
        {
            base.OnParentChanged(e);
            if (Parent != null)
            {
                Parent.SizeChanged -= Parent_SizeChanged;
                Parent.SizeChanged += Parent_SizeChanged;
                UpdateWidth();
            }
        }

        private void Parent_SizeChanged(object sender, EventArgs e)
        {
            UpdateWidth();
        }

        private void UpdateWidth()
        {
            if (Parent != null)
            {
                int targetW = Parent.ClientSize.Width - 36;
                if (targetW > 100 && Width != targetW)
                {
                    Width = targetW;
                    Invalidate();
                }
            }
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing && Parent != null)
            {
                Parent.SizeChanged -= Parent_SizeChanged;
            }
            base.Dispose(disposing);
        }

        void DrawCard(object s, PaintEventArgs e)
        {
            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;

            var r = new Rectangle(0, 0, Width - 1, Height - 1);

            // Card background
            Color bg = _sel ? C.CardSel : (_hov ? C.CardHov : C.Card);
            Gfx.FillRoundRect(g, r, 8, bg);

            // Sleek border
            if (_sel)
                Gfx.DrawRoundRect(g, r, 8, Color.FromArgb(120, C.Accent), 1.25f);
            else if (_hov)
                Gfx.DrawRoundRect(g, r, 8, Color.FromArgb(40, C.Accent), 1f);
            else
                Gfx.DrawRoundRect(g, r, 8, C.Border, 1f);

            // Checkbox Circle
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

            // Status indicator dot
            if (running)
            {
                using (var b = new SolidBrush(C.Green))
                    g.FillEllipse(b, tx, (Height - 8) / 2, 8, 8);
                tx += 14;
            }

            // Client Name
            TextRenderer.DrawText(g, dc.Name, F.Title,
                new Rectangle(tx, 8, Width - tx - 160, 20),
                C.Text, TextFormatFlags.Left | TextFormatFlags.EndEllipsis);

            // Version and running status
            string info = dc.Version + (running ? "  ·  Running" : "  ·  Closed");
            TextRenderer.DrawText(g, info, F.Subtitle,
                new Rectangle(tx, 28, Width - 200, 18), 
                running ? C.Green : C.TextDim, TextFormatFlags.Left);

            // Path
            TextRenderer.DrawText(g, dc.ResourcesPath, F.MutedText,
                new Rectangle(tx, 48, Width - 200, 14), 
                C.TextDim, TextFormatFlags.Left | TextFormatFlags.EndEllipsis);

            // 1. Edition Badge (e.g. STABLE, CANARY, PTB)
            string editionStr = "CUSTOM";
            Color edColor = C.TextDim;
            Color edBgColor = Color.FromArgb(20, C.TextDim);
            if (dc.Name.Contains("Stable")) { editionStr = "STABLE"; edColor = C.Blue; edBgColor = Color.FromArgb(20, C.Blue); }
            else if (dc.Name.Contains("Canary")) { editionStr = "CANARY"; edColor = C.Amber; edBgColor = Color.FromArgb(20, C.Amber); }
            else if (dc.Name.Contains("PTB")) { editionStr = "PTB"; edColor = C.Accent; edBgColor = Color.FromArgb(20, C.Accent); }
            else if (dc.Name.Contains("Dev")) { editionStr = "DEV"; edColor = C.Red; edBgColor = Color.FromArgb(20, C.Red); }

            var edSize = TextRenderer.MeasureText(editionStr, F.MutedText);
            // 2. Status Badge (PATCHED / VANILLA)
            bool injected = dc.IsInjected();
            string statusStr = injected ? "PATCHED" : "VANILLA";
            Color statusColor = injected ? C.Green : C.Amber;
            Color statusBgColor = injected ? C.GreenBg : C.AmberBg;
            var statusSize = TextRenderer.MeasureText(statusStr, F.MutedText);

            // Calculate layout bounds from right to left
            int margin = 16;
            int badgeY = (Height - 20) / 2;

            // Status Badge Rect (rightmost)
            int statusW = statusSize.Width + 14;
            var statusRect = new Rectangle(Width - statusW - margin, badgeY, statusW, 20);

            // Edition Badge Rect (to the left of status badge)
            int edW = edSize.Width + 14;
            var edRect = new Rectangle(statusRect.Left - edW - 8, badgeY, edW, 20);

            // Draw Edition
            Gfx.FillRoundRect(g, edRect, 5, edBgColor);
            Gfx.DrawRoundRect(g, edRect, 5, Color.FromArgb(60, edColor), 1f);
            TextRenderer.DrawText(g, editionStr, F.MutedText, edRect, edColor,
                TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);

            // Draw Status
            Gfx.FillRoundRect(g, statusRect, 5, statusBgColor);
            Gfx.DrawRoundRect(g, statusRect, 5, Color.FromArgb(60, statusColor), 1f);
            TextRenderer.DrawText(g, statusStr, F.MutedText, statusRect, statusColor,
                TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
        }
    }

    // ═══════════════════════════════ FLAT MODERN CUSTOM CHECKBOX ═══════════════════════════════
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
            Text = text;
            Height = 22;
            Cursor = Cursors.Hand;
            DoubleBuffered = true;
            MouseEnter += (s, e) => { _hov = true; Invalidate(); };
            MouseLeave += (s, e) => { _hov = false; Invalidate(); };
            Click += (s, e) => Checked = !_checked;
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;

            var box = new Rectangle(0, (Height - 16) / 2, 16, 16);

            if (_checked)
            {
                Gfx.FillRoundRect(g, box, 4, C.Accent);
                using (var p = new Pen(Color.White, 2f))
                {
                    g.DrawLine(p, 3, Height / 2, 6, Height / 2 + 3);
                    g.DrawLine(p, 6, Height / 2 + 3, 12, Height / 2 - 3);
                }
            }
            else
            {
                Gfx.DrawRoundRect(g, box, 4, _hov ? C.TextDim : C.TextDark, 1.5f);
            }

            var textRect = new Rectangle(22, 0, Width - 22, Height);
            TextRenderer.DrawText(g, Text, F.LabelText, textRect, _hov ? C.Text : C.TextDim,
                TextFormatFlags.VerticalCenter | TextFormatFlags.Left);
        }

        protected override void OnResize(EventArgs e)
        {
            base.OnResize(e);
            var sz = TextRenderer.MeasureText(Text, F.LabelText);
            Width = sz.Width + 26;
        }
    }

    // ═══════════════════════════════ MODERN LINK ═══════════════════════════════
    class CustomLink : Label
    {
        Color _defaultColor;
        bool _hov;

        public CustomLink(string text, Color baseColor)
        {
            _defaultColor = baseColor;
            Text = text;
            Font = F.Subtitle;
            ForeColor = baseColor;
            BackColor = Color.Transparent;
            AutoSize = true;
            Cursor = Cursors.Hand;
            Padding = new Padding(4);
            MouseEnter += (s, e) => { _hov = true; ForeColor = C.Text; };
            MouseLeave += (s, e) => { _hov = false; ForeColor = _defaultColor; };
        }
    }

    // ═══════════════════════════════ LOG CONTAINER PANEL ═══════════════════════════════
    class LogWrapperPanel : Panel
    {
        public LogWrapperPanel()
        {
            DoubleBuffered = true;
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            var borderRect = new Rectangle(Padding.Left - 1, Padding.Top - 1, Width - Padding.Horizontal + 1, Height - Padding.Vertical + 1);
            Gfx.FillRoundRect(g, borderRect, 6, C.Sidebar);
            Gfx.DrawRoundRect(g, borderRect, 6, C.Border, 1f);
        }
    }

    // ═══════════════════════════════ CUSTOM GRADIENT ACTION BUTTON ═══════════════════════════════
    class CustomActionButton : Control
    {
        bool _hov = false;
        bool _pressed = false;

        public CustomActionButton(string text)
        {
            Text = text;
            Cursor = Cursors.Hand;
            DoubleBuffered = true;
            MouseEnter += (s, e) => { _hov = true; Invalidate(); };
            MouseLeave += (s, e) => { _hov = false; _pressed = false; Invalidate(); };
            MouseDown += (s, e) => { if (e.Button == MouseButtons.Left) { _pressed = true; Invalidate(); } };
            MouseUp += (s, e) => { if (_pressed) { _pressed = false; Invalidate(); } };
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;

            var r = new Rectangle(0, 0, Width - 1, Height - 1);

            if (!Enabled)
            {
                Gfx.FillRoundRect(g, r, 6, C.Card);
                Gfx.DrawRoundRect(g, r, 6, C.Border, 1f);
                TextRenderer.DrawText(g, Text, F.ButtonText, r, C.TextDark,
                    TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
                return;
            }

            Color c1 = _pressed ? C.AccentLo : (_hov ? C.AccentLight : C.Accent);
            Color c2 = _pressed ? C.AccentLight : (_hov ? C.Accent : C.AccentLo);

            // Accent Glow
            if (_hov)
            {
                using (var path = Gfx.RoundRect(new Rectangle(2, 2, Width - 5, Height - 5), 6))
                using (var p = new Pen(C.AccentLight, 2f))
                    g.DrawPath(p, path);
            }

            Gfx.FillGradientRoundRect(g, r, 6, c1, c2, 135f);
            TextRenderer.DrawText(g, Text, F.ButtonText, r, Color.White,
                TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
        }
    }

    // ═══════════════════════════════ CUSTOM COMPACT PROGRESS BAR ═══════════════════════════════
    class CustomProgress : Control
    {
        public int Value;
        public CustomProgress() { DoubleBuffered = true; }

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            using (var b = new SolidBrush(C.Bg)) g.FillRectangle(b, ClientRectangle);

            if (Value > 0)
            {
                int w = Math.Max(1, (int)(Width * Value / 100.0));
                var progressRect = new Rectangle(0, 0, w, Height);
                using (var brush = new LinearGradientBrush(new Rectangle(0, 0, Math.Max(1, Width), Height), C.Accent, C.AccentLight, 0f))
                    g.FillRectangle(brush, progressRect);
            }
        }
    }

    // ═══════════════════════════════ DOUBLE BUFFERED PANEL ═══════════════════════════════
    class DBPanel : Panel
    {
        public DBPanel()
        {
            DoubleBuffered = true;
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint | ControlStyles.OptimizedDoubleBuffer, true);
        }
    }

    // ═══════════════════════════════ CUSTOM PATH DIALOG ═══════════════════════════════
    class PathDialog : Form
    {
        [DllImport("Gdi32.dll", EntryPoint = "CreateRoundRectRgn")]
        private static extern IntPtr CreateRoundRectRgn(int nLeft, int nTop, int nRight, int nBottom, int nWidthEllipse, int nHeightEllipse);

        [DllImport("gdi32.dll", EntryPoint = "DeleteObject")]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool DeleteObject(IntPtr hObject);

        TextBox txt;
        public string SelectedPath { get { return txt.Text; } }

        public PathDialog()
        {
            Text = "Custom Discord Path";
            ClientSize = new Size(480, 160);
            StartPosition = FormStartPosition.CenterParent;
            BackColor = C.Bg;
            ForeColor = C.Text;
            FormBorderStyle = FormBorderStyle.None;
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint | ControlStyles.DoubleBuffer, true);

            Paint += (s, e) =>
            {
                using (var p = new Pen(C.Border, 1))
                    e.Graphics.DrawRectangle(p, 0, 0, Width - 1, Height - 1);
            };

            // Custom Title/Header
            var header = new DBPanel { Dock = DockStyle.Top, Height = 40, BackColor = C.Sidebar };
            header.Paint += (s, e) =>
            {
                var g = e.Graphics;
                g.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;
                TextRenderer.DrawText(g, "Select Custom Discord Installation", F.Title,
                    new Rectangle(16, 0, Width - 32, 40), C.Text, TextFormatFlags.VerticalCenter);
                using (var p = new Pen(C.Border)) g.DrawLine(p, 0, 39, header.Width, 39);
            };

            bool drag = false; Point dp = Point.Empty;
            header.MouseDown += (s, e) => { if (e.Button == MouseButtons.Left) { drag = true; dp = e.Location; } };
            header.MouseMove += (s, e) => { if (drag) Location = new Point(Location.X + e.X - dp.X, Location.Y + e.Y - dp.Y); };
            header.MouseUp   += (s, e) => drag = false;

            var lbl = new Label
            {
                Text = "Browse and select the local folder containing the Discord app:",
                Font = F.Subtitle, ForeColor = C.TextDim, Location = new Point(16, 52), AutoSize = true
            };

            txt = new TextBox
            {
                Location = new Point(16, 76), Size = new Size(340, 23),
                BackColor = C.Card, ForeColor = C.Text,
                BorderStyle = BorderStyle.FixedSingle, Font = F.LabelText
            };

            var btnBrowse = new Button
            {
                Text = "Browse...", Location = new Point(366, 74),
                Size = new Size(98, 24), BackColor = C.Sidebar,
                ForeColor = C.TextDim, FlatStyle = FlatStyle.Flat,
                Font = F.Subtitle, Cursor = Cursors.Hand
            };
            btnBrowse.FlatAppearance.BorderColor = C.Border;
            btnBrowse.FlatAppearance.MouseOverBackColor = C.CardHov;
            btnBrowse.Click += (s, e) =>
            {
                using (var fbd = new FolderBrowserDialog { Description = "Select Discord directory", ShowNewFolderButton = false })
                {
                    if (!string.IsNullOrEmpty(txt.Text) && Directory.Exists(txt.Text))
                        fbd.SelectedPath = txt.Text;
                    if (fbd.ShowDialog() == DialogResult.OK) txt.Text = fbd.SelectedPath;
                }
            };

            var btnOk = new Button
            {
                Text = "Add", Location = new Point(300, 120),
                Size = new Size(76, 28), BackColor = C.Accent,
                ForeColor = Color.White, FlatStyle = FlatStyle.Flat,
                Font = F.ButtonText, Cursor = Cursors.Hand
            };
            btnOk.FlatAppearance.BorderSize = 0;
            btnOk.FlatAppearance.MouseOverBackColor = C.AccentLight;
            btnOk.Click += (s, e) => { DialogResult = DialogResult.OK; Close(); };

            var btnCancel = new Button
            {
                Text = "Cancel", Location = new Point(386, 120),
                Size = new Size(78, 28), BackColor = C.Sidebar,
                ForeColor = C.TextDim, FlatStyle = FlatStyle.Flat,
                Font = F.Subtitle, Cursor = Cursors.Hand
            };
            btnCancel.FlatAppearance.BorderColor = C.Border;
            btnCancel.FlatAppearance.MouseOverBackColor = C.CardHov;
            btnCancel.Click += (s, e) => { DialogResult = DialogResult.Cancel; Close(); };

            Controls.AddRange(new Control[] { header, lbl, txt, btnBrowse, btnOk, btnCancel });
        }

        protected override void OnResize(EventArgs e)
        {
            base.OnResize(e);
            IntPtr ptr = CreateRoundRectRgn(0, 0, Width, Height, 12, 12);
            Region = System.Drawing.Region.FromHrgn(ptr);
            DeleteObject(ptr);
        }
    }
}
