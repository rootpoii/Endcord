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
[assembly: AssemblyDescription("Official Endcord desktop installer. Installs, repairs, or removes the open-source Endcord Discord client modification. Source: https://github.com/rootpoii/endcord")]
[assembly: AssemblyConfiguration("")]
[assembly: AssemblyCompany("Endcord")]
[assembly: AssemblyProduct("Endcord")]
[assembly: AssemblyCopyright("Copyright © 2026 Endcord. Licensed under GPL-3.0-or-later.")]
[assembly: AssemblyTrademark("")]
[assembly: AssemblyCulture("")]
[assembly: AssemblyVersion("4.0.19.0")]
[assembly: AssemblyFileVersion("4.0.19.0")]
[assembly: AssemblyInformationalVersion("4.0.19")]
[assembly: ComVisible(false)]
[assembly: Guid("e8760626-8dd3-498f-abb9-eeac29266e0b")]
[assembly: System.Resources.NeutralResourcesLanguage("en-US")]

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
    static class AppFiles
    {
        public static void CloseByName(string processName)
        {
            try
            {
                string target = processName;
                if (target.EndsWith(".exe", StringComparison.OrdinalIgnoreCase))
                    target = target.Substring(0, target.Length - 4);

                Process[] list = Process.GetProcessesByName(target);
                for (int i = 0; i < list.Length; i++)
                {
                    Process p = list[i];
                    try
                    {
                        if (!p.HasExited)
                        {
                            p.CloseMainWindow();
                            if (!p.WaitForExit(2500) && !p.HasExited)
                                p.Kill();
                        }
                    }
                    catch { }
                    try { p.Dispose(); } catch { }
                }
            }
            catch { }
        }

        public static void DeleteDirectory(string path)
        {
            try
            {
                if (Directory.Exists(path))
                    Directory.Delete(path, true);
            }
            catch
            {
                try
                {
                    foreach (string file in Directory.GetFiles(path, "*", SearchOption.AllDirectories))
                    {
                        try
                        {
                            File.SetAttributes(file, FileAttributes.Normal);
                            File.Delete(file);
                        }
                        catch { }
                    }
                    foreach (string dir in Directory.GetDirectories(path, "*", SearchOption.AllDirectories))
                    {
                        try { Directory.Delete(dir, true); } catch { }
                    }
                    Directory.Delete(path, true);
                }
                catch { }
            }
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
        public static float GlobalTick = 0f;

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
            if (r.Width <= 0 || r.Height <= 0) return;
            using (var path = RoundRect(r, rad))
            using (var brush = new LinearGradientBrush(r, c1, c2, angle))
                g.FillPath(brush, path);
        }

        public static void DrawGlow(Graphics g, Rectangle r, int rad, Color glowColor, int layers, float spread)
        {
            for (int i = layers; i >= 1; i--)
            {
                int alpha = (int)(glowColor.A * (1f - (float)(i - 1) / layers));
                if (alpha <= 0) continue;
                var layerColor = Color.FromArgb(Math.Min(255, alpha), glowColor.R, glowColor.G, glowColor.B);
                int expand = (int)(i * spread);
                var glowRect = new Rectangle(r.X - expand, r.Y - expand, r.Width + expand * 2, r.Height + expand * 2);
                DrawRoundRect(g, glowRect, Math.Max(2, rad + expand), layerColor, 1.5f);
            }
        }

        public static float Approach(float current, float target, float speed)
        {
            if (current < target)
            {
                current += speed;
                if (current > target) current = target;
            }
            else if (current > target)
            {
                current -= speed;
                if (current < target) current = target;
            }
            return current;
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

        public bool HasEndcord()
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
            string n = Path.GetFileNameWithoutExtension(ExeName ?? "Discord.exe");
            try
            {
                return Process.GetProcessesByName(n).Length > 0;
            }
            catch
            {
                return false;
            }
        }

        public void CloseApp()
        {
            AppFiles.CloseByName(ExeName ?? "Discord.exe");
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
        bool _updatingSelectAll = false;
        System.Windows.Forms.Timer _animTimer;

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

        int activeTab = 0; // 0=Install, 1=Uninstall, 2=Repair, 3=Close Discord

        public MainForm()
        {
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint | ControlStyles.DoubleBuffer | ControlStyles.OptimizedDoubleBuffer, true);
            try
            {
                this.Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
            }
            catch { }
            SuspendLayout();
            BuildUI();
            ResumeLayout(false);

            _animTimer = new System.Windows.Forms.Timer();
            _animTimer.Interval = 25;
            _animTimer.Tick += (s, e) =>
            {
                Gfx.GlobalTick += 0.05f;
                if (Gfx.GlobalTick > 1000f) Gfx.GlobalTick = 0f;
                if (titleBar != null) titleBar.Invalidate();
                if (statusBar != null) statusBar.Invalidate();
                if (sidebarPanel != null) sidebarPanel.Invalidate();
                if (btnAction != null) btnAction.Invalidate();
                if (chkAll != null) chkAll.Invalidate();
                if (chkRestart != null) chkRestart.Invalidate();
                if (btnRefresh != null) btnRefresh.Invalidate();
                if (btnAddPath != null) btnAddPath.Invalidate();
                if (progress != null && progress.Visible) progress.Invalidate();
                foreach (var c in cards) c.Invalidate();
                for (int i = 0; i < sidebarTabs.Length; i++)
                    if (sidebarTabs[i] != null) sidebarTabs[i].Invalidate();
            };
            _animTimer.Start();

            RefreshClients();
        }

        protected override void OnResize(EventArgs e)
        {
            base.OnResize(e);
            IntPtr ptr = CreateRoundRectRgn(0, 0, Width, Height, 20, 20);
            Region = System.Drawing.Region.FromHrgn(ptr);
            DeleteObject(ptr);
        }

        void UpdateSelectAllState()
        {
            if (_updatingSelectAll) return;
            _updatingSelectAll = true;
            try
            {
                bool all = cards.Count > 0;
                foreach (var c in cards)
                {
                    if (!c.Selected) { all = false; break; }
                }
                chkAll.Checked = all;
            }
            finally
            {
                _updatingSelectAll = false;
            }
        }

        void BuildUI()
        {
            Text            = "Endcord Installer";
            ClientSize      = new Size(880, 620);
            MinimumSize     = new Size(880, 620);
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
                g.SmoothingMode = SmoothingMode.AntiAlias;

                int textX = 16;
                if (LogoImg != null)
                {
                    g.DrawImage(LogoImg, new Rectangle(14, 8, 28, 28));
                    textX = 50;
                }

                using (var fBold = new Font("Segoe UI", 12f, FontStyle.Bold))
                using (var fSub = new Font("Segoe UI", 11f, FontStyle.Regular))
                {
                    var szBold = TextRenderer.MeasureText(g, "Endcord", fBold);
                    int textY = (titleBar.Height - szBold.Height) / 2;
                    TextRenderer.DrawText(g, "Endcord", fBold, new Point(textX, textY), Color.White);
                    TextRenderer.DrawText(g, "Installer", fSub, new Point(textX + szBold.Width - 4, textY + 1), Color.FromArgb(140, 155, 230));
                }

                using (var pen = new Pen(Color.FromArgb(30, C.BorderLight), 1f))
                    g.DrawLine(pen, 0, titleBar.Height - 1, titleBar.Width, titleBar.Height - 1);
            };

            var bClose = WinBtn("r", C.Red, DockStyle.Right);
            var bMin   = WinBtn("0", C.TextDim, DockStyle.Right);
            bClose.Click += (s, e) => Application.Exit();
            bMin.Click   += (s, e) => WindowState = FormWindowState.Minimized;
            titleBar.Controls.Add(bMin);
            titleBar.Controls.Add(bClose);

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
            string[] tabDesc   = { "Inject client mod", "Restore vanilla", "Fix broken files", "Force exit clients" };

            for (int i = 0; i < 4; i++)
            {
                int idx = i;
                var tab = new SidebarTab(tabTitles[i], tabDesc[i], idx == 0);
                tab.Top = 16 + i * 62;
                tab.Left = 10;
                tab.Width = 190;
                tab.Click += (s, e) => SwitchTab(idx);
                sidebarTabs[i] = tab;
                sidebarPanel.Controls.Add(tab);
            }

            sidebarPanel.Paint += (s, e) =>
            {
                var g = e.Graphics;
                g.SmoothingMode = SmoothingMode.AntiAlias;

                int x = sidebarPanel.Width - 1;
                using (var pen = new Pen(Color.FromArgb(35, C.BorderLight), 1f))
                    g.DrawLine(pen, x, 0, x, sidebarPanel.Height);

                int beamH = 86;
                float travel = sidebarPanel.Height + beamH + 50;
                float y = sidebarPanel.Height + 25 - ((Gfx.GlobalTick * 48) % travel);
                var beam = new Rectangle(x - 2, (int)y, 5, beamH);
                if (beam.Height > 2)
                {
                    try
                    {
                        using (var sb = new LinearGradientBrush(beam, Color.Transparent, Color.FromArgb(120, Color.White), 90f))
                        {
                            var blend = new ColorBlend(3);
                            blend.Colors = new Color[] { Color.Transparent, Color.FromArgb(130, Color.White), Color.Transparent };
                            blend.Positions = new float[] { 0f, 0.5f, 1f };
                            sb.InterpolationColors = blend;
                            g.FillRectangle(sb, beam);
                        }
                    }
                    catch { }
                }
            };

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
            clientFlow.Height = 240;
            clientFlow.AutoScroll = true;
            clientFlow.WrapContents = false;
            clientFlow.FlowDirection = FlowDirection.TopDown;
            clientFlow.Padding = new Padding(0, 4, 0, 4);
            clientFlow.SizeChanged += (s, e) =>
            {
                int targetW = clientFlow.ClientSize.Width > 200 ? clientFlow.ClientSize.Width - 2 : 628;
                foreach (var c in cards) c.Width = targetW;
            };
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
                if (_updatingSelectAll) return;
                _updatingSelectAll = true;
                try
                {
                    foreach (var c in cards) c.Selected = chkAll.Checked;
                }
                finally
                {
                    _updatingSelectAll = false;
                }
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
            logBox.Margin = new Padding(0, 12, 0, 8);
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

        static readonly string[] tabTitlesText = { "Install", "Uninstall", "Repair", "Close Discord" };

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
                card.Width = clientFlow.ClientSize.Width > 200 ? clientFlow.ClientSize.Width - 2 : 628;
                card.Selected = true;
                card.SelectionChanged += (s, e) => UpdateSelectAllState();
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
            card.Width = clientFlow.ClientSize.Width > 200 ? clientFlow.ClientSize.Width - 2 : 628;
            card.Selected = true;
            card.SelectionChanged += (s, e) => UpdateSelectAllState();
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
                string[] names = { "Discord", "DiscordCanary", "DiscordPTB", "DiscordDevelopment" };
                foreach (var name in names)
                {
                    try { AppFiles.CloseByName(name); } catch { }
                }
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
                    CloseSelectedClients(targets);
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
            AppFiles.DeleteDirectory(path);
        }

        static void SafeDeleteFile(string path)
        {
            if (!File.Exists(path)) return;
            try
            {
                File.SetAttributes(path, FileAttributes.Normal);
                File.Delete(path);
            }
            catch { }
        }

        // ─── INSTALL HELPERS ───────────────────────────────────────────────────

        // Returns all discord_desktop_core index.js paths found in modules folder
        static List<string> FindAllDesktopCoreIndices(string appVerDir)
        {
            var list = new List<string>();
            string modulesDir = Path.Combine(appVerDir, "modules");
            if (!Directory.Exists(modulesDir)) return list;

            string[] coreDirs = Directory.GetDirectories(modulesDir, "discord_desktop_core-*");
            foreach (string dir in coreDirs)
            {
                string inner = Path.Combine(dir, "discord_desktop_core", "index.js");
                if (File.Exists(inner)) list.Add(inner);
            }
            return list;
        }

        // Restores original index.js from .bak or clean vanilla core.asar require
        static void RestoreDesktopCore(string indexJs)
        {
            string bakPath = indexJs + ".bak";
            bool restoredFromBak = false;
            if (File.Exists(bakPath))
            {
                try
                {
                    string bakContent = File.ReadAllText(bakPath);
                    if (!bakContent.Contains("Endcord") && bakContent.Contains("core.asar"))
                    {
                        File.WriteAllText(indexJs, bakContent);
                        restoredFromBak = true;
                    }
                }
                catch { }
                SafeDeleteFile(bakPath);
            }

            if (!restoredFromBak)
            {
                if (File.Exists(indexJs))
                {
                    string content = File.ReadAllText(indexJs);
                    string[] lines = content.Split('\n');
                    var filtered = new List<string>();
                    foreach (var line in lines)
                    {
                        if (!line.Contains("Endcord") && !line.Contains("patcher.js"))
                            filtered.Add(line.TrimEnd('\r'));
                    }
                    string result = string.Join("\r\n", filtered).Trim();
                    if (!result.Contains("core.asar"))
                        result = "module.exports = require('./core.asar');";
                    File.WriteAllText(indexJs, result + "\r\n");
                }
                else
                {
                    File.WriteAllText(indexJs, "module.exports = require('./core.asar');\r\n");
                }
            }
        }

        static void SafeBackupAsar(string origAsar, string backupAsar)
        {
            if (!File.Exists(origAsar)) return;
            if (File.Exists(backupAsar) && new FileInfo(backupAsar).Length > 100000) return;
            try
            {
                File.Copy(origAsar, backupAsar, true);
            }
            catch { }
        }

        static void SafeRestoreAsar(string resDir)
        {
            string appDir     = Path.Combine(resDir, "app");
            string origAsar   = Path.Combine(resDir, "app.asar");
            string backupAsar = Path.Combine(resDir, "_app.asar");

            // 1. Remove app directory
            if (Directory.Exists(appDir))
            {
                SafeDeleteDir(appDir);
            }

            // 2. If app.asar is a directory, remove it
            if (Directory.Exists(origAsar))
            {
                SafeDeleteDir(origAsar);
            }

            // 3. Restore _app.asar -> app.asar
            if (File.Exists(backupAsar))
            {
                if (File.Exists(origAsar))
                {
                    SafeDeleteFile(origAsar);
                }
                try
                {
                    File.Move(backupAsar, origAsar);
                }
                catch
                {
                    try
                    {
                        File.Copy(backupAsar, origAsar, true);
                        SafeDeleteFile(backupAsar);
                    }
                    catch { }
                }
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
                string[] files = { "patcher.js", "preload.js", "renderer.js", "renderer.css" };
                SafeLog("Copying Endcord files...", C.TextDim);
                for (int i = 0; i < files.Length; i++)
                {
                    string dest = Path.Combine(DistPath, files[i]);
                    SafeDeleteFile(dest);
                    ExtractRes(files[i], dest);
                    SetProg(5 + 40 * (i + 1) / files.Length);
                }
            }
            catch (Exception ex) { SafeLog("Extraction failed: " + ex.Message, C.Red); return; }

            SafeLog("Installing Endcord into selected Discord clients...", C.TextDim);
            SetProg(48);

            // ── Step 2: Inject into each Discord version ──────────────────────────
            for (int i = 0; i < targets.Count; i++)
            {
                var c = targets[i];
                try
                {
                    CloseClient(c);
                    Thread.Sleep(600);

                    var appDirs = Directory.GetDirectories(c.RootPath, "app-*");
                    if (appDirs.Length == 0)
                        SafeLog("No app-* version folders found for " + c.Name, C.Red);

                    bool patchedAny = false;
                    foreach (var appVerDir in appDirs)
                    {
                        // Clean any previous discord_desktop_core injection so Discord doesn't double-load
                        var coreIndices = FindAllDesktopCoreIndices(appVerDir);
                        foreach (var coreIndex in coreIndices)
                        {
                            RestoreDesktopCore(coreIndex);
                        }

                        string res = Path.Combine(appVerDir, "resources");
                        if (!Directory.Exists(res)) continue;

                        string appDir     = Path.Combine(res, "app");
                        string origAsar   = Path.Combine(res, "app.asar");
                        string backupAsar = Path.Combine(res, "_app.asar");

                        if (Directory.Exists(origAsar))
                        {
                            SafeDeleteDir(origAsar);
                        }

                        if (File.Exists(origAsar))
                        {
                            if (!File.Exists(backupAsar) || new FileInfo(backupAsar).Length < 100000)
                            {
                                SafeDeleteFile(backupAsar);
                                File.Move(origAsar, backupAsar);
                            }
                            else
                            {
                                SafeDeleteFile(origAsar);
                            }
                        }

                        if (Directory.Exists(appDir)) SafeDeleteDir(appDir);
                        Directory.CreateDirectory(appDir);

                        File.WriteAllText(Path.Combine(appDir, "package.json"),
                            "{\n  \"name\": \"discord\",\n  \"main\": \"index.js\"\n}\n");

                        string loaderJs = "const { join } = require('path');\n" +
                            "const appData = process.env.APPDATA || (process.platform === 'darwin' ? join(process.env.HOME, 'Library/Application Support') : join(process.env.HOME, '.config'));\n" +
                            "const patcherPath = join(appData, 'Endcord', 'dist', 'patcher.js');\n" +
                            "require(patcherPath);\n";
                        File.WriteAllText(Path.Combine(appDir, "index.js"), loaderJs);

                        SafeLog("  installed " + appDir, C.TextDim);
                        patchedAny = true;
                    }

                    if (patchedAny)
                        SafeLog("Successfully installed Endcord into " + c.Name + " (" + c.Version + ")", C.Green);
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
                    CloseClient(c);
                    Thread.Sleep(600);

                    var appDirs = Directory.GetDirectories(c.RootPath, "app-*");
                    foreach (var appVerDir in appDirs)
                    {
                        // 1. Restore all discord_desktop_core modules
                        var coreIndices = FindAllDesktopCoreIndices(appVerDir);
                        foreach (var coreIndex in coreIndices)
                        {
                            RestoreDesktopCore(coreIndex);
                        }

                        // 2. Restore resources directory and clean app folder
                        string res = Path.Combine(appVerDir, "resources");
                        if (Directory.Exists(res))
                        {
                            SafeRestoreAsar(res);
                        }
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

        static void CloseClient(DiscordClient c)
        {
            if (c == null) return;
            try { c.CloseApp(); } catch { }
        }

        static void CloseSelectedClients(List<DiscordClient> targets)
        {
            foreach (var c in targets)
            {
                try { CloseClient(c); } catch { }
            }
        }

        static void ExtractRes(string name, string dest)
        {
            var asm = Assembly.GetExecutingAssembly();
            string match = null;
            foreach (var n in asm.GetManifestResourceNames())
            {
                if (string.Equals(n, name, StringComparison.OrdinalIgnoreCase))
                {
                    match = n;
                    break;
                }
            }
            if (match == null)
            {
                foreach (var n in asm.GetManifestResourceNames())
                {
                    if (n.EndsWith(name, StringComparison.OrdinalIgnoreCase))
                    {
                        match = n;
                        break;
                    }
                }
            }
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
        float _hoverAnim = 0f;
        float _activeAnim = 0f;
        string _title, _desc;

        public SidebarTab(string title, string desc, bool active)
        {
            _title = title; _desc = desc; _active = active;
            _activeAnim = active ? 1f : 0f;
            Height = 54; Cursor = Cursors.Hand; DoubleBuffered = true;
            MouseEnter += (s, e) => { _hov = true; Invalidate(); };
            MouseLeave += (s, e) => { _hov = false; Invalidate(); };
        }

        public void SetActive(bool a) { _active = a; Invalidate(); }

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;

            _hoverAnim = Gfx.Approach(_hoverAnim, _hov ? 1f : 0f, 0.12f);
            _activeAnim = Gfx.Approach(_activeAnim, _active ? 1f : 0f, 0.12f);

            var r = new Rectangle(0, 0, Width - 1, Height - 1);

            // Active glow (fades with _activeAnim)
            if (_activeAnim > 0.01f)
            {
                float pulse = (float)(Math.Sin(Gfx.GlobalTick * 3) * 0.5 + 0.5);
                int glowA = (int)((30 + 20 * pulse) * _activeAnim);
                Gfx.DrawGlow(g, r, 8, Color.FromArgb(glowA, C.AccentLight), 2, 2f);

                int fillA1 = (int)(60 * _activeAnim);
                int fillA2 = (int)(15 * _activeAnim);
                Gfx.FillGradientRoundRect(g, r, 8, Color.FromArgb(fillA1, C.Accent), Color.FromArgb(fillA2, C.Accent), 90f);

                int borderA = (int)((120 + 40 * pulse) * _activeAnim);
                Gfx.DrawRoundRect(g, r, 8, Color.FromArgb(borderA, C.AccentLight), 1f);

                int barH = (int)(24 * _activeAnim);
                if (barH > 2)
                {
                    var barRect = new Rectangle(0, (Height - barH) / 2, 3, barH);
                    Gfx.FillRoundRect(g, barRect, 1, Color.FromArgb((int)(255 * _activeAnim), Color.White));
                }
            }

            // Hover fill when not fully active
            if (_hoverAnim > 0.01f && _activeAnim < 0.99f)
            {
                float factor = _hoverAnim * (1f - _activeAnim);
                int bgAlpha = (int)(25 * factor);
                int borderAlpha = (int)(50 * factor);
                if (bgAlpha > 0)
                    Gfx.FillRoundRect(g, r, 8, Color.FromArgb(bgAlpha, 30, 33, 58));
                if (borderAlpha > 0)
                    Gfx.DrawRoundRect(g, r, 8, Color.FromArgb(borderAlpha, C.AccentLight), 1f);
            }

            int textLeft = 18;
            // Smoothly interpolate title color: Dim -> Hover White -> Active White
            float titleBright = Math.Max(_activeAnim, _hoverAnim);
            Color titleCol = Color.FromArgb(
                (int)(C.TextDim.R + (255 - C.TextDim.R) * titleBright),
                (int)(C.TextDim.G + (255 - C.TextDim.G) * titleBright),
                (int)(C.TextDim.B + (255 - C.TextDim.B) * titleBright));

            TextRenderer.DrawText(g, _title, F.TabText, new Rectangle(textLeft, 9, Width - textLeft - 10, 18),
                titleCol, TextFormatFlags.Left);

            // Subtitle color: Dark -> Hover Dim -> Active AccentLight
            Color descCol;
            if (_activeAnim > 0.01f)
            {
                descCol = Color.FromArgb(
                    (int)(C.TextDark.R + (C.AccentLight.R - C.TextDark.R) * _activeAnim),
                    (int)(C.TextDark.G + (C.AccentLight.G - C.TextDark.G) * _activeAnim),
                    (int)(C.TextDark.B + (C.AccentLight.B - C.TextDark.B) * _activeAnim));
            }
            else
            {
                descCol = Color.FromArgb(
                    (int)(C.TextDark.R + (C.TextDim.R - C.TextDark.R) * _hoverAnim),
                    (int)(C.TextDark.G + (C.TextDim.G - C.TextDark.G) * _hoverAnim),
                    (int)(C.TextDark.B + (C.TextDim.B - C.TextDark.B) * _hoverAnim));
            }

            TextRenderer.DrawText(g, _desc, F.MutedText, new Rectangle(textLeft, 29, Width - textLeft - 10, 16),
                descCol, TextFormatFlags.Left);
        }
    }

    class ClientCard : Control
    {
        DiscordClient dc;
        bool _sel = false;
        bool _hov = false;
        float _hoverAnim = 0f;
        float _selectAnim = 0f;

        public event EventHandler SelectionChanged;

        public bool Selected
        {
            get { return _sel; }
            set
            {
                _sel = value;
                Invalidate();
                if (SelectionChanged != null) SelectionChanged(this, EventArgs.Empty);
            }
        }

        public ClientCard(DiscordClient client)
        {
            dc = client;
            _selectAnim = 0f;
            Height = 78; Margin = new Padding(0, 0, 0, 8);
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

            _hoverAnim = Gfx.Approach(_hoverAnim, _hov ? 1f : 0f, 0.12f);
            _selectAnim = Gfx.Approach(_selectAnim, _sel ? 1f : 0f, 0.12f);

            var r = new Rectangle(0, 0, Width - 1, Height - 1);

            // Base background
            int baseR = C.Card.R + (int)((C.CardHov.R - C.Card.R) * _hoverAnim);
            int baseG = C.Card.G + (int)((C.CardHov.G - C.Card.G) * _hoverAnim);
            int baseB = C.Card.B + (int)((C.CardHov.B - C.Card.B) * _hoverAnim);
            Gfx.FillRoundRect(g, r, 10, Color.FromArgb(baseR, baseG, baseB));

            // Selected glow & gradient (smoothly fading in)
            if (_selectAnim > 0.01f)
            {
                float pulse = (float)(Math.Sin(Gfx.GlobalTick * 3) * 0.5 + 0.5);
                int glowA = (int)((35 + 25 * pulse) * _selectAnim);
                Gfx.DrawGlow(g, r, 10, Color.FromArgb(glowA, C.AccentLight), 2, 2f);

                Color selC1 = Color.FromArgb((int)(255 * _selectAnim), 38, 42, 90);
                Color selC2 = Color.FromArgb((int)(255 * _selectAnim), 22, 25, 54);
                Gfx.FillGradientRoundRect(g, r, 10, selC1, selC2, 45f);
            }

            Color unselBorder = Color.FromArgb(
                (int)(C.Border.R + (C.AccentLight.R - C.Border.R) * (_hoverAnim * 0.4f)),
                (int)(C.Border.G + (C.AccentLight.G - C.Border.G) * (_hoverAnim * 0.4f)),
                (int)(C.Border.B + (C.AccentLight.B - C.Border.B) * (_hoverAnim * 0.4f)));

            Color finalBorder = Color.FromArgb(
                (int)(unselBorder.R + (C.AccentLight.R - unselBorder.R) * _selectAnim),
                (int)(unselBorder.G + (C.AccentLight.G - unselBorder.G) * _selectAnim),
                (int)(unselBorder.B + (C.AccentLight.B - unselBorder.B) * _selectAnim));

            Gfx.DrawRoundRect(g, r, 10, finalBorder, 1f);

            // Checkbox
            int cx = 26, cy = Height / 2;
            var chkRect = new Rectangle(cx - 10, cy - 10, 20, 20);

            // Unchecked base
            Gfx.FillRoundRect(g, chkRect, 6, Color.FromArgb(15, C.Bg));
            Color chkBorderC = Color.FromArgb(
                (int)(C.TextDark.R + (C.TextDim.R - C.TextDark.R) * _hoverAnim),
                (int)(C.TextDark.G + (C.TextDim.G - C.TextDark.G) * _hoverAnim),
                (int)(C.TextDark.B + (C.TextDim.B - C.TextDark.B) * _hoverAnim));
            Gfx.DrawRoundRect(g, chkRect, 6, chkBorderC, 1.5f);

            // Checked box (fading in smoothly)
            if (_selectAnim > 0.01f)
            {
                int chkA = (int)(255 * _selectAnim);
                Gfx.FillRoundRect(g, chkRect, 6, Color.FromArgb(chkA, C.Accent));
                Gfx.DrawRoundRect(g, chkRect, 6, Color.FromArgb(chkA, Color.White), 1f);

                using (var p = new Pen(Color.FromArgb(chkA, Color.White), 2f))
                {
                    p.StartCap = LineCap.Round;
                    p.EndCap = LineCap.Round;
                    p.LineJoin = LineJoin.Round;
                    g.DrawLine(p, cx - 4, cy, cx - 1, cy + 4);
                    g.DrawLine(p, cx - 1, cy + 4, cx + 5, cy - 3);
                }
            }

            int tx = 56;
            bool running = dc.IsRunning();

            Color titleC = Color.FromArgb(
                (int)(C.Text.R + (255 - C.Text.R) * _selectAnim),
                (int)(C.Text.G + (255 - C.Text.G) * _selectAnim),
                (int)(C.Text.B + (255 - C.Text.B) * _selectAnim));

            TextRenderer.DrawText(g, dc.Name, F.Title,
                new Rectangle(tx, 12, Width - tx - 170, 20),
                titleC, TextFormatFlags.Left | TextFormatFlags.EndEllipsis);

            int subX = tx;
            if (running)
            {
                // Soft breathing green dot
                float pulse = (float)(Math.Sin(Gfx.GlobalTick * 3.5) * 0.5 + 0.5);
                int glowA = (int)(25 + 35 * pulse);
                using (var gb = new SolidBrush(Color.FromArgb(glowA, C.Green)))
                    g.FillEllipse(gb, tx - 2, 35, 10, 10);
                using (var b = new SolidBrush(C.Green))
                    g.FillEllipse(b, tx, 37, 6, 6);
                subX += 13;
            }

            string info = dc.Version + (running ? " • Running" : " • Closed");
            TextRenderer.DrawText(g, info, F.Subtitle,
                new Rectangle(subX, 32, Width - subX - 170, 18),
                running ? C.Green : C.TextDim, TextFormatFlags.Left);

            TextRenderer.DrawText(g, dc.ResourcesPath, F.MutedText,
                new Rectangle(tx, 52, Width - tx - 170, 14),
                C.TextDark, TextFormatFlags.Left | TextFormatFlags.EndEllipsis);

            string editionStr = "CUSTOM";
            Color edColor = C.TextDim;
            Color edBgColor = Color.FromArgb(20, C.TextDim);
            if (dc.Name.Contains("Stable")) { editionStr = "STABLE"; edColor = C.Blue; edBgColor = Color.FromArgb(30, C.Blue); }
            else if (dc.Name.Contains("Canary")) { editionStr = "CANARY"; edColor = C.Amber; edBgColor = Color.FromArgb(30, C.Amber); }
            else if (dc.Name.Contains("PTB")) { editionStr = "PTB"; edColor = C.Accent; edBgColor = Color.FromArgb(30, C.Accent); }
            else if (dc.Name.Contains("Dev")) { editionStr = "DEV"; edColor = C.Red; edBgColor = Color.FromArgb(30, C.Red); }

            var edSize = TextRenderer.MeasureText(editionStr, F.MutedText);
            bool injected = dc.HasEndcord();
            string statusStr = injected ? "ENDCORD" : "VANILLA";
            Color statusColor = injected ? C.Green : C.Amber;
            Color statusBgColor = injected ? Color.FromArgb(25, C.Green) : Color.FromArgb(25, C.Amber);
            var statusSize = TextRenderer.MeasureText(statusStr, F.MutedText);

            int margin = 16;
            int badgeY = (Height - 24) / 2;

            int statusW = statusSize.Width + 18;
            var statusRect = new Rectangle(Width - statusW - margin, badgeY, statusW, 24);

            int edW = edSize.Width + 16;
            var edRect = new Rectangle(statusRect.Left - edW - 8, badgeY, edW, 24);

            // Edition capsule
            Gfx.FillRoundRect(g, edRect, 6, edBgColor);
            Gfx.DrawRoundRect(g, edRect, 6, Color.FromArgb(120, edColor), 1f);
            TextRenderer.DrawText(g, editionStr, F.MutedText, edRect, edColor,
                TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);

            // Status capsule
            Gfx.FillRoundRect(g, statusRect, 6, statusBgColor);
            Gfx.DrawRoundRect(g, statusRect, 6, Color.FromArgb(120, statusColor), 1f);
            TextRenderer.DrawText(g, statusStr, F.MutedText, statusRect, statusColor,
                TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
        }
    }

    class CustomCheckBox : Control
    {
        bool _checked = false;
        bool _hov = false;
        float _hoverAnim = 0f;
        float _checkAnim = 0f;

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

            _hoverAnim = Gfx.Approach(_hoverAnim, _hov ? 1f : 0f, 0.12f);
            _checkAnim = Gfx.Approach(_checkAnim, _checked ? 1f : 0f, 0.14f);

            var chkRect = new Rectangle(0, 3, 16, 16);

            // Unchecked base
            Color borderC = Color.FromArgb(
                (int)(C.TextDark.R + (C.TextDim.R - C.TextDark.R) * _hoverAnim),
                (int)(C.TextDark.G + (C.TextDim.G - C.TextDark.G) * _hoverAnim),
                (int)(C.TextDark.B + (C.TextDim.B - C.TextDark.B) * _hoverAnim));
            Gfx.DrawRoundRect(g, chkRect, 4, borderC, 1.5f);

            // Checked fill & checkmark (smoothly fading in)
            if (_checkAnim > 0.01f)
            {
                int chkA = (int)(255 * _checkAnim);
                Gfx.FillRoundRect(g, chkRect, 4, Color.FromArgb(chkA, C.Accent));
                using (var p = new Pen(Color.FromArgb(chkA, Color.White), 2f))
                {
                    p.StartCap = LineCap.Round;
                    p.EndCap = LineCap.Round;
                    p.LineJoin = LineJoin.Round;
                    g.DrawLine(p, 3, 10, 6, 13);
                    g.DrawLine(p, 6, 13, 12, 6);
                }
            }

            Color textC = Color.FromArgb(
                (int)(C.TextDim.R + (255 - C.TextDim.R) * _hoverAnim),
                (int)(C.TextDim.G + (255 - C.TextDim.G) * _hoverAnim),
                (int)(C.TextDim.B + (255 - C.TextDim.B) * _hoverAnim));
            TextRenderer.DrawText(g, Text, F.LabelText, new Rectangle(24, 0, Width - 24, Height),
                textC, TextFormatFlags.VerticalCenter | TextFormatFlags.Left);
        }
    }

    class CustomLink : Control
    {
        bool _hov = false;
        float _hoverAnim = 0f;

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

            _hoverAnim = Gfx.Approach(_hoverAnim, _hov ? 1f : 0f, 0.12f);

            Color linkCol = Color.FromArgb(
                (int)(C.TextDim.R + (C.AccentLight.R - C.TextDim.R) * _hoverAnim),
                (int)(C.TextDim.G + (C.AccentLight.G - C.TextDim.G) * _hoverAnim),
                (int)(C.TextDim.B + (C.AccentLight.B - C.TextDim.B) * _hoverAnim));
            TextRenderer.DrawText(g, Text, F.Subtitle, new Rectangle(0, 0, Width, Height),
                linkCol, TextFormatFlags.VerticalCenter | TextFormatFlags.Right);
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

                    float sweep = (Gfx.GlobalTick * 150) % (Width + 60) - 30;
                    if (sweep >= 0 && sweep < w)
                    {
                        var shimmerRect = new Rectangle((int)sweep, (Height - 6) / 2, 30, 6);
                        try
                        {
                            using (var sb = new LinearGradientBrush(shimmerRect, Color.Transparent, Color.FromArgb(180, Color.White), 0f))
                            {
                                var blend = new ColorBlend(3);
                                blend.Colors = new Color[] { Color.Transparent, Color.FromArgb(180, Color.White), Color.Transparent };
                                blend.Positions = new float[] { 0f, 0.5f, 1f };
                                sb.InterpolationColors = blend;
                                g.FillRectangle(sb, shimmerRect);
                            }
                        }
                        catch { }
                    }
                }
            }
        }
    }

    class CustomActionButton : Control
    {
        bool _hov = false;
        bool _down = false;
        float _hoverAnim = 0f;
        float _pressAnim = 0f;
        float _clickRipple = 0f;

        public CustomActionButton(string text)
        {
            Text = text; Height = 44; Cursor = Cursors.Hand; DoubleBuffered = true;
            MouseEnter += (s, e) => { _hov = true; Invalidate(); };
            MouseLeave += (s, e) => { _hov = false; _down = false; Invalidate(); };
            MouseDown  += (s, e) => { _down = true; Invalidate(); };
            MouseUp    += (s, e) => { _down = false; _clickRipple = 1f; Invalidate(); };
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;

            _hoverAnim = Gfx.Approach(_hoverAnim, _hov ? 1f : 0f, 0.12f);
            _pressAnim = Gfx.Approach(_pressAnim, _down ? 1f : 0f, 0.2f);

            // Click ripple fade out
            if (_clickRipple > 0.01f)
            {
                _clickRipple -= 0.08f;
                if (_clickRipple < 0f) _clickRipple = 0f;
            }

            var r = new Rectangle(0, 0, Width - 1, Height - 1);
            if (!Enabled)
            {
                Gfx.FillRoundRect(g, r, 9, C.Border);
                TextRenderer.DrawText(g, Text, F.ButtonText, r, C.TextDark, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
                return;
            }

            float pulse = (float)(Math.Sin(Gfx.GlobalTick * 3) * 0.5 + 0.5);
            int glowA = (int)((15 + 10 * pulse) + (35 + 20 * pulse) * _hoverAnim + 30 * _clickRipple);
            Gfx.DrawGlow(g, r, 10, Color.FromArgb(glowA, C.AccentLight), 2, 2f);

            // Interpolate colors smoothly between normal, hover, and pressed states
            Color normalC1 = C.Accent;
            Color hoverC1 = C.AccentLight;
            Color pressC1 = C.AccentLo;

            Color normalC2 = C.AccentLo;
            Color hoverC2 = C.Accent;
            Color pressC2 = C.Accent;

            int c1R = (int)(normalC1.R + (hoverC1.R - normalC1.R) * _hoverAnim + (pressC1.R - normalC1.R) * _pressAnim);
            int c1G = (int)(normalC1.G + (hoverC1.G - normalC1.G) * _hoverAnim + (pressC1.G - normalC1.G) * _pressAnim);
            int c1B = (int)(normalC1.B + (hoverC1.B - normalC1.B) * _hoverAnim + (pressC1.B - normalC1.B) * _pressAnim);
            Color c1 = Color.FromArgb(Math.Max(0, Math.Min(255, c1R)), Math.Max(0, Math.Min(255, c1G)), Math.Max(0, Math.Min(255, c1B)));

            int c2R = (int)(normalC2.R + (hoverC2.R - normalC2.R) * _hoverAnim + (pressC2.R - normalC2.R) * _pressAnim);
            int c2G = (int)(normalC2.G + (hoverC2.G - normalC2.G) * _hoverAnim + (pressC2.G - normalC2.G) * _pressAnim);
            int c2B = (int)(normalC2.B + (hoverC2.B - normalC2.B) * _hoverAnim + (pressC2.B - normalC2.B) * _pressAnim);
            Color c2 = Color.FromArgb(Math.Max(0, Math.Min(255, c2R)), Math.Max(0, Math.Min(255, c2G)), Math.Max(0, Math.Min(255, c2B)));

            Gfx.FillGradientRoundRect(g, r, 10, c1, c2, 45f);

            // Click ripple / flash wave fading out
            if (_clickRipple > 0.01f)
            {
                int flashA = (int)(45 * _clickRipple);
                Gfx.FillRoundRect(g, r, 10, Color.FromArgb(flashA, Color.White));
            }

            if (_hoverAnim > 0.02f)
            {
                float sweep = (Gfx.GlobalTick * 160) % (Width + 80) - 40;
                if (sweep >= 0 && sweep < Width)
                {
                    int shimmerAlpha = (int)(50 * _hoverAnim);
                    var beamRect = new Rectangle((int)sweep, 0, 40, Height);
                    try
                    {
                        using (var sb = new LinearGradientBrush(beamRect, Color.Transparent, Color.FromArgb(shimmerAlpha, Color.White), 0f))
                        {
                            var blend = new ColorBlend(3);
                            blend.Colors = new Color[] { Color.Transparent, Color.FromArgb(shimmerAlpha, Color.White), Color.Transparent };
                            blend.Positions = new float[] { 0f, 0.5f, 1f };
                            sb.InterpolationColors = blend;
                            using (var path = Gfx.RoundRect(r, 10))
                            {
                                g.SetClip(path);
                                g.FillRectangle(sb, beamRect);
                                g.ResetClip();
                            }
                        }
                    }
                    catch { }
                }
            }

            int textOffsetY = _pressAnim > 0.5f ? 1 : 0;
            var textRect = new Rectangle(r.X, r.Y + textOffsetY, r.Width, r.Height);
            TextRenderer.DrawText(g, Text, F.ButtonText, textRect, Color.White, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
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
