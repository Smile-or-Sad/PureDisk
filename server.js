const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

const PORT = 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const USER_HOME = os.homedir();

// Global state for Deep Scan
let deepScanState = {
  status: 'idle', // 'idle', 'scanning', 'completed', 'failed'
  progressPath: '',
  totalFiles: 0,
  totalFolders: 0,
  totalSize: 0,
  largestFiles: [], // { path, size }
  largestFolders: [], // { path, size }
  error: null,
  startTime: null,
  endTime: null
};

// Helper: Run PowerShell command and get output
function runPowerShell(cmd) {
  return new Promise((resolve, reject) => {
    // Set execution policy and output encoding to UTF-8 to handle Chinese characters
    const fullCmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ${cmd}"`;
    exec(fullCmd, { encoding: 'utf8' }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

// Check C drive space
async function getDiskSpace() {
  const isWin = process.platform === 'win32';
  
  if (!isWin) {
    // Fallback for non-Windows platforms (e.g. macOS / Linux)
    try {
      return new Promise((resolve) => {
        exec("df -k /", (error, stdout) => {
          if (error) {
            resolve({ success: false, error: error.message });
            return;
          }
          const lines = stdout.trim().split('\n');
          if (lines.length > 1) {
            const parts = lines[1].replace(/\s+/g, ' ').split(' ');
            const total = parseInt(parts[1], 10) * 1024;
            const used = parseInt(parts[2], 10) * 1024;
            const free = parseInt(parts[3], 10) * 1024;
            resolve({ success: true, total, free, used });
          } else {
            resolve({ success: false, error: 'Failed to parse df output' });
          }
        });
      });
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  try {
    const output = await runPowerShell('Get-Volume -DriveLetter C | Select-Object Size, SizeRemaining | ConvertTo-Json');
    const data = JSON.parse(output);
    return {
      success: true,
      total: data.Size, // bytes
      free: data.SizeRemaining, // bytes
      used: data.Size - data.SizeRemaining
    };
  } catch (err) {
    console.error('Error getting disk space:', err);
    // Fallback using Get-PSDrive
    try {
      const output = await runPowerShell('Get-PSDrive C | Select-Object Used, Free | ConvertTo-Json');
      const data = JSON.parse(output);
      // PSDrive outputs in bytes
      const free = data.Free;
      const used = data.Used;
      const total = free + used;
      return { success: true, total, free, used };
    } catch (err2) {
      return { success: false, error: err2.message };
    }
  }
}

// Predefined Quick Scan Targets (resolved dynamically using USER_HOME)
const QUICK_SCAN_TARGETS = [
  {
    name: 'User Temp Files (用户临时文件)',
    path: path.join(USER_HOME, 'AppData', 'Local', 'Temp'),
    category: 'temp',
    safeToClean: true
  },
  {
    name: 'Windows Temp Files (系统临时文件)',
    path: 'C:\\Windows\\Temp',
    category: 'temp',
    safeToClean: true
  },
  {
    name: 'Windows Prefetch (预读取缓存)',
    path: 'C:\\Windows\\Prefetch',
    category: 'temp',
    safeToClean: true
  },
  {
    name: 'Windows Logs (系统日志)',
    path: 'C:\\Windows\\Logs',
    category: 'log',
    safeToClean: true
  },
  {
    name: 'Chrome Cache (谷歌浏览器缓存)',
    path: path.join(USER_HOME, 'AppData', 'Local', 'Google', 'Chrome', 'User Data', 'Default', 'Cache'),
    category: 'cache',
    safeToClean: true
  },
  {
    name: 'Edge Cache (微软浏览器缓存)',
    path: path.join(USER_HOME, 'AppData', 'Local', 'Microsoft', 'Edge', 'User Data', 'Default', 'Cache'),
    category: 'cache',
    safeToClean: true
  },
  {
    name: 'WeChat Update Cache (微信升级包残留)',
    path: path.join(USER_HOME, 'AppData', 'Roaming', 'Tencent', 'WeChat', 'All Users', 'config'),
    category: 'chat',
    safeToClean: true // Safely clean installer files (.apk)
  },
  {
    name: 'WeChat Files (微信文件/缓存)',
    path: path.join(USER_HOME, 'Documents', 'WeChat Files'),
    category: 'chat',
    safeToClean: false // WeChat files contain chat records, user needs manual cleanup
  },
  {
    name: 'User Downloads (下载文件夹)',
    path: path.join(USER_HOME, 'Downloads'),
    category: 'download',
    safeToClean: false
  },
  {
    name: 'Pip Package Cache (Python pip缓存)',
    path: path.join(USER_HOME, 'AppData', 'Local', 'pip', 'cache'),
    category: 'cache',
    safeToClean: true
  },
  {
    name: 'Npm Package Cache (Node npm缓存)',
    path: path.join(USER_HOME, 'AppData', 'Roaming', 'npm-cache'),
    category: 'cache',
    safeToClean: true
  }
];

// Helper: Scan folder size recursively (non-deep-scan variant for quick scan)
async function getDirectorySize(dirPath) {
  let totalSize = 0;
  let fileCount = 0;
  let errorOccurred = false;

  async function scan(currentPath) {
    try {
      const stats = await fs.promises.lstat(currentPath);
      if (stats.isSymbolicLink()) return; // Skip symlinks and junctions

      if (stats.isFile()) {
        totalSize += stats.size;
        fileCount++;
      } else if (stats.isDirectory()) {
        const entries = await fs.promises.readdir(currentPath);
        await Promise.all(entries.map(entry => scan(path.join(currentPath, entry))));
      }
    } catch (e) {
      errorOccurred = true; // Could be EACCES or ENOENT
    }
  }

  await scan(dirPath);
  return { totalSize, fileCount, errorOccurred };
}

// Quick Scan function
async function performQuickScan() {
  const results = [];
  for (const target of QUICK_SCAN_TARGETS) {
    if (fs.existsSync(target.path)) {
      const stats = await getDirectorySize(target.path);
      results.push({
        ...target,
        exists: true,
        size: stats.totalSize,
        fileCount: stats.fileCount,
        errorOccurred: stats.errorOccurred
      });
    } else {
      results.push({
        ...target,
        exists: false,
        size: 0,
        fileCount: 0
      });
    }
  }
  return results;
}

// Deep Scan Algorithm (incremental, updates state, handles large directories safely)
async function startDeepScan(rootPath) {
  if (deepScanState.status === 'scanning') return;

  deepScanState = {
    status: 'scanning',
    progressPath: rootPath,
    totalFiles: 0,
    totalFolders: 0,
    totalSize: 0,
    largestFiles: [],
    largestFolders: [],
    error: null,
    startTime: Date.now(),
    endTime: null
  };

  // We run this asynchronously to not block the response
  setTimeout(() => {
    runDeepScan(rootPath)
      .then(() => {
        deepScanState.status = 'completed';
        deepScanState.endTime = Date.now();
      })
      .catch(err => {
        console.error('Deep scan failed:', err);
        deepScanState.status = 'failed';
        deepScanState.error = err.message;
        deepScanState.endTime = Date.now();
      });
  }, 0);
}

// Concurrency control for I/O operations (Semaphore Pattern)
class Semaphore {
  constructor(max) {
    this.max = max;
    this.current = 0;
    this.waiting = [];
  }
  async acquire() {
    if (this.current < this.max) {
      this.current++;
      return;
    }
    await new Promise(resolve => this.waiting.push(resolve));
  }
  release() {
    this.current--;
    if (this.waiting.length > 0) {
      this.current++;
      const next = this.waiting.shift();
      next();
    }
  }
}

const fsSemaphore = new Semaphore(32); // Limit concurrent I/O operations to 32

async function limitIO(fn) {
  await fsSemaphore.acquire();
  try {
    return await fn();
  } finally {
    fsSemaphore.release();
  }
}

async function runDeepScan(rootPath) {
  const maxFilesToKeep = 100;
  const maxFoldersToKeep = 100;
  const filesList = [];
  const foldersList = [];
  const visited = new Set();

  async function processDirectory(dirPath) {
    if (deepScanState.status !== 'scanning') return 0;
    deepScanState.progressPath = dirPath;

    // Resolve symbolic links & junctions to prevent infinite circular loop recursion
    let realPath = dirPath;
    try {
      realPath = await limitIO(() => fs.promises.realpath(dirPath));
    } catch (e) {
      // Permission denied or missing
      return 0;
    }

    if (visited.has(realPath)) {
      return 0; // Already scanned this physical directory
    }
    visited.add(realPath);

    let dirSize = 0;
    let entries = [];
    try {
      entries = await limitIO(() => fs.promises.readdir(dirPath, { withFileTypes: true }));
    } catch (e) {
      // Permission denied or missing
      return 0;
    }

    deepScanState.totalFolders++;

    const subdirs = [];
    const statPromises = [];

    for (const entry of entries) {
      if (deepScanState.status !== 'scanning') return 0;
      const fullPath = path.join(dirPath, entry.name);
      
      try {
        if (entry.isSymbolicLink()) continue; // Skip junctions / symlinks

        if (entry.isFile()) {
          statPromises.push(
            limitIO(() => fs.promises.stat(fullPath))
              .then(stat => {
                const size = stat.size;
                dirSize += size;
                deepScanState.totalFiles++;
                deepScanState.totalSize += size;

                // Sync block style update (since Node is single-threaded, array operations are safe)
                if (filesList.length < maxFilesToKeep || size > filesList[filesList.length - 1].size) {
                  filesList.push({ path: fullPath, size });
                  filesList.sort((a, b) => b.size - a.size);
                  if (filesList.length > maxFilesToKeep) filesList.pop();
                }
              })
              .catch(e => {
                // Ignore stat errors for locked files
              })
          );
        } else if (entry.isDirectory()) {
          const lowerName = entry.name.toLowerCase();
          if (lowerName === '$recycle.bin' || lowerName === 'system volume information') {
            continue;
          }
          subdirs.push(fullPath);
        }
      } catch (e) {
        // Skip entry
      }
    }

    // Wait for file stats in this folder to resolve
    await Promise.all(statPromises);

    // Scan subdirectories in parallel
    if (subdirs.length > 0) {
      const subdirSizes = await Promise.all(subdirs.map(subdir => processDirectory(subdir)));
      for (const sz of subdirSizes) {
        dirSize += sz;
      }
    }

    // Insert directory size
    if (foldersList.length < maxFoldersToKeep || dirSize > foldersList[foldersList.length - 1].size) {
      foldersList.push({ path: dirPath, size: dirSize });
      foldersList.sort((a, b) => b.size - a.size);
      if (foldersList.length > maxFoldersToKeep) foldersList.pop();
    }

    // Keep state updated for the UI
    deepScanState.largestFiles = filesList.slice(0, 50);
    deepScanState.largestFolders = foldersList.slice(0, 50);

    return dirSize;
  }

  await processDirectory(rootPath);
}

// Clean Directory Helper (Deletes all contents but keeps the top directory)
async function cleanDirectoryContents(dirPath) {
  let deletedSize = 0;
  let deletedCount = 0;
  let failedCount = 0;

  async function remove(itemPath) {
    try {
      const stat = await fs.promises.lstat(itemPath);
      if (stat.isDirectory()) {
        const entries = await fs.promises.readdir(itemPath);
        for (const entry of entries) {
          await remove(path.join(itemPath, entry));
        }
        await fs.promises.rmdir(itemPath);
      } else {
        deletedSize += stat.size;
        await fs.promises.unlink(itemPath);
        deletedCount++;
      }
    } catch (e) {
      failedCount++;
    }
  }

  try {
    if (fs.existsSync(dirPath)) {
      const entries = await fs.promises.readdir(dirPath);
      for (const entry of entries) {
        await remove(path.join(dirPath, entry));
      }
    }
  } catch (e) {
    console.error(`Failed to clean directory contents of ${dirPath}:`, e.message);
  }
  return { deletedSize, deletedCount, failedCount };
}

// Safe Delete Path Checker
function isPathSafeForDeletion(targetPath) {
  const normalized = path.normalize(targetPath).toLowerCase();
  const normalizedHome = USER_HOME.toLowerCase();
  
  // Critical paths that must NEVER be deleted
  const dangerousPatterns = [
    /^c:\\$/,
    /^c:\\windows/i,
    /^c:\\program files/i,
    /^c:\\program files \(x86\)/i,
    /^c:\\users$/i,
    new RegExp('^' + normalizedHome.replace(/\\/g, '\\\\') + '$', 'i'), // Don't delete the whole user home folder!
    /^c:\\users\\public/i,
    /system32/i,
    /syswow64/i
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(normalized)) {
      return false;
    }
  }
  return true;
}

// Clean WeChat Files Safely (Cleans temporary/cache subdirectories of WeChat but NOT chat records)
async function cleanWeChatTemp() {
  const wechatBase = path.join(USER_HOME, 'Documents', 'WeChat Files');
  if (!fs.existsSync(wechatBase)) return { deletedSize: 0, deletedCount: 0, failedCount: 0 };

  let totalDeletedSize = 0;
  let totalDeletedCount = 0;
  let totalFailedCount = 0;

  try {
    const accounts = await fs.promises.readdir(wechatBase);
    for (const account of accounts) {
      // WeChat accounts folders are usually like "wxid_xxxx" or custom IDs. Skip All Users and Applet
      if (account === 'All Users' || account === 'Applet' || account.includes('.')) continue;

      // Typical WeChat temp paths:
      // WeChat Files\wxid_xxx\Attachment
      // WeChat Files\wxid_xxx\FileStorage\Cache
      // WeChat Files\wxid_xxx\FileStorage\Temp
      const tempPaths = [
        path.join(wechatBase, account, 'Attachment'),
        path.join(wechatBase, account, 'FileStorage', 'Cache'),
        path.join(wechatBase, account, 'FileStorage', 'Temp')
      ];

      for (const p of tempPaths) {
        if (fs.existsSync(p)) {
          const res = await cleanDirectoryContents(p);
          totalDeletedSize += res.deletedSize;
          totalDeletedCount += res.deletedCount;
          totalFailedCount += res.failedCount;
        }
      }
    }
  } catch (err) {
    console.error('Error cleaning WeChat temp:', err);
  }

  return { deletedSize: totalDeletedSize, deletedCount: totalDeletedCount, failedCount: totalFailedCount };
}

// Create HTTP Server
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const method = req.method;

  // JSON response helper
  const sendJSON = (statusCode, data) => {
    res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
  };

  // Serve static files
  if (method === 'GET' && (url.pathname === '/' || url.pathname.startsWith('/public/'))) {
    let filePath = url.pathname === '/' ? path.join(PUBLIC_DIR, 'index.html') : path.join(__dirname, url.pathname);
    
    // Safety check for path traversal
    if (!filePath.startsWith(PUBLIC_DIR) && filePath !== path.join(PUBLIC_DIR, 'index.html')) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Access Denied');
      return;
    }

    fs.readFile(filePath, (err, content) => {
      if (err) {
        if (err.code === 'ENOENT') {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('404 Not Found');
        } else {
          res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end(`Server Error: ${err.code}`);
        }
      } else {
        const ext = path.extname(filePath);
        let contentType = 'text/html';
        if (ext === '.css') contentType = 'text/css';
        if (ext === '.js') contentType = 'application/javascript';
        res.writeHead(200, { 'Content-Type': `${contentType}; charset=utf-8` });
        res.end(content);
      }
    });
    return;
  }

  // --- API Routes ---

  // 0. Get dynamic user info
  if (method === 'GET' && url.pathname === '/api/user-info') {
    sendJSON(200, { success: true, homeDir: USER_HOME });
    return;
  }

  // 1. Get disk space
  if (method === 'GET' && url.pathname === '/api/disk-space') {
    const space = await getDiskSpace();
    sendJSON(space.success ? 200 : 500, space);
    return;
  }

  // 2. Run Quick Scan
  if (method === 'GET' && url.pathname === '/api/quick-scan') {
    try {
      const results = await performQuickScan();
      sendJSON(200, { success: true, targets: results });
    } catch (e) {
      sendJSON(500, { success: false, error: e.message });
    }
    return;
  }

  // 3. Start Deep Scan
  if (method === 'POST' && url.pathname === '/api/deep-scan') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const params = JSON.parse(body || '{}');
        const scanPath = params.path || USER_HOME;
        
        if (!fs.existsSync(scanPath)) {
          sendJSON(400, { success: false, error: 'Path does not exist' });
          return;
        }

        await startDeepScan(scanPath);
        sendJSON(200, { success: true, message: 'Scan started' });
      } catch (e) {
        sendJSON(500, { success: false, error: e.message });
      }
    });
    return;
  }

  // 4. Poll Deep Scan status
  if (method === 'GET' && url.pathname === '/api/deep-scan/status') {
    sendJSON(200, deepScanState);
    return;
  }

  // 5. Cancel Deep Scan
  if (method === 'POST' && url.pathname === '/api/deep-scan/cancel') {
    if (deepScanState.status === 'scanning') {
      deepScanState.status = 'idle';
      deepScanState.error = 'Cancelled by user';
    }
    sendJSON(200, { success: true, state: deepScanState });
    return;
  }

  // 6. Clean safe temp files (Quick Cleanup)
  if (method === 'POST' && url.pathname === '/api/clean-safe') {
    try {
      let totalDeletedSize = 0;
      let totalDeletedCount = 0;
      let totalFailedCount = 0;
      const details = [];

      for (const target of QUICK_SCAN_TARGETS) {
        if (target.safeToClean && fs.existsSync(target.path)) {
          const res = await cleanDirectoryContents(target.path);
          totalDeletedSize += res.deletedSize;
          totalDeletedCount += res.deletedCount;
          totalFailedCount += res.failedCount;
          details.push({
            name: target.name,
            path: target.path,
            deletedSize: res.deletedSize,
            deletedCount: res.deletedCount,
            failedCount: res.failedCount
          });
        }
      }

      sendJSON(200, {
        success: true,
        deletedSize: totalDeletedSize,
        deletedCount: totalDeletedCount,
        failedCount: totalFailedCount,
        details
      });
    } catch (e) {
      sendJSON(500, { success: false, error: e.message });
    }
    return;
  }

  // 7. Clean WeChat Temp files only (safe part of WeChat)
  if (method === 'POST' && url.pathname === '/api/clean-wechat') {
    try {
      const res = await cleanWeChatTemp();
      sendJSON(200, {
        success: true,
        ...res
      });
    } catch (e) {
      sendJSON(500, { success: false, error: e.message });
    }
    return;
  }

  // 8. Delete a specific file/folder
  if (method === 'POST' && url.pathname === '/api/delete-item') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const params = JSON.parse(body || '{}');
        const targetPath = params.path;

        if (!targetPath) {
          sendJSON(400, { success: false, error: 'Path is required' });
          return;
        }

        if (!fs.existsSync(targetPath)) {
          sendJSON(400, { success: false, error: 'File or folder does not exist' });
          return;
        }

        if (!isPathSafeForDeletion(targetPath)) {
          sendJSON(403, { success: false, error: 'Access Denied: System critical directory protection' });
          return;
        }

        const stat = await fs.promises.stat(targetPath);
        let size = 0;

        if (stat.isFile()) {
          size = stat.size;
          await fs.promises.unlink(targetPath);
        } else if (stat.isDirectory()) {
          // Compute size before deletion for report
          const stats = await getDirectorySize(targetPath);
          size = stats.totalSize;
          await fs.promises.rm(targetPath, { recursive: true, force: true });
        }

        sendJSON(200, { success: true, deletedSize: size, path: targetPath });
      } catch (e) {
        sendJSON(500, { success: false, error: e.message });
      }
    });
    return;
  }

  // 9. Open a folder in Windows Explorer
  if (method === 'POST' && url.pathname === '/api/open-explorer') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const params = JSON.parse(body || '{}');
        const folderPath = params.path;

        if (!folderPath) {
          sendJSON(400, { success: false, error: 'Path is required' });
          return;
        }

        if (!fs.existsSync(folderPath)) {
          sendJSON(400, { success: false, error: 'Path does not exist' });
          return;
        }

        const normalizedPath = path.normalize(folderPath);
        
        // Open file or directory in explorer. If it's a file, select it in explorer
        let command = `explorer.exe "${normalizedPath}"`;
        const stat = await fs.promises.stat(normalizedPath);
        if (stat.isFile()) {
          command = `explorer.exe /select,"${normalizedPath}"`;
        }

        exec(command);
        sendJSON(200, { success: true });
      } catch (e) {
        sendJSON(500, { success: false, error: e.message });
      }
    });
    return;
  }

  // Default fallback
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404 Not Found');
});

server.listen(PORT, () => {
  console.log(`PureDisk Server running at http://localhost:${PORT}`);
});
