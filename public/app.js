// State variables
let currentDiskData = null;
let quickScanResults = [];
let deepScanInterval = null;
let pendingDeletePath = null;
let pendingDeleteType = null; // 'file' or 'folder' or 'quick'
let userHomeDir = '';

// Helper: Format bytes to human readable string
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// DOM Elements
const diskFreeVal = document.getElementById('disk-free-val');
const diskUsedVal = document.getElementById('disk-used-val');
const diskTotalVal = document.getElementById('disk-total-val');
const chartPercentText = document.getElementById('chart-percent-text');
const circleProgressPath = document.getElementById('circle-progress-path');
const systemStatusDot = document.getElementById('system-status-dot');
const systemStatusText = document.getElementById('system-status-text');
const driveSelect = document.getElementById('drive-select');

const quickScanTargets = document.getElementById('quick-scan-targets');
const btnQuickScan = document.getElementById('btn-quick-scan');
const btnCleanSafe = document.getElementById('btn-clean-safe');
const btnCleanWechat = document.getElementById('btn-clean-wechat');

const scanPathInput = document.getElementById('scan-path-input');
const btnDeepScan = document.getElementById('btn-deep-scan');
const btnCancelScan = document.getElementById('btn-cancel-scan');

const progressPanel = document.getElementById('progress-panel');
const progressPhaseText = document.getElementById('progress-phase-text');
const progressPercentVal = document.getElementById('progress-percent-val');
const progressBarFill = document.getElementById('progress-bar-fill');
const progStatSize = document.getElementById('prog-stat-size');
const progStatFiles = document.getElementById('prog-stat-files');
const progStatFolders = document.getElementById('prog-stat-folders');
const progStatTime = document.getElementById('prog-stat-time');
const currentScanningFileText = document.getElementById('current-scanning-file-text');

const largeFoldersList = document.getElementById('large-folders-list');
const largeFilesList = document.getElementById('large-files-list');
const folderCountLbl = document.getElementById('folder-count-lbl');
const fileCountLbl = document.getElementById('file-count-lbl');

const confirmModal = document.getElementById('confirm-modal');
const modalTitleText = document.getElementById('modal-title-text');
const modalBodyWarnText = document.getElementById('modal-body-warn-text');
const modalTargetPath = document.getElementById('modal-target-path');
const modalBtnCancel = document.getElementById('modal-btn-cancel');
const modalBtnConfirm = document.getElementById('modal-btn-confirm');

// Initial Load
window.addEventListener('DOMContentLoaded', async () => {
  await fetchAvailableDrives();
  loadQuickScanInitial();
  setupEventListeners();
  await fetchUserInfo();
});

// Heartbeat mechanism to detect backend offline
let isOffline = false;
setInterval(async () => {
  try {
    const res = await fetch('/api/user-info');
    if (!res.ok) throw new Error('Not OK');
    if (isOffline) {
      isOffline = false;
      document.getElementById('offline-overlay').classList.remove('active');
      document.getElementById('offline-overlay').style.display = 'none';
      if (systemStatusText.textContent === '引擎离线') {
        setSystemStatus('系统准备就绪', 'idle');
      }
    }
  } catch (err) {
    if (!isOffline) {
      isOffline = true;
      document.getElementById('offline-overlay').style.display = 'flex';
      setTimeout(() => { document.getElementById('offline-overlay').classList.add('active'); }, 10);
      setSystemStatus('引擎离线', 'error');
    }
  }
}, 2000);

// Fetch available drives dynamically
async function fetchAvailableDrives() {
  try {
    const res = await fetch('/api/available-drives');
    const data = await res.json();
    if (data.success && data.drives) {
      driveSelect.innerHTML = '';
      data.drives.forEach(drv => {
        const opt = document.createElement('option');
        opt.value = drv.drive;
        opt.textContent = drv.label;
        if (drv.isSystem) {
          opt.selected = true;
        }
        driveSelect.appendChild(opt);
      });
      // Initial fetch for selected drive
      if (driveSelect.value) {
        fetchDiskSpace(driveSelect.value);
      }
    }
  } catch (err) {
    console.error('Failed to fetch available drives:', err);
    // fallback C
    fetchDiskSpace('C');
  }
}

// Fetch user home path dynamically
async function fetchUserInfo() {
  try {
    const res = await fetch('/api/user-info');
    const data = await res.json();
    if (data.success && data.homeDir) {
      userHomeDir = data.homeDir;
      const currentDrive = driveSelect.value || 'C';
      const systemDriveLetter = userHomeDir.charAt(0).toUpperCase();
      if (currentDrive.toUpperCase() === systemDriveLetter) {
        scanPathInput.value = userHomeDir;
        currentScanningFileText.textContent = `当前扫描：${userHomeDir}`;
      }
    }
  } catch (err) {
    console.error('Failed to fetch user info:', err);
  }
}

// Setup Listeners
function setupEventListeners() {
  btnQuickScan.addEventListener('click', runQuickScan);
  btnCleanSafe.addEventListener('click', runSafeCleanup);
  btnCleanWechat.addEventListener('click', runWeChatCleanup);
  btnDeepScan.addEventListener('click', startDeepScan);
  btnCancelScan.addEventListener('click', cancelDeepScan);

  // Drive select dropdown listener
  driveSelect.addEventListener('change', () => {
    const selectedDrive = driveSelect.value;
    fetchDiskSpace(selectedDrive);
    
    // Automatically set default scan path input
    const systemDriveLetter = userHomeDir ? userHomeDir.charAt(0).toUpperCase() : 'C';
    if (selectedDrive.toUpperCase() === systemDriveLetter) {
      scanPathInput.value = userHomeDir || 'C:\\';
    } else {
      scanPathInput.value = `${selectedDrive}:\\`;
    }
    currentScanningFileText.textContent = `当前扫描：${scanPathInput.value}`;
  });

  // Modal Cancel
  modalBtnCancel.addEventListener('click', () => {
    confirmModal.classList.remove('active');
    pendingDeletePath = null;
    pendingDeleteType = null;
  });

  // Modal Confirm
  modalBtnConfirm.addEventListener('click', executeDelete);
}

// 1. Fetch Disk Space Information
async function fetchDiskSpace(drive = 'C') {
  setSystemStatus('正在获取磁盘空间...', 'scanning');
  try {
    const res = await fetch(`/api/disk-space?drive=${drive}`);
    const data = await res.json();
    if (data.success) {
      currentDiskData = data;
      updateDiskUI(data);
      setSystemStatus('系统准备就绪', 'idle');
    } else {
      setSystemStatus('获取磁盘空间失败: ' + data.error, 'error');
    }
  } catch (err) {
    setSystemStatus('获取磁盘空间网络错误', 'error');
  }
}

function updateDiskUI(data) {
  const freeGB = (data.free / (1024 * 1024 * 1024)).toFixed(2);
  const usedGB = (data.used / (1024 * 1024 * 1024)).toFixed(2);
  const totalGB = (data.total / (1024 * 1024 * 1024)).toFixed(2);
  const percent = Math.round((data.used / data.total) * 100);

  diskFreeVal.textContent = `${freeGB} GB`;
  diskUsedVal.textContent = `${usedGB} GB`;
  diskTotalVal.textContent = `${totalGB} GB`;
  chartPercentText.textContent = `${percent}%`;

  // Circular Chart (36 size path is ~100 circumference)
  // set dasharray to: "percent, 100"
  circleProgressPath.setAttribute('stroke-dasharray', `${percent}, 100`);
}

function setSystemStatus(text, state) {
  systemStatusText.textContent = text;
  systemStatusDot.className = 'status-dot';
  if (state === 'scanning') {
    systemStatusDot.classList.add('scanning');
  } else if (state === 'error') {
    systemStatusDot.style.backgroundColor = 'var(--color-danger)';
    systemStatusDot.style.boxShadow = '0 0 8px var(--color-danger)';
  } else {
    systemStatusDot.style.backgroundColor = 'var(--color-safe)';
    systemStatusDot.style.boxShadow = '0 0 8px var(--color-safe)';
  }
}

// 2. Quick Scan & Targets Render
function loadQuickScanInitial() {
  quickScanTargets.innerHTML = `
    <div style="grid-column: span 2; text-align: center; padding: 2rem; color: var(--text-secondary);">
      请点击“扫描临时文件”开始分析
    </div>
  `;
}

async function runQuickScan() {
  btnQuickScan.disabled = true;
  btnQuickScan.textContent = '扫描中...';
  setSystemStatus('常规文件扫描中...', 'scanning');

  try {
    const selectedDrive = driveSelect.value || 'C';
    const res = await fetch(`/api/quick-scan?drive=${selectedDrive}`);
    const data = await res.json();
    if (data.success) {
      quickScanResults = data.targets;
      renderQuickScanTargets(data.targets);
      setSystemStatus('常规扫描完成', 'idle');
    } else {
      setSystemStatus('常规扫描失败: ' + data.error, 'error');
    }
  } catch (err) {
    setSystemStatus('常规扫描网络错误', 'error');
  } finally {
    btnQuickScan.disabled = false;
    btnQuickScan.textContent = '扫描临时文件';
  }
}

function renderQuickScanTargets(targets) {
  quickScanTargets.innerHTML = '';
  
  if (targets.length === 0) {
    quickScanTargets.innerHTML = '<div style="grid-column: span 2; text-align: center; padding: 1rem;">未找到任何清理项目</div>';
    return;
  }

  targets.forEach(target => {
    const card = document.createElement('div');
    card.className = 'target-card';

    const safeBadge = target.safeToClean 
      ? '<span class="target-status-badge badge-safe">安全清理</span>'
      : '<span class="target-status-badge badge-warn">建议手清</span>';

    const sizeStr = target.exists ? formatBytes(target.size) : '未检测到';
    const filesStr = target.exists ? `${target.fileCount} 个文件` : '';

    card.innerHTML = `
      <div class="target-info">
        <span class="target-name">${target.name}</span>
        <span class="target-path" title="${target.path}">${target.path}</span>
      </div>
      <div class="target-meta">
        <span class="target-size">${sizeStr}</span>
        <div style="display: flex; gap: 0.5rem; align-items: center; margin-top: 0.25rem;">
          <span style="font-size: 0.75rem; color: var(--text-secondary);">${filesStr}</span>
          ${safeBadge}
        </div>
      </div>
    `;

    quickScanTargets.appendChild(card);
  });
}

// 3. Safe Cleanup (One-click Clean)
async function runSafeCleanup() {
  if (confirm('确定要清除所有系统和应用缓存、临时文件吗？此操作将立即释放这些空间。')) {
    setSystemStatus('正在安全清理临时文件...', 'scanning');
    btnCleanSafe.disabled = true;
    try {
      const selectedDrive = driveSelect.value || 'C';
      const res = await fetch('/api/clean-safe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drive: selectedDrive })
      });
      const data = await res.json();
      if (data.success) {
        alert(`清理完成！共释放空间: ${formatBytes(data.deletedSize)}。成功删除 ${data.deletedCount} 个文件，${data.failedCount} 个文件由于被其他程序占用未删除。`);
        fetchDiskSpace();
        runQuickScan();
      } else {
        alert('清理失败: ' + data.error);
      }
    } catch (e) {
      alert('安全清理发生网络错误');
    } finally {
      btnCleanSafe.disabled = false;
      setSystemStatus('清理操作完成', 'idle');
    }
  }
}

// WeChat Cleanup Specific
async function runWeChatCleanup() {
  if (confirm('确定要清理微信临时缓存与附件吗？\n\n注意：此操作【仅删除】微信生成的临时网络缓存、网页附件等垃圾，【绝对不会】删除你的聊天记录、图片或视频文件。')) {
    setSystemStatus('微信缓存清理中...', 'scanning');
    btnCleanWechat.disabled = true;
    try {
      const res = await fetch('/api/clean-wechat', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert(`微信缓存清理完毕！共释放空间: ${formatBytes(data.deletedSize)}`);
        fetchDiskSpace();
        runQuickScan();
      } else {
        alert('清理失败: ' + data.error);
      }
    } catch (e) {
      alert('微信清理网络错误');
    } finally {
      btnCleanWechat.disabled = false;
      setSystemStatus('微信清理完成', 'idle');
    }
  }
}

// 4. Deep Scan Management
async function startDeepScan() {
  const scanPath = scanPathInput.value.trim();
  if (!scanPath) {
    alert('请输入需要扫描的目标路径！');
    return;
  }

  btnDeepScan.disabled = true;
  btnCancelScan.style.display = 'inline-flex';
  progressPanel.style.display = 'flex';
  setSystemStatus('深度分析大文件中...', 'scanning');

  try {
    const res = await fetch('/api/deep-scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: scanPath })
    });
    const data = await res.json();
    if (data.success) {
      // Start status polling
      if (deepScanInterval) clearInterval(deepScanInterval);
      deepScanInterval = setInterval(pollDeepScanStatus, 800);
    } else {
      alert('无法启动深度扫描: ' + data.error);
      resetDeepScanUI();
    }
  } catch (err) {
    alert('启动扫描网络错误');
    resetDeepScanUI();
  }
}

async function cancelDeepScan() {
  try {
    const res = await fetch('/api/deep-scan/cancel', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      clearInterval(deepScanInterval);
      resetDeepScanUI();
      setSystemStatus('深度扫描已被用户取消', 'idle');
    }
  } catch (e) {
    console.error('Cancel error:', e);
  }
}

function resetDeepScanUI() {
  btnDeepScan.disabled = false;
  btnCancelScan.style.display = 'none';
  progressBarFill.className = 'progress-bar-fill';
  setSystemStatus('深度扫描空闲', 'idle');
}

async function pollDeepScanStatus() {
  try {
    const res = await fetch('/api/deep-scan/status');
    const state = await res.json();

    // Update progress details
    const timeSpent = Math.round((Date.now() - state.startTime) / 1000);
    progStatTime.textContent = `${timeSpent}s`;
    progStatFiles.textContent = state.totalFiles;
    progStatFolders.textContent = state.totalFolders;
    progStatSize.textContent = formatBytes(state.totalSize);
    currentScanningFileText.textContent = `当前扫描：${state.progressPath}`;

    // Update progress UI indicator
    if (state.status === 'scanning') {
      progressPhaseText.textContent = '正在深度扫描目录树...';
      let percent = 0;
      if (currentDiskData && currentDiskData.used > 0) {
        percent = Math.min(99, Math.round((state.totalSize / currentDiskData.used) * 100));
        progressPercentVal.textContent = `${percent}%`;
        progressBarFill.style.width = `${percent}%`;
      } else {
        progressPercentVal.textContent = '正在分析';
        progressBarFill.style.width = '100%';
      }
      progressBarFill.className = 'progress-bar-fill scanning-anim';
    }

    // Render discovered lists dynamically during scan
    renderResultsLists(state.largestFolders, state.largestFiles, state.totalSize);

    if (state.status === 'completed') {
      clearInterval(deepScanInterval);
      progressPhaseText.textContent = '🎉 扫描完成！';
      progressPercentVal.textContent = '100%';
      progressBarFill.style.width = '100%';
      progressBarFill.className = 'progress-bar-fill';
      resetDeepScanUI();
      fetchDiskSpace();
      alert(`深度扫描完成！共分析了 ${state.totalFiles} 个文件，${state.totalFolders} 个文件夹，总容量: ${formatBytes(state.totalSize)}`);
    } else if (state.status === 'failed') {
      clearInterval(deepScanInterval);
      progressPhaseText.textContent = '❌ 扫描失败';
      progressPercentVal.textContent = '错误';
      progressBarFill.className = 'progress-bar-fill';
      alert('深度扫描发生错误: ' + state.error);
      resetDeepScanUI();
    }
  } catch (e) {
    console.error('Polling error:', e);
  }
}

// 5. Render Discovery Results Lists
function renderResultsLists(folders, files, totalSize) {
  // Folders list
  largeFoldersList.innerHTML = '';
  folderCountLbl.textContent = `共 ${folders.length} 个`;
  
  if (folders.length === 0) {
    largeFoldersList.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon">📂</span>
        <p>暂无扫描数据</p>
        <span class="empty-state-sub">在上方指定路径并启动“深度扫描”</span>
      </div>
    `;
  } else {
    folders.forEach(folder => {
      const item = createListItem(folder, 'folder', totalSize);
      largeFoldersList.appendChild(item);
    });
  }

  // Files list
  largeFilesList.innerHTML = '';
  fileCountLbl.textContent = `共 ${files.length} 个`;

  if (files.length === 0) {
    largeFilesList.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon">📄</span>
        <p>暂无扫描数据</p>
        <span class="empty-state-sub">在上方指定路径并启动“深度扫描”</span>
      </div>
    `;
  } else {
    files.forEach(file => {
      const item = createListItem(file, 'file', totalSize);
      largeFilesList.appendChild(item);
    });
  }
}

function createListItem(itemData, type, totalSize) {
  const div = document.createElement('div');
  div.className = 'list-item';

  const name = itemData.path.split('\\').pop() || itemData.path;
  const path = itemData.path;
  const size = itemData.size;

  let badgeClass = '';
  let barClass = 'normal';
  if (size > 1024 * 1024 * 1024) { // > 1 GB
    badgeClass = 'critical';
    barClass = 'critical';
  } else if (size > 200 * 1024 * 1024) { // > 200 MB
    badgeClass = 'high';
    barClass = 'high';
  }

  const percent = totalSize > 0 ? ((size / totalSize) * 100).toFixed(1) : 0;

  const iconMarkup = type === 'folder' 
    ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`
    : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>`;

  div.innerHTML = `
    <div class="item-row">
      <div class="item-left">
        <span class="item-name" title="${name}">${iconMarkup} <span class="item-text">${name}</span></span>
        <span class="item-path" title="${path}">${path}</span>
      </div>
      <div class="item-right">
        <span class="item-size-badge ${badgeClass}">${formatBytes(size)}</span>
        <div class="item-actions">
          <button class="icon-btn icon-btn-open" title="在文件资源管理器中打开/定位">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
          </button>
          <button class="icon-btn icon-btn-delete" title="永久删除此项目">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </div>
    </div>
    <div class="percent-bar-container">
      <div class="percent-bar-fill ${barClass}" style="width: ${percent}%;" title="占总扫描容量的 ${percent}%"></div>
    </div>
  `;

  // Bind events to buttons
  const btnOpen = div.querySelector('.icon-btn-open');
  const btnDelete = div.querySelector('.icon-btn-delete');

  btnOpen.addEventListener('click', () => openInExplorer(path));
  btnDelete.addEventListener('click', () => promptDelete(path, type));

  return div;
}

// Action: Open in Windows Explorer
async function openInExplorer(path) {
  try {
    const res = await fetch('/api/open-explorer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path })
    });
    const data = await res.json();
    if (!data.success) {
      alert('定位失败: ' + data.error);
    }
  } catch (err) {
    alert('打开文件管理器发生网络错误');
  }
}

// Action: Delete Item Trigger Modal
function promptDelete(path, type) {
  pendingDeletePath = path;
  pendingDeleteType = type;

  modalTitleText.textContent = type === 'folder' ? '⚠️ 确认永久删除整个文件夹吗？' : '⚠️ 确认永久删除此文件吗？';
  modalBodyWarnText.innerHTML = `
    此操作将把以下项目<strong>彻底从电脑中删除</strong>，不经过回收站且不可找回！<br/>
    请务必确认这不是系统核心文件或运行必需品。
  `;
  modalTargetPath.textContent = path;
  confirmModal.classList.add('active');
}

// Execute Delete API Call
async function executeDelete() {
  if (!pendingDeletePath) return;

  confirmModal.classList.remove('active');
  const pathToDelete = pendingDeletePath;
  pendingDeletePath = null;

  setSystemStatus('正在删除项目...', 'scanning');

  try {
    const res = await fetch('/api/delete-item', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: pathToDelete })
    });
    const data = await res.json();
    if (data.success) {
      alert(`删除成功！共释放空间 ${formatBytes(data.deletedSize)}`);
      // Update disk values
      fetchDiskSpace();
      // Re-poll the scanner state to update the UI list or manually remove it
      pollDeepScanStatus();
    } else {
      alert('删除失败: ' + data.error);
    }
  } catch (e) {
    alert('删除请求网络错误');
  } finally {
    setSystemStatus('删除操作完成', 'idle');
  }
}
