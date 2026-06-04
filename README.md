# PureDisk

PureDisk is a lightweight, zero-dependency, highly concurrent disk scanning, space analysis, and cleanup tool.
PureDisk 是一款超轻量、零依赖、高并发的磁盘扫描、空间分析与清理工具。

---

## English

### Core Features

- Zero Dependencies: Runs out of the box with zero npm packages and a 0-byte node_modules folder.
- High-Performance Scanning: Built with native asynchronous file operations and optimized concurrency control using semaphores to prevent file descriptor exhaustion.
- Loop Prevention: Automatically resolves physical paths to prevent infinite recursion caused by Windows folder junction points.
- Modern Glassmorphism Dashboard: Premium dark-mode user interface with blurred background highlights, featuring SVG-based status displays and visual components.
- Adaptive Progress Tracking: Real-time scan progress calculated dynamically against total used C drive space.
- Visualization Bars: Automatically generates percentage bars for the top 50 largest files and folders.
- Safe One-Click Cleanup: Safely deletes temporary directory files, system logs, browser cache, and package manager cache.
- WeChat Cleanup: Targets WeChat cache, temporary files, and downloaded attachments without affecting chat logs or media database.
- Explorer Integration: Open file locations directly in Windows Explorer, highlighting selected items, or permanently delete files.

### Quick Start

Ensure Node.js is installed on your computer.

#### Windows
- Double-click `start.bat` in the root directory to run the server and open the dashboard in your default browser.

#### macOS & Linux
1. Grant execute permissions and run the script:
   ```bash
   chmod +x start.sh
   ./start.sh
   ```
2. Or run the server manually:
   ```bash
   node server.js
   ```
   Open `http://localhost:3000` in your web browser.

### Project Structure

```text
├── public/
│   ├── index.html   # Dashboard layout
│   ├── style.css    # Modern glassmorphism styling
│   └── app.js       # Status polling, rendering, and logic
├── server.js        # Zero-dependency local backend server
├── start.bat        # Windows launcher script
├── start.sh         # macOS & Linux launcher script
├── .gitignore       # Git exclusion configurations
├── LICENSE          # MIT license file
└── README.md        # Description document
```

### Portability and Compatibility

- Dynamic Path Resolution: Dynamically resolves user directory paths instead of hardcoded paths.
- Cross-Platform Base: Core scanning is optimized for Windows with compatibility built-in for macOS and Linux.

---

## 中文

### 核心特性

- 零依赖运行：无需安装任何 npm 依赖包，node_modules 占用 0 字节，非常适合紧急磁盘空间释放场景。
- 高并发扫描：基于原生异步文件操作，并内置信号量并发限流，避免因并发文件过多触发句柄耗尽报错。
- 环路保护：自动解析物理路径，防止 Windows 文件夹联接点引起无限循环。
- 霓虹磨砂玻璃仪表盘：极具质感的深色磨砂玻璃设计，背景发光光斑，搭配 SVG 与高斯模糊滤镜。
- 自适应进度：扫描进度与已用空间动态关联，百分比随扫描体积顺滑上升。
- 可视化占比：Top 50 大文件与大文件夹列表自带空间占比指示条，直观展示空间分配。
- 安全清理：清理系统临时文件、日志、浏览器缓存和包管理器缓存等垃圾。
- 微信专清：精准清除微信缓存与临时文件，不影响聊天记录和本地音视频文件。
- 文件管理器联动：网页端支持一键在文件资源管理器中定位并选中文件，或进行物理删除。

### 快速启动

请确保系统已安装 Node.js。

#### Windows 用户
- 双击运行根目录下的 `start.bat` 即可，会自动启动服务并拉起默认浏览器。

#### macOS 与 Linux 用户
1. 赋予执行权限并运行：
   ```bash
   chmod +x start.sh
   ./start.sh
   ```
2. 或手动运行：
   ```bash
   node server.js
   ```
   然后打开浏览器访问 `http://localhost:3000`。

### 项目结构

```text
├── public/
│   ├── index.html   # 分析仪前端布局
│   ├── style.css    # 现代深色磨砂玻璃设计系统与样式
│   └── app.js       # 轮询状态、渲染及占比指示条计算等前端核心逻辑
├── server.js        # 零依赖本地服务端
├── start.bat        # Windows 一键启动脚本
├── start.sh         # macOS 与 Linux 启动脚本
├── .gitignore       # Git 提交过滤配置文件
├── LICENSE          # 开源许可证文件
└── README.md        # 本说明文档
```

### 移植性说明

- 动态路径解析：通过原生获取当前用户目录，无任何硬编码路径，支持在不同电脑上即拷即用。
- 跨平台支持：核心接口针对 Windows 优化，同时兼容 macOS 和 Linux 系统。

---

## License / 开源许可证

MIT License
