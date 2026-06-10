let currentRunState = { running: false };
let addingSite = false;
const sitesRenderGuard = createLatestRenderGuard();

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', () => {
  loadStatus();
  setupEventListeners();
  chrome.storage.onChanged.addListener(handleStorageChange);
});

function setupEventListeners() {
  document.getElementById('checkInBtn').addEventListener('click', handleManualCheckIn);
  document.getElementById('showAddBtn').addEventListener('click', () => {
    document.getElementById('addForm').classList.toggle('show');
    document.getElementById('newDomain').focus();
  });
  document.getElementById('confirmAddBtn').addEventListener('click', handleAddSite);
  document.getElementById('cancelAddBtn').addEventListener('click', () => {
    document.getElementById('addForm').classList.remove('show');
    resetAddForm();
  });
  document.getElementById('newDomain').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleAddSite();
  });

  // 导出/导入
  document.getElementById('exportBtn').addEventListener('click', handleExport);
  document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('importFile').click();
  });
  document.getElementById('importFile').addEventListener('change', handleImport);
  document.getElementById('saveTimeBtn').addEventListener('click', handleSaveAutoSignTime);
}

// 加载签到状态
function loadStatus() {
  chrome.runtime.sendMessage({ action: 'getStatus' }, (response) => {
    if (response) {
      const results = response.checkInResults || {};
      currentRunState = getCheckInRunState({ checkInRunState: response.checkInRunState });
      updateStats(results);
      renderSites(results);
    }
    if (response?.lastCheckInTime) {
      document.getElementById('lastCheck').textContent =
        `上次签到: ${formatDateTime(new Date(response.lastCheckInTime))}`;
    }
    if (response?.autoSignTime) {
      setAutoSignTimeDisplay(response.autoSignTime);
    }
  });
}

function handleStorageChange(changes, areaName) {
  if (areaName !== 'local') return;

  if (changes.checkInResults) {
    const results = changes.checkInResults.newValue || {};
    updateStats(results);
    renderSites(results, { preserveScroll: true });
  }

  if (changes.checkInRunState) {
    currentRunState = getCheckInRunState({ checkInRunState: changes.checkInRunState.newValue });
    updateCheckInButtonState();
  }

  if (changes.userSites) {
    renderSites(undefined, { preserveScroll: true });
  }

  if (changes.lastCheckInTime?.newValue) {
    document.getElementById('lastCheck').textContent =
      `上次签到: ${formatDateTime(new Date(changes.lastCheckInTime.newValue))}`;
  }
}

// 渲染站点列表
async function renderSites(results, { preserveScroll = false } = {}) {
  const renderToken = sitesRenderGuard.begin();
  const scrollContainer = document.scrollingElement || document.documentElement;
  const scrollTop = preserveScroll ? scrollContainer.scrollTop : 0;
  const sites = await loadRawSites();

  // 如果没传 results，从 storage 读取上次结果
  if (!results) {
    const data = await chrome.storage.local.get('checkInResults');
    results = data.checkInResults || {};
  }

  if (!sitesRenderGuard.isCurrent(renderToken)) return;

  const sitesList = document.getElementById('sitesList');
  document.getElementById('totalSites').textContent = sites.filter(s => s.enabled !== false).length;
  updateCheckInButtonState(sites);

  if (sites.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = '暂无站点，添加后即可开始签到';
    sitesList.replaceChildren(empty);
    return;
  }

  const fragment = document.createDocumentFragment();

  sites.forEach((site, index) => {
    const siteId = site.domain.replace(/\./g, '_');
    const result = results[siteId];
    const enabled = site.enabled !== false;

    const item = document.createElement('div');
    item.className = 'site-item';
    item.dataset.domain = site.domain;
    if (!enabled) item.style.opacity = '0.5';

    // 开关
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.className = 'toggle';
    toggle.checked = enabled;
    toggle.title = enabled ? '点击禁用' : '点击启用';
    toggle.addEventListener('change', () => toggleSite(index, toggle.checked));

    // 站点名
    const name = document.createElement('button');
    name.type = 'button';
    name.className = 'site-name site-link';
    name.textContent = site.name || site.domain;
    name.title = `打开 ${getSitePageUrl(site)}`;
    name.addEventListener('click', () => openSitePage(site));

    // 状态
    const canRetry = enabled && canRetrySiteStatus(result?.status);
    const status = document.createElement(canRetry ? 'button' : 'span');
    status.className = 'site-status';
    if (canRetry) {
      status.type = 'button';
      status.classList.add('retryable');
      status.title = result?.message ? `${result.message}，点击重试` : '点击签到该站点';
      status.addEventListener('click', () => handleRetrySite(siteId));
    }
    if (result) {
      const view = getStatusView(result.status);
      status.classList.add(view.className);
      status.textContent = view.text;
      if (result.message && !canRetry) {
        status.title = result.message;
      }
    } else {
      status.classList.add('pending');
      status.textContent = enabled ? '待签' : '禁用';
    }

    // 模式/类型
    const mode = document.createElement('span');
    mode.className = 'site-mode';
    if (site.mode === 'visit') {
      mode.classList.add('visit');
      mode.textContent = '访问';
    } else {
      mode.textContent = '自动';
    }

    const balance = document.createElement('span');
    balance.className = 'site-balance';
    if (result?.balance) {
      balance.textContent = result.balance;
      balance.title = `余额: ${result.balance}`;
    }

    // 删除按钮
    const del = document.createElement('button');
    del.className = 'btn-del';
    del.textContent = '\u00d7';
    del.title = '删除站点';
    del.addEventListener('click', () => removeSite(index));

    item.appendChild(toggle);
    item.appendChild(mode);
    item.appendChild(name);
    if (result?.balance) item.appendChild(balance);
    item.appendChild(status);
    item.appendChild(del);
    fragment.appendChild(item);
  });

  sitesList.replaceChildren(fragment);

  if (preserveScroll) {
    requestAnimationFrame(() => {
      if (sitesRenderGuard.isCurrent(renderToken)) {
        scrollContainer.scrollTop = scrollTop;
      }
    });
  }
}

// 更新统计数字
function updateStats(results) {
  const vals = Object.values(results);
  document.getElementById('successCount').textContent = vals.filter(r => r.status === 'success').length;
  document.getElementById('alreadyCount').textContent = vals.filter(r => r.status === 'already').length;
  document.getElementById('failedCount').textContent = vals.filter(r => r.status === 'failed' || r.status === 'invalid').length;
}

function getStatusView(status) {
  if (status === 'success') return { className: 'success', text: '成功' };
  if (status === 'already') return { className: 'already', text: '已签' };
  if (status === 'checking') return { className: 'checking', text: '签到中' };
  if (status === 'invalid') return { className: 'invalid', text: '失效' };
  return { className: 'failed', text: '失败' };
}

function canRetrySiteStatus(status) {
  return !status || status === 'failed' || status === 'invalid';
}

// 添加站点
async function handleAddSite() {
  if (addingSite) return;
  addingSite = true;
  const confirmAddBtn = document.getElementById('confirmAddBtn');
  confirmAddBtn.disabled = true;

  const input = document.getElementById('newDomain');
  const mode = getSelectedSiteMode();
  try {
    const site = parseSiteInput(input.value, mode);

    if (!site) {
      alert('请输入有效的签到页链接，如 c.com/console/personal');
      return;
    }

    const sites = await loadRawSites();
    if (sites.some(s => String(s.domain || '').toLowerCase() === site.domain)) {
      alert('该站点已存在');
      return;
    }

    sites.push(site);
    await saveSitesConfig(sites);

    resetAddForm();
    document.getElementById('addForm').classList.remove('show');
    renderSites();
  } finally {
    addingSite = false;
    confirmAddBtn.disabled = false;
  }
}

function getSelectedSiteMode() {
  return document.getElementById('visitOnly').checked ? 'visit' : 'checkin';
}

function resetAddForm() {
  document.getElementById('newDomain').value = '';
  document.getElementById('visitOnly').checked = false;
}

function openSitePage(site) {
  chrome.tabs.create(getSiteTabCreateOptions(site));
}

// 切换启用/禁用
async function toggleSite(index, enabled) {
  const sites = await loadRawSites();
  if (sites[index]) {
    sites[index].enabled = enabled;
    await saveSitesConfig(sites);
    await renderSites(undefined, { preserveScroll: true });
  }
}

// 删除站点
async function removeSite(index) {
  const sites = await loadRawSites();
  const site = sites[index];
  if (!site) return;

  if (!confirm(`确定删除 ${getSiteDisplayName(site)}？`)) return;

  sites.splice(index, 1);
  await saveSitesConfig(sites);
  renderSites();
}

function getSiteDisplayName(site) {
  return site.name || site.domain;
}

// 手动签到
async function handleManualCheckIn() {
  const sites = await loadRawSites();
  if (isCheckInRunningState(currentRunState)) {
    await cancelCurrentCheckIn(sites);
    return;
  }

  if (!canStartCheckIn(sites, currentRunState)) {
    updateCheckInButtonState(sites);
    return;
  }

  currentRunState = buildCheckInRunningState({ total: countEnabledSites(sites), source: 'manual' });
  updateCheckInButtonState(sites);
  showLoading();

  try {
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: 'manualCheckIn' }, (response) => {
        if (response?.success) resolve(response);
        else reject(new Error(response?.error || '签到失败'));
      });
    });

    updateStats(response.results || {});
    renderSites(response.results || {});
    if (!response.running) {
      document.getElementById('lastCheck').textContent = `上次签到: ${formatDateTime(new Date())}`;
    }
  } catch (error) {
    alert('签到失败: ' + error.message);
  } finally {
    const data = await chrome.storage.local.get('checkInRunState');
    currentRunState = getCheckInRunState(data);
    await updateCheckInButtonState();
  }
}

async function cancelCurrentCheckIn(sites) {
  const btn = document.getElementById('checkInBtn');
  const btnText = document.getElementById('btnText');
  btn.disabled = true;
  btnText.textContent = '正在终止...';
  btn.title = '正在终止当前签到任务';

  try {
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: 'cancelCheckIn' }, (response) => {
        if (response?.success) resolve(response);
        else reject(new Error(response?.error || '终止失败'));
      });
    });

    if (response.runState) {
      currentRunState = getCheckInRunState({ checkInRunState: response.runState });
    }
    if (response.results) {
      updateStats(response.results);
      renderSites(response.results, { preserveScroll: true });
    }
  } catch (error) {
    alert('终止失败: ' + error.message);
  } finally {
    const data = await chrome.storage.local.get('checkInRunState');
    currentRunState = getCheckInRunState(data);
    await updateCheckInButtonState(sites);
  }
}

async function handleRetrySite(siteId) {
  if (!siteId || isCheckInRunningState(currentRunState)) return;

  const data = await chrome.storage.local.get('checkInResults');
  const currentResults = data.checkInResults || {};
  const checkingResults = markSiteChecking(currentResults, siteId);
  updateStats(checkingResults);
  renderSites(checkingResults, { preserveScroll: true });

  try {
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: 'retrySiteCheckIn', siteId }, (response) => {
        if (response?.success) resolve(response);
        else reject(new Error(response?.error || '重试失败'));
      });
    });

    updateStats(response.results || {});
    renderSites(response.results || {}, { preserveScroll: true });
    if (!response.running) {
      document.getElementById('lastCheck').textContent = `上次签到: ${formatDateTime(new Date())}`;
    }
  } catch (error) {
    alert('重试失败: ' + error.message);
    loadStatus();
  }
}

async function updateCheckInButtonState(sites) {
  const currentSites = sites || await loadRawSites();
  const running = isCheckInRunningState(currentRunState);
  const cancelling = running && currentRunState?.cancelling === true;
  const enabledCount = countEnabledSites(currentSites);
  const btn = document.getElementById('checkInBtn');
  const btnText = document.getElementById('btnText');
  const btnSpinner = document.getElementById('btnSpinner');
  btn.disabled = cancelling || !canClickCheckInButton(currentSites, currentRunState);
  btnText.textContent = cancelling ? '正在终止...' : (running ? '签到中，点击终止' : '立即签到');
  btnSpinner?.classList.toggle('active', running);
  btn.title = cancelling
    ? '正在终止当前签到任务'
    : running
    ? '点击终止当前签到任务'
    : (enabledCount > 0 ? '' : '请先添加并启用至少一个站点');
}

function showLoading() {
  document.getElementById('sitesList').innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      <div>正在签到...</div>
    </div>
  `;
}

function formatDateTime(date) {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${m}-${d} ${h}:${min}`;
}

async function handleSaveAutoSignTime() {
  const input = document.getElementById('autoSignTime');
  const status = document.getElementById('timeStatus');
  const btn = document.getElementById('saveTimeBtn');
  const time = input.value;

  status.classList.remove('error');
  status.textContent = '';

  if (!isValidAutoSignTime(time)) {
    status.classList.add('error');
    status.textContent = '请选择有效时间';
    return;
  }

  btn.disabled = true;
  try {
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: 'updateAutoSignTime', time }, (response) => {
        if (response?.success) resolve(response);
        else reject(new Error(response?.error || '保存失败'));
      });
    });

    setAutoSignTimeDisplay(response.autoSignTime);
    status.textContent = `已保存为 ${response.autoSignTime}`;
  } catch (error) {
    status.classList.add('error');
    status.textContent = error.message;
  } finally {
    btn.disabled = false;
  }
}

function setAutoSignTimeDisplay(time) {
  document.getElementById('autoSignTime').value = time;
  document.getElementById('autoSignTimeLabel').textContent = time;
}

// 导出配置
async function handleExport() {
  const sites = await loadRawSites();
  const exportOrder = getCurrentSiteListOrder();
  const displayNamesByDomain = getCurrentSiteDisplayNamesByDomain();
  const { autoSignTime } = await chrome.storage.local.get('autoSignTime');
  const currentAutoSignTime = isValidAutoSignTime(autoSignTime)
    ? autoSignTime
    : document.getElementById('autoSignTime').value;

  const config = buildExportConfig(sites, currentAutoSignTime, {
    orderedDomains: exportOrder,
    displayNamesByDomain
  });

  const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `checkin-sites-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function getCurrentSiteListOrder() {
  return Array.from(document.querySelectorAll('#sitesList .site-item'))
    .map(item => item.dataset.domain)
    .filter(Boolean);
}

function getCurrentSiteDisplayNamesByDomain() {
  const names = {};
  for (const item of document.querySelectorAll('#sitesList .site-item')) {
    const domain = item.dataset.domain;
    if (!domain) continue;
    const name = item.querySelector('.site-name')?.textContent?.trim();
    if (name) names[domain] = name;
  }
  return names;
}

// 导入配置
async function handleImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const config = JSON.parse(text);

    // 验证配置格式
    if (!config.sites || !Array.isArray(config.sites)) {
      alert('配置文件格式错误');
      return;
    }

    // 验证并兼容旧版站点格式
    const validSites = normalizeImportSites(config.sites);

    if (validSites.length === 0) {
      alert('配置文件中没有有效的站点');
      return;
    }

    if (!confirm(`将导入 ${validSites.length} 个站点，是否继续？`)) {
      return;
    }

    const currentSites = await loadRawSites();
    let importMode = 'replace';
    if (currentSites.length > 0) {
      importMode = confirm(
        `当前有 ${currentSites.length} 个站点，是否覆盖？\n\n点击"确定"覆盖，点击"取消"合并`
      ) ? 'replace' : 'merge';
    }

    const importResult = buildImportSites(currentSites, validSites, importMode);
    if (!importResult) {
      return;
    }

    let finalSites = importResult;
    if (!Array.isArray(importResult)) {
      finalSites = importResult.sites;
      if (importResult.newCount === 0) {
        alert('所有站点都已存在，无需导入');
        return;
      }
      alert(`成功导入 ${importResult.newCount} 个新站点`);
    }

    await saveSitesConfig(finalSites);

    const importedAutoSignTime = getImportAutoSignTime(config);
    if (importedAutoSignTime) {
      await chrome.runtime.sendMessage({ action: 'updateAutoSignTime', time: importedAutoSignTime });
      setAutoSignTimeDisplay(importedAutoSignTime);
    }

    renderSites();
  } catch (error) {
    alert('导入失败: ' + error.message);
  } finally {
    // 清空文件选择
    event.target.value = '';
  }
}
