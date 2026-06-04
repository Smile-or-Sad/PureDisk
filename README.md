# PureDisk - 零依赖极速原生磁盘清理大师 & 空间分析仪

<p align="center">
  <strong>一个超轻量、零外部依赖、高并发并行的 C 盘空间深度分析与安全一键清理工具。</strong>
</p>

---

## ✨ 核心特性 (Key Features)

- 🌐 **零依赖运行 (Zero Dependencies)**：不用安装任何 `npm` 包，`node_modules` 占用 0 字节，拉取或复制后即可直接双击启动，非常适合 C 盘爆满、无法安装大型依赖的紧急情况。
- ⚡ **超高性能并发扫描 (Parallel Deep Scan)**：
  - 后端扫描引擎采用原生 Node.js 异步并发重构，引入 **信号量限流控制（Semaphore，最大并发32）**。
  - 在完全压榨 SSD 随机读取性能、扫描速度提升 **5x 至 10x** 的同时，**彻底避免**了因并发文件过多触发的 `EMFILE`（句柄耗尽）报错。
- 🛡️ **软链接与联接点环路保护 (Junction Protection)**：
  - 自动通过 `fs.realpath` 对物理路径进行解析去重。
  - **100% 免疫** Windows 下类似 `AppData\Local\Application Data` 等循环软链接或文件夹联接（Junctions）导致的无限递归死循环。
- 📊 **现代霓虹磨砂玻璃仪表盘 (Glassmorphism UI)**：
  - 界面采用极具质感的深色磨砂玻璃（Glassmorphic）设计，伴有缓动的背景弥散发光光斑。
  - 主图表和状态 badges 使用原生 SVG 配合高斯模糊滤镜（`feGaussianBlur`），呈现炫酷的霓虹灯管质感。
- 📈 **自适应实时进度条 (Adaptive Progress Tracking)**：
  - 扫描进度条自动与 C 盘**已用总空间大小**进行自适应配对，进度百分比随着已扫描体积顺滑攀升，体验更加真实、美观。
- 🍰 **可视化占比指示条 (Percentage Bars)**：
  - 深度扫描检索出 Top 50 大文件与大文件夹时，会在列表项下方自动生成**空间占比进度条**（根据危险程度呈红色、黄色或青色），直观展示空间究竟被谁吞噬。
- 💬 **安全的一键清理与微信专清**：
  - 自动清空系统 `Temp`、`Logs`、浏览器缓存、Pip/Npm 缓存包等安全垃圾。
  - **微信专清**：智能定位微信的临时网络缓存、网页附件等，绝对不影响微信核心聊天记录和本地音视频文件，安全无副作用。
- 📂 **资源管理器联动**：
  - 网页端可一键定位大文件（直接在 Windows 文件资源管理器中打开并**自动高亮选中**该文件），或进行永久物理删除（跳过回收站）。

---

## 🚀 快速启动 (Quick Start)

使用本项目非常简单，只需您的电脑上安装了 [Node.js](https://nodejs.org/)（任何主流版本均可）：

### 1. Windows 用户（一键双击）
- 直接双击运行根目录下的 **`start.bat`** 即可！它会自动在后台启动服务，并自动拉起默认浏览器打开控制面板。

### 2. macOS / Linux 用户
1. 在终端赋予脚本执行权限并启动：
   ```bash
   chmod +x start.sh
   ./start.sh
   ```
2. 或者手动运行 node 服务：
   ```bash
   node server.js
   ```
   随后在浏览器中手动打开：**[http://localhost:3000](http://localhost:3000)**。

---

## 📂 项目结构 (Project Structure)

```text
├── public/
│   ├── index.html   # 精美玻璃拟态前端面板布局
│   ├── style.css    # 现代深色霓虹设计系统与动效样式
│   └── app.js       # 轮询状态、渲染及占比指示条计算等前端核心逻辑
├── server.js        # 零依赖本地服务端（并发控制、多维异步并行扫描、安全删除接口）
├── start.bat        # Windows 一键启动脚本
├── start.sh         # macOS/Linux 启动脚本
├── .gitignore       # Git 提交过滤配置文件（已忽略视频等大文件与本地缓存）
├── LICENSE          # 开源许可证文件 (MIT)
└── README.md        # 本说明文档
```

---

## ⚙️ 移植性说明 (Portability)

本项目已完成全面兼容性与移植性优化：
- **动态路径解析**：移除了所有硬编码用户名，通过 Node.js 原生 `os.homedir()` 动态获取当前计算机的 User Profile 目录，支持在任何 Windows 电脑上即拷即用。
- **跨平台基础结构**：核心磁盘扫描和文件管理接口针对 Windows 做了最佳原生调优（支持宽字符和中文路径），并且包含了在 macOS/Linux 上运行的基础兼容性 fallback。

---

## 🛠️ 推送到你的 GitHub 仓库 (Publish to GitHub)

1. 在网页端登录 [GitHub](https://github.com/)，创建一个名为 `PureDisk` 的新仓库。
2. 打开终端（Command Prompt / PowerShell / Git Bash），进入本项目所在的文件夹目录：
   ```bash
   # 初始化本地仓库
   git init

   # 将所有文件加入暂存区
   git add .

   # 提交到本地
   git commit -m "feat: init PureDisk zero-dependency disk analyzer"

   # 关联你的 GitHub 仓库 (将 <你的仓库URL> 替换为你在 GitHub 上创建的仓库链接)
   git remote add origin <你的仓库URL>

   # 推送代码到 GitHub
   git branch -M main
   git push -u origin main
   ```

---

## 📄 开源许可证 (License)

本项目采用 [MIT License](LICENSE) 开源许可证。
