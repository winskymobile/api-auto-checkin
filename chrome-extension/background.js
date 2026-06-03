// 导入配置
importScripts('schedule.js', 'config.js', 'auth-headers.js', 'checkin-result.js', 'newapi-auth.js', 'zenapi-auth.js', 'tab-options.js', 'site-name.js', 'page-status.js', 'checkin-run-state.js');

const DAILY_CHECK_IN_ALARM = 'dailyCheckIn';
let currentCheckInPromise = null;

// 安装时初始化
chrome.runtime.onInstalled.addListener(() => {
  console.log('多网站自动签到助手已安装');

  scheduleDailyCheckIn();

  chrome.storage.local.set({
    lastCheckInTime: null,
    checkInResults: {}
  });
});

chrome.runtime.onStartup.addListener(() => {
  scheduleDailyCheckIn();
});

// 监听定时器
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === DAILY_CHECK_IN_ALARM) {
    console.log('开始执行定时签到');
    startCheckInRun('schedule');
  }
});

// 监听来自 popup 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'manualCheckIn') {
    if (currentCheckInPromise) {
      chrome.storage.local.get(['checkInResults', 'checkInRunState'], (data) => {
        sendResponse({
          success: true,
          running: true,
          results: data.checkInResults || {},
          runState: getCheckInRunState(data)
        });
      });
    } else {
      startCheckInRun('manual').then(results => {
        sendResponse({ success: true, running: false, results });
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    }
    return true;
  }

  if (request.action === 'getStatus') {
    chrome.storage.local.get(['lastCheckInTime', 'checkInResults', 'checkInRunState', 'autoSignTime'], (data) => {
      sendResponse({
        ...data,
        checkInRunState: getCheckInRunState(data),
        autoSignTime: isValidAutoSignTime(data.autoSignTime) ? data.autoSignTime : GLOBAL_CONFIG.autoSignTime
      });
    });
    return true;
  }

  if (request.action === 'updateAutoSignTime') {
    const time = request.time;
    if (!isValidAutoSignTime(time)) {
      sendResponse({ success: false, error: '无效的时间格式' });
      return false;
    }

    chrome.storage.local.set({ autoSignTime: time }).then(() => {
      return scheduleDailyCheckIn(time);
    }).then((autoSignTime) => {
      sendResponse({ success: true, autoSignTime });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
});

function startCheckInRun(source = 'manual') {
  if (currentCheckInPromise) {
    console.log('已有签到任务正在执行，跳过重复触发');
    return currentCheckInPromise;
  }

  currentCheckInPromise = executeAllCheckIns({ source }).finally(() => {
    currentCheckInPromise = null;
  });
  return currentCheckInPromise;
}

// 执行所有站点签到
async function executeAllCheckIns({ source = 'manual' } = {}) {
  console.log('开始批量签到');
  const results = {};
  const sites = await loadSitesConfig();
  const enabledSites = sites.filter(s => s.enabled);
  const total = enabledSites.length;
  let current = 0;
  const startedRunState = buildCheckInRunningState({ total, source });
  const { checkInResults: previousResults = {} } = await chrome.storage.local.get('checkInResults');
  await chrome.storage.local.set({
    checkInRunState: startedRunState,
    checkInResults: normalizeCheckInResultsForRun(previousResults)
  });

  // 设置初始badge
  chrome.action.setBadgeBackgroundColor({ color: '#667eea' });
  chrome.action.setBadgeText({ text: '0/' + total });

  for (let site of sites) {
    if (!site.enabled) {
      console.log(`跳过禁用站点: ${site.siteName}`);
      continue;
    }

    current++;
    // 更新badge进度
    chrome.action.setBadgeText({ text: `${current}/${total}` });
    await chrome.storage.local.set({
      checkInRunState: {
        ...startedRunState,
        current,
        currentSiteId: site.siteId
      },
      checkInResults: markSiteChecking(results, site.siteId)
    });

    try {
      let resolvedSite = site.mode === 'visit' ? site : await resolveSiteType(site);
      resolvedSite = await maybeUpdateSiteName(resolvedSite);
      console.log(`开始执行: ${resolvedSite.siteName} (${resolvedSite.mode}/${resolvedSite.type})`);
      const result = resolvedSite.mode === 'visit' ? await visitSite(resolvedSite) : await checkInSite(resolvedSite);
      results[resolvedSite.siteId] = result;
      console.log(`${resolvedSite.siteName} 执行结果:`, result);
    } catch (error) {
      console.error(`${site.siteName} 执行失败:`, error);
      results[site.siteId] = isInvalidSiteError(error)
        ? createInvalidSiteResult(error)
        : {
          status: 'failed',
          message: error.message
        };
    }
    await chrome.storage.local.set({ checkInResults: results });

    await sleep(2000);
  }

  await chrome.storage.local.set({
    lastCheckInTime: new Date().toISOString(),
    checkInResults: normalizeCheckInResultsForRun(results),
    checkInRunState: clearCheckInRunningState(startedRunState)
  });

  // 显示最终结果badge
  const successCount = Object.values(results).filter(r => r.status === 'success').length;
  const alreadyCount = Object.values(results).filter(r => r.status === 'already').length;
  const failedCount = Object.values(results).filter(r => r.status === 'failed' || r.status === 'invalid').length;

  if (failedCount > 0) {
    chrome.action.setBadgeBackgroundColor({ color: '#dc3545' });
    chrome.action.setBadgeText({ text: '✗' + failedCount });
  } else if (successCount > 0) {
    chrome.action.setBadgeBackgroundColor({ color: '#28a745' });
    chrome.action.setBadgeText({ text: '✓' });
  } else {
    chrome.action.setBadgeBackgroundColor({ color: '#17a2b8' });
    chrome.action.setBadgeText({ text: '✓' });
  }

  // 5秒后清除badge
  setTimeout(() => {
    chrome.action.setBadgeText({ text: '' });
  }, 5000);

  return results;
}

async function maybeUpdateSiteName(site) {
  const rawSite = {
    domain: site.cookieDomain,
    name: site.siteName
  };
  if (!shouldAutoFetchSiteName(rawSite)) return site;

  const fetchedName = await fetchSiteDisplayName(site);
  if (!fetchedName) return site;

  await updateRawSiteName(site.cookieDomain, fetchedName);
  console.log(`${site.siteName} 自动获取站点名称: ${fetchedName}`);

  return buildSiteConfig({
    domain: site.cookieDomain,
    name: fetchedName,
    enabled: site.enabled,
    mode: site.mode,
    type: site.type,
    pageUrl: site.visitUrl
  });
}

async function fetchSiteDisplayName(site) {
  let tab;
  try {
    tab = await createTemporaryBackgroundTab(site.visitUrl, 15000);
    await sleep(1000);

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({
        title: document.title,
        ogSiteName: document.querySelector('meta[property="og:site_name"]')?.content || '',
        applicationName: document.querySelector('meta[name="application-name"]')?.content || '',
        siteName: document.querySelector('meta[name="site-name"]')?.content || ''
      })
    });

    return pickSiteDisplayName(results[0]?.result || {}, site.cookieDomain);
  } catch (e) {
    if (isInvalidSiteError(e)) throw e;
    console.warn(`${site.siteName} 获取站点名称失败:`, e);
    return null;
  } finally {
    if (tab?.id) {
      try { await chrome.tabs.remove(tab.id); } catch (e) {}
    }
  }
}

// 单个站点访问
async function visitSite(site) {
  let tab;
  try {
    tab = await createTemporaryBackgroundTab(site.visitUrl, 20000);
    await sleep(3000);

    const tabInfo = await chrome.tabs.get(tab.id);
    if (isInvalidTabUrl(tabInfo.url)) {
      return { status: 'invalid', message: '站点页面失效' };
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({
        url: location.href,
        title: document.title,
        readyState: document.readyState,
        bodyLength: document.body?.innerText?.length || 0
      })
    });

    const page = results[0]?.result;
    if (!page || isInvalidTabUrl(page.url)) {
      return { status: 'invalid', message: '站点页面失效' };
    }

    const loaded = page.readyState === 'complete' || page.readyState === 'interactive';
    if (!loaded) {
      return { status: 'failed', message: '页面未完成加载' };
    }

    return { status: 'success', message: '已访问' };
  } finally {
    if (tab?.id) {
      try { await chrome.tabs.remove(tab.id); } catch (e) {}
    }
  }
}

async function resolveSiteType(site) {
  if (site.type !== 'auto') return site;

  const detectedType = await detectSiteType(site);
  await updateRawSiteType(site.cookieDomain, detectedType);

  return buildSiteConfig({
    domain: site.cookieDomain,
    name: site.siteName,
    enabled: site.enabled,
    type: detectedType,
    pageUrl: getResolvedVisitUrl(site, detectedType)
  });
}

function getResolvedVisitUrl(site, type) {
  if (type === 'sub2api' && site.visitUrl.endsWith('/console/personal')) {
    return `https://${site.cookieDomain}/check-in`;
  }
  if (type === 'zenapi' && site.visitUrl.endsWith('/console/personal')) {
    return `https://${site.cookieDomain}/user`;
  }
  return site.visitUrl;
}

async function detectSiteType(site) {
  let tab;
  try {
    tab = await createTemporaryBackgroundTab(site.visitUrl, 15000);
    await sleep(1000);

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: async () => {
        const appConfig = window.__APP_CONFIG__ || {};
        if (
          Object.prototype.hasOwnProperty.call(appConfig, 'api_base_url') ||
          Object.prototype.hasOwnProperty.call(appConfig, 'linuxdo_oauth_enabled') ||
          location.pathname === '/check-in'
        ) {
          return 'sub2api';
        }

        try {
          const response = await fetch('/api/public/site-info', { credentials: 'include' });
          const data = await response.json();
          if (
            Object.prototype.hasOwnProperty.call(data, 'site_mode') ||
            Object.prototype.hasOwnProperty.call(data, 'registration_mode') ||
            Object.prototype.hasOwnProperty.call(data, 'linuxdo_enabled') ||
            location.pathname.startsWith('/user')
          ) {
            return 'zenapi';
          }
        } catch (e) {
          if (location.pathname.startsWith('/user')) return 'zenapi';
        }

        try {
          const response = await fetch('/api/status', { credentials: 'include' });
          const data = await response.json();
          if (data?.data?.linuxdo_client_id || data?.linuxdo_client_id) {
            return 'newapi';
          }
        } catch (e) {}

        return 'newapi';
      }
    });

    if (results[0]?.result === 'sub2api') return 'sub2api';
    if (results[0]?.result === 'zenapi') return 'zenapi';
    return 'newapi';
  } catch (e) {
    if (isInvalidSiteError(e)) throw e;
    console.warn(`${site.siteName} 自动识别站点类型失败，回退 New API:`, e);
    return 'newapi';
  } finally {
    await closeTabQuietly(tab?.id);
  }
}

async function updateRawSiteType(domain, type) {
  const sites = await loadRawSites();
  const nextSites = sites.map(site => {
    if (site.domain !== domain) return site;
    const next = { ...site, type };
    if (type === 'sub2api' && !next.pageUrl) {
      next.pageUrl = `https://${domain}/check-in`;
    }
    if (type === 'zenapi' && !next.pageUrl) {
      next.pageUrl = `https://${domain}/user`;
    }
    return next;
  });
  await saveSitesConfig(nextSites);
}

async function updateRawSiteName(domain, name) {
  const sites = await loadRawSites();
  const nextSites = sites.map(site => {
    if (site.domain !== domain) return site;
    if (!shouldAutoFetchSiteName(site)) return site;
    return { ...site, name };
  });
  await saveSitesConfig(nextSites);
}

// 单个站点签到
async function checkInSite(site) {
  if (site.type === 'sub2api') {
    return checkInSub2ApiSite(site);
  }
  if (site.type === 'zenapi') {
    return checkInZenApiSite(site);
  }

  // 1. 统一认证顺序：缓存 -> 浏览器已有登录态 -> linux.do OAuth
  const authResult = await getNewApiAuthHeaders(site);
  let authHeaders = authResult?.headers;
  let tabToCleanup = authResult?.tabToCleanup || null;

  if (!authHeaders) {
    throw new Error('无法获取认证信息，请先登录目标站点或 linux.do 后重试');
  }

  // 2. 执行签到
  let execResult = await doCheckInRequest(site.signExecUrl, site.signExecMethod, site.signExecParams, authHeaders);
  let officialPageFallbackTried = false;
  console.log(`${site.siteName} 签到响应:`, execResult);

  if (execResult.requiresPageExecution) {
    ({ execResult, tabToCleanup } = await tryOfficialPageFallback(site, execResult, tabToCleanup));
    officialPageFallbackTried = true;
  }

  // 3. 检测 Cloudflare 错误（cf_clearance 过期或被拦截）
  const isCloudflareError =
    (execResult.httpStatus === 403 && (execResult.error?.includes('Just a moment') || execResult.error?.includes('<!DOCTYPE html>'))) ||
    (execResult.error?.includes('<!DOCTYPE') && execResult.error?.includes('is not valid JSON'));

  if (isCloudflareError) {
    console.log(`${site.siteName} 检测到 Cloudflare 防护，清除缓存并重新登录...`);
    await clearCachedHeaders(site.siteId);

    const refreshedAuth = await getNewApiAuthHeaders(site, { forceRefresh: true, needsTabExecution: true });
    if (refreshedAuth?.headers) {
      // 标记该站点需要在标签页中执行（绕过 Cloudflare）
      refreshedAuth.headers._needsTabExecution = true;
      await cacheHeaders(site.siteId, refreshedAuth.headers);
      const retryResult = await doCheckInRequest(site.signExecUrl, site.signExecMethod, site.signExecParams, refreshedAuth.headers);
      console.log(`${site.siteName} 刷新认证后重试签到响应:`, retryResult);

      const fallback = await tryOfficialPageFallback(site, retryResult, refreshedAuth.tabToCleanup);
      if (fallback.tabToCleanup) try { await chrome.tabs.remove(fallback.tabToCleanup); } catch (e) {}
      if (tabToCleanup && tabToCleanup !== fallback.tabToCleanup) try { await chrome.tabs.remove(tabToCleanup); } catch (e) {}
      return formatResult(fallback.execResult);
    }
    if (tabToCleanup) try { await chrome.tabs.remove(tabToCleanup); } catch (e) {}
    throw new Error('Cloudflare 验证失败，重新登录失败');
  }

  // 4. 如果 401，重新按“浏览器已有登录态 -> OAuth”顺序获取认证
  if (execResult.httpStatus === 401) {
    console.log(`${site.siteName} 认证过期，尝试刷新浏览器登录态...`);
    await clearCachedHeaders(site.siteId);

    const refreshedAuth = await getNewApiAuthHeaders(site, { forceRefresh: true });
    if (refreshedAuth?.headers) {
      await cacheHeaders(site.siteId, refreshedAuth.headers);
      const retryResult = await doCheckInRequest(site.signExecUrl, site.signExecMethod, site.signExecParams, refreshedAuth.headers);
      console.log(`${site.siteName} 刷新认证后重试签到响应:`, retryResult);

      const fallback = await tryOfficialPageFallback(site, retryResult, refreshedAuth.tabToCleanup);
      if (fallback.tabToCleanup) try { await chrome.tabs.remove(fallback.tabToCleanup); } catch (e) {}
      if (tabToCleanup && tabToCleanup !== fallback.tabToCleanup) try { await chrome.tabs.remove(tabToCleanup); } catch (e) {}
      return formatResult(fallback.execResult);
    }
    if (tabToCleanup) try { await chrome.tabs.remove(tabToCleanup); } catch (e) {}
    throw new Error('认证已过期，刷新浏览器登录态失败');
  }

  if (!officialPageFallbackTried) {
    ({ execResult, tabToCleanup } = await tryOfficialPageFallback(site, execResult, tabToCleanup));
  }

  // 4. 查询验证
  let queryVerified = false;
  const isSuccess = execResult.success || execResult.alreadyCheckedIn;
  if (site.signQueryUrl && isSuccess) {
    await sleep(1000);
    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const queryUrl = `${site.signQueryUrl}?month=${currentMonth}`;
      const queryResult = await doFetchWithHeaders(queryUrl, 'GET', null, authHeaders);
      queryVerified = queryResult.data?.data?.stats?.checked_in_today || false;
    } catch (e) {
      console.warn(`${site.siteName} 查询失败:`, e);
    }
  }

  if (tabToCleanup) try { await chrome.tabs.remove(tabToCleanup); } catch (e) {}

  const result = formatResult(execResult);
  result.queryVerified = queryVerified;
  return result;
}

async function checkInSub2ApiSite(site) {
  let authHeaders = await getCachedHeaders(site.siteId);
  let tabToCleanup = null;

  if (!hasAuthorizationHeader(authHeaders)) {
    const tab = await createTemporaryBackgroundTab(site.visitUrl);
    authHeaders = await readSub2ApiAuthHeadersFromTab(tab.id, authHeaders);

    if (!hasAuthorizationHeader(authHeaders)) {
      const capturedHeaders = await captureAuthHeaders(site.cookieDomain, tab.id);
      authHeaders = await readSub2ApiAuthHeadersFromTab(tab.id, capturedHeaders || authHeaders);
    }

    if (!hasAuthorizationHeader(authHeaders)) {
      await closeTabQuietly(tab.id);
      throw new Error('无法读取 Sub2API 登录令牌，请先在浏览器中登录该站点');
    }

    await cacheHeaders(site.siteId, authHeaders);
    tabToCleanup = tab.id;
  }

  const sub2ApiHeaders = { ...authHeaders, _needsTabExecution: true, _successOnHttpOk: true };
  let execResult = await doCheckInRequest(site.signExecUrl, site.signExecMethod, site.signExecParams, sub2ApiHeaders);
  console.log(`${site.siteName} Sub2API 签到响应:`, execResult);

  if (execResult.httpStatus === 401 || execResult.httpStatus === 403) {
    await clearCachedHeaders(site.siteId);
    const tab = await createTemporaryBackgroundTab(site.visitUrl);
    authHeaders = await readSub2ApiAuthHeadersFromTab(tab.id, null);

    if (hasAuthorizationHeader(authHeaders)) {
      const retryHeaders = { ...authHeaders, _needsTabExecution: true, _successOnHttpOk: true };
      await cacheHeaders(site.siteId, authHeaders);
      execResult = await doCheckInRequest(site.signExecUrl, site.signExecMethod, site.signExecParams, retryHeaders);
      console.log(`${site.siteName} Sub2API 重新读取令牌后签到响应:`, execResult);
      if (tabToCleanup && tabToCleanup !== tab.id) await closeTabQuietly(tabToCleanup);
      tabToCleanup = tab.id;
    } else {
      await closeTabQuietly(tab.id);
    }
  }

  ({ execResult, tabToCleanup } = await tryOfficialPageFallback(site, execResult, tabToCleanup));

  if (tabToCleanup) try { await chrome.tabs.remove(tabToCleanup); } catch (e) {}

  const result = formatResult(execResult);
  result.queryVerified = execResult.success || execResult.alreadyCheckedIn || false;
  return result;
}

async function checkInZenApiSite(site) {
  let authHeaders = await getCachedHeaders(site.siteId);
  let tabToCleanup = null;

  if (!hasAuthorizationHeader(authHeaders)) {
    const tab = await createTemporaryBackgroundTab(site.visitUrl);
    authHeaders = await readStorageTokenAuthHeadersFromTab(tab.id, ['user_token'], authHeaders);

    if (!hasAuthorizationHeader(authHeaders)) {
      const oauthResult = await autoZenApiOAuthLogin(site.cookieDomain, tab.id);
      authHeaders = oauthResult?.headers || authHeaders;
      if (oauthResult?.tabId && tab._autoCreated) tabToCleanup = oauthResult.tabId;
    }

    if (!hasAuthorizationHeader(authHeaders)) {
      await closeTabQuietly(tab.id);
      throw new Error('ZenAPI 登录失败，请确认浏览器已登录 linux.do 后重试');
    }

    await cacheHeaders(site.siteId, authHeaders);
    tabToCleanup = tab.id;
  }

  const zenApiHeaders = { ...authHeaders, _needsTabExecution: true };
  let execResult = await doCheckInRequest(site.signExecUrl, site.signExecMethod, site.signExecParams, zenApiHeaders);
  console.log(`${site.siteName} ZenAPI 签到响应:`, execResult);

  if (execResult.httpStatus === 401 || execResult.httpStatus === 403) {
    await clearCachedHeaders(site.siteId);
    const tab = await createTemporaryBackgroundTab(site.visitUrl);
    authHeaders = await readStorageTokenAuthHeadersFromTab(tab.id, ['user_token'], null);

    if (!hasAuthorizationHeader(authHeaders)) {
      const oauthResult = await autoZenApiOAuthLogin(site.cookieDomain, tab.id);
      authHeaders = oauthResult?.headers || authHeaders;
    }

    if (hasAuthorizationHeader(authHeaders)) {
      const retryHeaders = { ...authHeaders, _needsTabExecution: true };
      await cacheHeaders(site.siteId, authHeaders);
      execResult = await doCheckInRequest(site.signExecUrl, site.signExecMethod, site.signExecParams, retryHeaders);
      console.log(`${site.siteName} ZenAPI 重新读取令牌后签到响应:`, execResult);
      if (tabToCleanup && tabToCleanup !== tab.id) await closeTabQuietly(tabToCleanup);
      tabToCleanup = tab.id;
    } else {
      await closeTabQuietly(tab.id);
    }
  }

  ({ execResult, tabToCleanup } = await tryOfficialPageFallback(site, execResult, tabToCleanup));

  if (tabToCleanup) try { await chrome.tabs.remove(tabToCleanup); } catch (e) {}

  const result = formatResult(execResult);
  result.queryVerified = execResult.success || execResult.alreadyCheckedIn || false;
  return result;
}

async function tryOfficialPageFallback(site, execResult, tabToCleanup = null) {
  if (!shouldTryOfficialPageCheckIn(execResult)) {
    return { execResult, tabToCleanup };
  }

  console.log(`${site.siteName} 接口签到失败，尝试打开官方页面点击签到按钮...`);
  let pageResult;
  try {
    pageResult = await checkInFromOfficialPage(site);
  } catch (e) {
    if (tabToCleanup) await closeTabQuietly(tabToCleanup);
    throw e;
  }
  let nextTabToCleanup = tabToCleanup;

  if (pageResult.tabId) {
    if (pageResult.keepTabOpen) {
      if (tabToCleanup && tabToCleanup !== pageResult.tabId) {
        try { await chrome.tabs.remove(tabToCleanup); } catch (e) {}
      }
      nextTabToCleanup = null;
    } else if (nextTabToCleanup && nextTabToCleanup !== pageResult.tabId) {
      try { await chrome.tabs.remove(pageResult.tabId); } catch (e) {}
    } else {
      nextTabToCleanup = pageResult.tabId;
    }
  }

  console.log(`${site.siteName} 官方页面兜底签到响应:`, pageResult.result);
  return { execResult: pageResult.result, tabToCleanup: nextTabToCleanup };
}

async function checkInFromOfficialPage(site) {
  const tab = await createTemporaryBackgroundTab(site.visitUrl, 20000);
  await sleep(3000);

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: async (targetUrl) => {
      const originalFetch = window.fetch;
      const originalXhrOpen = window.XMLHttpRequest?.prototype?.open;
      const originalXhrSend = window.XMLHttpRequest?.prototype?.send;
      const checkInResponses = [];
      let targetPath = '';

      try {
        targetPath = new URL(targetUrl).pathname;
      } catch (e) {}

      function recordCheckInResponse(url, method, status, text) {
        try {
          if (!url || String(method || 'GET').toUpperCase() !== 'POST') {
            return;
          }
          const requestPath = new URL(String(url), location.origin).pathname;
          const commonCheckInPath =
            requestPath.includes('/checkin') ||
            requestPath.includes('/check-in') ||
            requestPath.includes('/signin') ||
            requestPath.includes('/sign-in');
          if (requestPath !== targetPath && !commonCheckInPath) return;

          let data = null;
          try { data = JSON.parse(text); } catch (e) {}
          checkInResponses.push({ httpStatus: status, data, text });
        } catch (e) {}
      }

      window.fetch = async (...args) => {
        const response = await originalFetch.apply(window, args);
        try {
          const request = args[0];
          const options = args[1] || {};
          const url = typeof request === 'string' ? request : request?.url;
          const method = String(options.method || request?.method || 'GET').toUpperCase();
          if (url && method === 'POST') {
            const clone = response.clone();
            const text = await clone.text();
            recordCheckInResponse(url, method, response.status, text);
          }
        } catch (e) {}
        return response;
      };

      if (originalXhrOpen && originalXhrSend) {
        window.XMLHttpRequest.prototype.open = function(method, url, ...rest) {
          this.__newApiCheckInRequest = { method, url: String(url || '') };
          return originalXhrOpen.call(this, method, url, ...rest);
        };
        window.XMLHttpRequest.prototype.send = function(...args) {
          try {
            this.addEventListener('load', () => {
              const req = this.__newApiCheckInRequest || {};
              recordCheckInResponse(req.url, req.method, this.status, this.responseText || '');
            }, { once: true });
          } catch (e) {}
          return originalXhrSend.apply(this, args);
        };
      }

      function isVisible(el) {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          rect.width > 0 &&
          rect.height > 0;
      }

      function hasSecurityCheck() {
        const text = document.body?.innerText || '';
        return /Security Check|安全验证|人机验证|Turnstile/i.test(text) ||
          Boolean(document.querySelector('iframe[src*="challenges.cloudflare.com"], iframe[src*="turnstile"]'));
      }

      function hasCheckedInText() {
        const text = document.body?.innerText || '';
        return /Checked in|已签到|今日已签到/i.test(text);
      }

      function findCheckInButton() {
        const candidates = Array.from(document.querySelectorAll('button, [role="button"]'));
        return candidates.find((el) => {
          const text = (el.textContent || '').trim();
          const disabled = el.disabled || el.getAttribute('aria-disabled') === 'true';
          return !disabled &&
            isVisible(el) &&
            /Check in now|check.?in|daily check.?in|立即签到|现在签到|每日签到|^签$|^签到$/i.test(text) &&
            !/Checked in|已签到/i.test(text);
        });
      }

      function hasDisabledCheckInButton() {
        const candidates = Array.from(document.querySelectorAll('button, [role="button"]'));
        return candidates.some((el) => {
          const text = (el.textContent || '').trim();
          const disabled = el.disabled || el.getAttribute('aria-disabled') === 'true';
          return disabled &&
            isVisible(el) &&
            /Check in now|check.?in|daily check.?in|立即签到|现在签到|每日签到|^签$|^签到$/i.test(text) &&
            !/Loading|加载|处理中/i.test(text);
        });
      }

      try {
        if (hasCheckedInText()) {
          return { kind: 'already', message: '今日已签到' };
        }
        if (hasDisabledCheckInButton()) {
          return { kind: 'already', message: '今日已签到' };
        }

        const button = findCheckInButton();
        if (!button) {
          return {
            kind: hasSecurityCheck() ? 'security-check' : 'no-button',
            message: hasSecurityCheck()
              ? '站点要求完成 Turnstile 安全验证，自动签到已停止'
              : '未找到官方页面签到按钮，自动签到失败'
          };
        }

        button.click();

        for (let i = 0; i < 40; i++) {
          await new Promise(resolve => setTimeout(resolve, 500));
          if (checkInResponses.length > 0) {
            return { kind: 'response', ...checkInResponses[checkInResponses.length - 1] };
          }
          if (hasSecurityCheck()) {
            return {
              kind: 'security-check',
              message: '站点要求完成 Turnstile 安全验证，自动签到已停止'
            };
          }
          if (hasCheckedInText()) {
            return { kind: 'already', message: '今日已签到' };
          }
        }

        return {
          kind: 'timeout',
          message: '官方页面签到请求超时，自动签到失败'
        };
      } finally {
        window.fetch = originalFetch;
        if (originalXhrOpen && originalXhrSend) {
          window.XMLHttpRequest.prototype.open = originalXhrOpen;
          window.XMLHttpRequest.prototype.send = originalXhrSend;
        }
      }
    },
    args: [site.signExecUrl]
  });

  const pageResult = results[0]?.result || {};
  console.log(`${site.siteName} 官方页面签到执行结果:`, pageResult);

  if (pageResult.kind === 'response' && pageResult.data) {
    const parsed = parseCheckInResponse(pageResult.data, pageResult.httpStatus, false);
    if (parsed.requiresPageExecution) {
      parsed.message = '站点仍要求页面内操作，自动签到已停止';
      return { result: parsed, tabId: tab.id, keepTabOpen: shouldKeepOfficialPageFallbackTabOpen(parsed) };
    }
    if (parsed.requiresSecurityCheck) {
      parsed.message = '站点要求完成 Turnstile 安全验证，自动签到已停止';
      return { result: parsed, tabId: tab.id, keepTabOpen: shouldKeepOfficialPageFallbackTabOpen(parsed) };
    }
    return { result: parsed, tabId: tab.id, keepTabOpen: shouldKeepOfficialPageFallbackTabOpen(parsed) };
  }

  if (pageResult.kind === 'already') {
    return {
      result: {
        success: true,
        alreadyCheckedIn: true,
        message: pageResult.message || '今日已签到',
        httpStatus: 200,
        data: pageResult
      },
      tabId: tab.id,
      keepTabOpen: false
    };
  }

  return {
    result: {
      success: false,
      message: getOfficialPageFallbackFailureMessage(pageResult),
      httpStatus: pageResult.kind === 'security-check' ? 403 : 0,
      data: pageResult
    },
    tabId: tab.id,
    keepTabOpen: false
  };
}

async function autoZenApiOAuthLogin(domain, tabId = null) {
  console.log(`[ZenAPI OAuth] 开始登录: ${domain}`);

  const ldCookies = await chrome.cookies.getAll({ domain: 'linux.do' });
  if (ldCookies.length === 0) {
    console.warn('[ZenAPI OAuth] linux.do 未登录');
    return null;
  }

  let tab;
  const ownsTab = !tabId;
  try {
    tab = tabId ? await chrome.tabs.get(tabId) : await createTemporaryBackgroundTab(`https://${domain}/login`);
    await chrome.tabs.update(tab.id, { url: buildZenApiLoginUrl(domain) });
    await waitForTabComplete(tab.id, 20000);
    await sleep(1000);

    let tabInfo = await chrome.tabs.get(tab.id);
    console.log(`[ZenAPI OAuth] 当前页面: ${tabInfo.url}`);

    if (tabInfo.url && tabInfo.url.includes('connect.linux.do')) {
      await clickLinuxDoAuthorizeButton(tab.id);
      const redirected = await waitForTabUrlMatch(tab.id, domain, 30000);
      if (!redirected) {
        console.warn('[ZenAPI OAuth] 等待回跳 ZenAPI 超时');
        if (ownsTab) await closeTabQuietly(tab.id);
        return null;
      }
      await waitForTabComplete(tab.id, 20000);
      await sleep(1000);
      tabInfo = await chrome.tabs.get(tab.id);
    }

    const callbackToken = extractZenApiLinuxDoToken(tabInfo.url || '');
    if (callbackToken) {
      console.log('[ZenAPI OAuth] 从回调 URL 读取到 linuxdo_token');
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (token) => {
          localStorage.setItem('user_token', token);
          history.replaceState(null, '', '/user');
        },
        args: [callbackToken]
      });
    }

    await sleep(1000);
    const headers = await readStorageTokenAuthHeadersFromTab(tab.id, ['user_token'], null, 'ZenAPI');
    if (!hasAuthorizationHeader(headers) && callbackToken) {
      const fallbackHeaders = mergeZenApiTokenHeader({}, callbackToken);
      fallbackHeaders._tabId = tab.id;
      return { headers: fallbackHeaders, tabId: tab.id };
    }

    if (!hasAuthorizationHeader(headers)) {
      console.warn('[ZenAPI OAuth] 未能读取 user_token');
      if (ownsTab) await closeTabQuietly(tab.id);
      return null;
    }

    return { headers, tabId: tab.id };
  } catch (e) {
    console.warn('[ZenAPI OAuth] 登录失败:', e);
    if (ownsTab) await closeTabQuietly(tab?.id);
    return null;
  }
}

async function clickLinuxDoAuthorizeButton(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const selectors = [
          'button',
          'input[type="submit"]',
          'a[class*="btn"]',
          '[role="button"]'
        ];
        const candidates = document.querySelectorAll(selectors.join(','));
        for (const el of candidates) {
          const text = (el.textContent || el.value || '').trim();
          if (/allow|允许|授权|approve|accept|Authorize|同意/i.test(text)) {
            el.click();
            return `clicked: ${text}`;
          }
        }

        const form = document.querySelector('form');
        const submit = form?.querySelector('button, input[type="submit"]');
        if (submit) {
          submit.click();
          return 'clicked form submit';
        }

        return 'no authorize button found';
      }
    });
    console.log('[ZenAPI OAuth] 授权页点击结果:', results[0]?.result);
  } catch (e) {
    console.warn('[ZenAPI OAuth] 点击授权按钮失败:', e);
  }
}

async function readSub2ApiAuthHeadersFromTab(tabId, baseHeaders = {}) {
  return readStorageTokenAuthHeadersFromTab(tabId, ['auth_token', 'access_token', 'token'], baseHeaders, 'Sub2API');
}

async function readStorageTokenAuthHeadersFromTab(tabId, tokenKeys, baseHeaders = {}, logLabel = 'Auth') {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: (keys) => {
        const tokenKeys = Array.isArray(keys) ? keys : [];
        for (const key of tokenKeys) {
          const token = localStorage.getItem(key) || sessionStorage.getItem(key);
          if (token) return token;
        }
        return null;
      },
      args: [tokenKeys]
    });

    const token = results[0]?.result;
    const headers = mergeAuthorizationHeader(baseHeaders || {}, token);
    headers._tabId = tabId;
    return headers;
  } catch (e) {
    console.warn(`[${logLabel}] 读取页面登录令牌失败:`, e);
    return baseHeaders || {};
  }
}

function formatResult(execResult) {
  if (execResult.invalidSite) {
    return { status: 'invalid', message: execResult.message || '站点页面失效' };
  }
  if (execResult.error) {
    return { status: 'failed', message: execResult.error };
  }
  if (execResult.alreadyCheckedIn) {
    return { status: 'already', message: execResult.message };
  }
  return {
    status: execResult.success ? 'success' : 'failed',
    message: execResult.message
  };
}

// 通过 webRequest 捕获页面真实请求头
function captureAuthHeaders(domain, tabId, { timeout = 25000 } = {}) {
  return new Promise(async (resolve) => {
    let resolved = false;

    function onCapture(headers) {
      if (resolved) return;
      resolved = true;
      chrome.webRequest.onSendHeaders.removeListener(listener);
      headers._tabId = tabId; // 保存tabId用于后续在标签页中执行请求
      resolve(headers);
    }

    function listener(details) {
      if (resolved || details.tabId !== tabId) return;

      const headers = {};
      for (const h of (details.requestHeaders || [])) {
        headers[h.name] = h.value;
      }

      console.log(`[webRequest] 捕获到 ${details.url} 的请求头:`, Object.keys(headers));
      onCapture(headers);
    }

    // 监听目标域名的 API 请求
    chrome.webRequest.onSendHeaders.addListener(
      listener,
      { urls: [`https://${domain}/api/*`], tabId: tabId },
      ['requestHeaders', 'extraHeaders']
    );

    // 检查当前URL，如果是登录页面，先导航到登录页
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab.url && (tab.url.includes('/login') || tab.url.includes('expired=true'))) {
        console.log(`[webRequest] 标签页在登录页面，先导航到登录页...`);
        await chrome.tabs.update(tabId, { url: `https://${domain}/login` });
        await sleep(20000); // 等待Cloudflare验证完成（20秒）
      }
    } catch (e) {
      console.warn('检查标签页URL失败:', e);
    }

    // 刷新页面以触发 API 请求
    console.log(`[webRequest] 刷新标签页 ${tabId} 以捕获请求头...`);
    try {
      await chrome.tabs.reload(tabId);
    } catch (e) {
      console.warn('刷新标签页失败:', e);
    }

    // 等待页面加载完成 + API 请求发出
    await sleep(timeout);

    // 超时
    if (!resolved) {
      resolved = true;
      chrome.webRequest.onSendHeaders.removeListener(listener);
      console.warn(`[webRequest] 超时未捕获到 ${domain} 的 API 请求`);
      resolve(null);
    }
  });
}

// 用捕获的头发起签到请求（从 service worker 发起）
async function doCheckInRequest(url, method, params, capturedHeaders) {
  // 优先使用 service worker fetch（更快），只有在需要时才使用标签页
  // 如果有 _needsTabExecution 标记，说明该站点需要在标签页中执行
  const needsTabExecution = capturedHeaders._needsTabExecution;
  let tabId = capturedHeaders._tabId;

  // 检查标签页是否存在
  if (tabId && needsTabExecution) {
    try {
      await chrome.tabs.get(tabId);
      // 标签页存在，可以使用
    } catch (e) {
      // 标签页不存在，移除 tabId
      console.log(`[fetch-in-tab] 标签页 ${tabId} 不存在，回退到 service worker fetch`);
      tabId = null;
    }
  }

  if (tabId && needsTabExecution) {
    console.log(`[fetch-in-tab] 站点需要 Cloudflare 绕过，在标签页 ${tabId} 中执行: ${method} ${url}`);

    // 提取认证相关的头
    const headers = { 'Content-Type': 'application/json' };
    const authKeys = ['authorization', 'cookie', 'session', 'token', 'x-token', 'x-auth', 'new-api'];

    for (const [name, value] of Object.entries(capturedHeaders)) {
      if (name.startsWith('_')) continue; // 跳过临时标记
      const lower = name.toLowerCase();
      if (authKeys.some(k => lower.includes(k))) {
        headers[name] = value;
      }
    }

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: async (fetchUrl, fetchMethod, fetchParams, fetchHeaders, successOnHttpOk) => {
          try {
            const options = {
              method: fetchMethod,
              headers: fetchHeaders,
              credentials: 'include'
            };
            if (fetchMethod === 'POST' && fetchParams && Object.keys(fetchParams).length > 0) {
              options.body = JSON.stringify(fetchParams);
            }

            const response = await fetch(fetchUrl, options);
            if (response.status === 404 || response.status === 410) {
              return {
                success: false,
                invalidSite: true,
                message: '站点页面失效',
                httpStatus: response.status
              };
            }
            const text = await response.text();

            // 尝试解析JSON
            let data;
            try {
              data = JSON.parse(text);
            } catch (e) {
              return { error: 'Response is not JSON: ' + text.substring(0, 100), httpStatus: response.status };
            }

            const zenApiAlreadyCheckedIn = data?.already_checked_in === true;
            const success =
              data.success === true ||
              data.status === 'success' ||
              data.ret === 1 ||
              data.code === 0 ||
              data.ok === true ||
              (successOnHttpOk === true && response.ok);
            const reward = Number(data?.reward);
            const message =
              data.message ||
              data.msg ||
              (zenApiAlreadyCheckedIn ? '今日已签到' : null) ||
              (Number.isFinite(reward) ? `签到成功，获得 $${reward.toFixed(2)}` : null) ||
              data.data ||
              '签到完成';
            const msgStr = typeof message === 'string' ? message : JSON.stringify(message);

            const alreadyKeywords = ['已签到', '已经签到', '已签过', '今日已签', 'already', '重复签到'];
            const alreadyCheckedIn = zenApiAlreadyCheckedIn || alreadyKeywords.some(k => msgStr.includes(k));

            return {
              success: success || alreadyCheckedIn,
              alreadyCheckedIn,
              message: msgStr,
              httpStatus: response.status,
              data
            };
          } catch (e) {
            return { error: e.message, success: false, httpStatus: 0 };
          }
        },
        args: [url, method, params, headers, capturedHeaders._successOnHttpOk === true]
      });

      const result = results[0]?.result;
      console.log(`[fetch-in-tab] 结果:`, result);
      return result || { error: 'No result from tab', success: false };
    } catch (e) {
      console.error(`[fetch-in-tab] 失败:`, e);
      // 回退到background fetch
    }
  }

  // 回退：在background中执行
  return doFetchWithHeaders(url, method, params, capturedHeaders);
}

async function doFetchWithHeaders(url, method, params, capturedHeaders) {
  // 提取认证相关的头
  const headers = { 'Content-Type': 'application/json' };
  const authKeys = ['authorization', 'cookie', 'session', 'token', 'x-token', 'x-auth', 'new-api'];

  for (const [name, value] of Object.entries(capturedHeaders)) {
    const lower = name.toLowerCase();
    if (authKeys.some(k => lower.includes(k))) {
      headers[name] = value;
    }
  }

  // 也保留 user-agent 和 referer
  if (capturedHeaders['User-Agent']) headers['User-Agent'] = capturedHeaders['User-Agent'];
  if (capturedHeaders['Referer']) headers['Referer'] = capturedHeaders['Referer'];

  console.log(`[fetch] ${method} ${url} 使用头:`, Object.keys(headers));
  console.log(`[fetch] 详细请求头:`, JSON.stringify(headers, null, 2).substring(0, 500));

  const options = { method, headers };
  if (method === 'POST' && params && Object.keys(params).length > 0) {
    options.body = JSON.stringify(params);
  }

    try {
      const response = await fetch(url, options);
      if (isInvalidHttpStatus(response.status)) {
        return { success: false, invalidSite: true, message: '站点页面失效', httpStatus: response.status };
      }
      const data = await response.json();

    console.log(`[fetch] 响应状态: ${response.status}, 数据:`, JSON.stringify(data).substring(0, 200));

    return parseCheckInResponse(data, response.status, capturedHeaders._successOnHttpOk === true);
  } catch (e) {
    console.error(`[fetch] 请求失败:`, e);
    return { error: e.message, success: false, httpStatus: 0 };
  }
}

// 缓存/读取认证头
async function cacheHeaders(siteId, headers) {
  const data = await chrome.storage.local.get('authHeadersCache');
  const cache = data.authHeadersCache || {};
  cache[siteId] = { headers, cachedAt: Date.now() };
  await chrome.storage.local.set({ authHeadersCache: cache });
}

async function getCachedHeaders(siteId) {
  const data = await chrome.storage.local.get('authHeadersCache');
  const cache = data.authHeadersCache || {};
  const entry = cache[siteId];
  if (!entry) return null;

  // 缓存 7 天过期（401 时会自动刷新）
  if (Date.now() - entry.cachedAt > 7 * 24 * 60 * 60 * 1000) {
    return null;
  }
  return entry.headers;
}

async function clearCachedHeaders(siteId) {
  const data = await chrome.storage.local.get('authHeadersCache');
  const cache = data.authHeadersCache || {};
  delete cache[siteId];
  await chrome.storage.local.set({ authHeadersCache: cache });
}

async function getNewApiAuthHeaders(site, { forceRefresh = false, needsTabExecution = false } = {}) {
  if (!forceRefresh) {
    const cachedHeaders = await getCachedHeaders(site.siteId);
    if (cachedHeaders) {
      console.log(`${site.siteName} 使用缓存认证头`);
      return { headers: cachedHeaders, tabToCleanup: null, source: 'cache' };
    }
  }

  console.log(`${site.siteName} 无可用缓存，先检查浏览器已有登录态...`);
  const existingSession = await getNewApiExistingSessionAuthHeaders(site, { needsTabExecution });
  if (existingSession?.headers && !shouldTryNewApiOAuth({ hasExistingSessionHeaders: true })) {
    await cacheHeaders(site.siteId, existingSession.headers);
    console.log(`${site.siteName} 已复用浏览器已有登录态`);
    return existingSession;
  }

  console.log(`${site.siteName} 未检测到可复用登录态，尝试 linux.do OAuth...`);
  const oauthResult = await autoOAuthLogin(site.cookieDomain, site.visitUrl);
  if (oauthResult?.headers) {
    if (needsTabExecution) {
      oauthResult.headers._needsTabExecution = true;
    }
    await cacheHeaders(site.siteId, oauthResult.headers);
    console.log(`${site.siteName} OAuth 登录成功`);
    return { headers: oauthResult.headers, tabToCleanup: oauthResult.tabId || null, source: 'oauth' };
  }

  return null;
}

async function getNewApiExistingSessionAuthHeaders(site, { needsTabExecution = false } = {}) {
  const tab = await createTemporaryBackgroundTab(getNewApiPostLoginUrl(site.cookieDomain, site.visitUrl), 15000);
  try {
    await sleep(1500);

    const session = await inspectNewApiBrowserSession(tab.id);
    console.log(`${site.siteName} 浏览器登录态检查:`, JSON.stringify({
      hasUser: session?.hasUser,
      userAuthenticated: session?.userAuthenticated,
      selfStatus: session?.selfStatus,
      hasToken: Boolean(session?.token)
    }));

    if (!session?.success || !hasNewApiUserSession(session)) {
      await closeTabQuietly(tab.id);
      return null;
    }

    const cookies = await chrome.cookies.getAll({ domain: site.cookieDomain });
    let headers = buildNewApiExistingSessionHeaders({
      cookies,
      user: session.user,
      token: session.token,
      tabId: tab.id
    });

    if (!headers.Cookie && !headers.cookie && !headers.Authorization) {
      const capturedHeaders = await captureAuthHeaders(site.cookieDomain, tab.id, { timeout: 5000 });
      headers = buildNewApiExistingSessionHeaders({
        cookies,
        user: session.user,
        token: session.token,
        tabId: tab.id,
        baseHeaders: capturedHeaders || headers
      });
    }

    if (needsTabExecution) {
      headers._needsTabExecution = true;
    }

    return { headers, tabToCleanup: tab.id, source: 'browser-session' };
  } catch (e) {
    console.warn(`${site.siteName} 检查浏览器已有登录态失败:`, e);
    await closeTabQuietly(tab.id);
    return null;
  }
}

async function inspectNewApiBrowserSession(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: async () => {
      try {
        const user = localStorage.getItem('user');
        const token = localStorage.getItem('token') || localStorage.getItem('access_token') || localStorage.getItem('auth_token');
        let selfData = null;
        let selfStatus = 0;
        let userAuthenticated = false;

        try {
          const selfResp = await fetch('/api/user/self', { credentials: 'include' });
          selfStatus = selfResp.status;
          selfData = await selfResp.json();
          userAuthenticated = selfResp.ok &&
            selfStatus !== 401 &&
            selfData?.success !== false &&
            Boolean(selfData?.data || selfData?.success === true);
        } catch (e) {}

        return {
          success: true,
          hasUser: user !== null,
          user,
          token,
          userAuthenticated,
          selfStatus,
          selfData
        };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }
  });

  return results[0]?.result || null;
}

// ============== Auto OAuth Login ==============

// 等待标签页加载完成
function waitForTabComplete(tabId, timeout = 15000) {
  return new Promise((resolve) => {
    let done = false;
    function finish(val) {
      if (done) return;
      done = true;
      chrome.tabs.onUpdated.removeListener(listener);
      resolve(val);
    }
    function listener(id, info) {
      if (id === tabId && info.status === 'complete') finish(true);
    }
    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.get(tabId).then(t => {
      if (t.status === 'complete') finish(true);
    }).catch(() => finish(false));
    setTimeout(() => finish(false), timeout);
  });
}

// 等待标签页 URL 匹配目标域名
function waitForTabUrlMatch(tabId, domain, timeout = 20000) {
  return new Promise((resolve) => {
    let done = false;
    function finish(val) {
      if (done) return;
      done = true;
      chrome.tabs.onUpdated.removeListener(listener);
      resolve(val);
    }
    function listener(id, info, tab) {
      if (id === tabId && tab.url && tab.url.includes(domain)) finish(true);
    }
    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.get(tabId).then(t => {
      if (t.url && t.url.includes(domain)) finish(true);
    }).catch(() => {});
    setTimeout(() => finish(false), timeout);
  });
}

// 自动通过 linux.do OAuth 登录目标站点
async function autoOAuthLogin(domain, visitUrl) {
  console.log(`[OAuth] 开始自动登录: ${domain}`);

  // 1. 获取 linuxdo_client_id（在标签页上下文中执行以绕过 Cloudflare）
  let clientId;
  let tab;
  try {
    // 创建临时后台标签页，避免复用或打断用户正在浏览的页面
    tab = await createTemporaryBackgroundTab(`https://${domain}/`);

    // 在标签页中执行 fetch 请求
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: async () => {
        try {
          const resp = await fetch('/api/status');
          const data = await resp.json();
          return { success: true, data: data };
        } catch (e) {
          return { success: false, error: e.message };
        }
      }
    });

    const result = results[0]?.result;
    if (!result?.success) {
      console.warn(`[OAuth] 获取 status 失败:`, result?.error);
      await closeTabQuietly(tab.id);
      return null;
    }

    clientId = result.data?.data?.linuxdo_client_id || result.data?.linuxdo_client_id;
    if (!clientId) {
      console.warn(`[OAuth] ${domain} 无 linuxdo_client_id`);
      await closeTabQuietly(tab.id);
      return null;
    }
    console.log(`[OAuth] client_id: ${clientId}`);
  } catch (e) {
    console.warn(`[OAuth] 获取 status 失败:`, e);
    await closeTabQuietly(tab?.id);
    return null;
  }

  // 2. 检查 linux.do 登录状态
  const ldCookies = await chrome.cookies.getAll({ domain: 'linux.do' });
  if (ldCookies.length === 0) {
    console.warn('[OAuth] linux.do 未登录');
    await closeTabQuietly(tab.id);
    return null;
  }
  console.log(`[OAuth] linux.do cookies: ${ldCookies.length} 个`);

  // 2.5. 获取 OAuth state (CSRF 保护) - 在标签页中执行以绕过 Cloudflare
  let state;
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: async () => {
        try {
          const resp = await fetch('/api/oauth/state', { credentials: 'include' });
          const data = await resp.json();
          return { success: true, data: data };
        } catch (e) {
          return { success: false, error: e.message };
        }
      }
    });

    const result = results[0]?.result;
    if (!result?.success || !result?.data?.success || !result?.data?.data) {
      console.warn('[OAuth] 获取 state 失败:', result);
      await closeTabQuietly(tab.id);
      return null;
    }
    state = result.data.data;
    console.log(`[OAuth] 获取 state: ${state}`);
  } catch (e) {
    console.warn('[OAuth] 获取 state 异常:', e);
    await closeTabQuietly(tab.id);
    return null;
  }

  // 3. 在同一个标签页中打开 OAuth 授权页面
  const oauthUrl = `https://connect.linux.do/oauth2/authorize?response_type=code&client_id=${clientId}&state=${state}`;
  console.log(`[OAuth] 打开: ${oauthUrl}`);
  try {
    await chrome.tabs.update(tab.id, { url: oauthUrl });
    console.log(`[OAuth] 使用标签页 ${tab.id} 进行 OAuth 授权`);
  } catch (e) {
    console.error('[OAuth] 更新标签页失败:', e);
    await closeTabQuietly(tab.id);
    return null;
  }

  try {
    // 4. 等待页面加载
    await waitForTabComplete(tab.id, 15000);
    await sleep(1000);

    let tabInfo = await chrome.tabs.get(tab.id);
    console.log(`[OAuth] 页面加载完成: ${tabInfo.url}`);

    // 5. 如果还在授权页面，尝试点击"允许"按钮
    if (tabInfo.url && tabInfo.url.includes('connect.linux.do')) {
      console.log('[OAuth] 在授权页面，点击允许按钮...');
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            // 搜索所有可能的按钮元素（包括 a.btn-pill 等链接按钮）
            const btns = document.querySelectorAll('button, input[type="submit"], a[class*="btn"], [role="button"]');
            for (const btn of btns) {
              const text = (btn.textContent || btn.value || '').trim();
              if (/allow|允许|授权|approve|accept|Authorize|同意/i.test(text)) {
                btn.click();
                return 'clicked: ' + text;
              }
            }
            // 回退：查找包含允许文本的任意链接
            const links = document.querySelectorAll('a[href*="approve"], a[href*="authorize"]');
            for (const link of links) {
              link.click();
              return 'clicked approve link: ' + link.href;
            }
            // 回退：提交表单
            const form = document.querySelector('form');
            if (form) {
              const sub = form.querySelector('[type="submit"], button');
              if (sub) { sub.click(); return 'clicked form submit'; }
            }
            return 'no button found';
          }
        });
        console.log('[OAuth] 点击结果:', results[0]?.result);
      } catch (e) {
        console.warn('[OAuth] 注入脚本失败:', e);
      }

      // 等待重定向到目标域名
      const redirected = await waitForTabUrlMatch(tab.id, domain, 20000);
      if (!redirected) {
        console.warn('[OAuth] 重定向超时');
        await closeTabQuietly(tab.id);
        return null;
      }
      await waitForTabComplete(tab.id, 15000);
    }

    // 6. 验证已到达目标域名
    tabInfo = await chrome.tabs.get(tab.id);
    if (!tabInfo.url || !tabInfo.url.includes(domain)) {
      console.warn(`[OAuth] 未到达目标域: ${tabInfo.url}`);
      await closeTabQuietly(tab.id);
      return null;
    }
    console.log(`[OAuth] 登录完成: ${tabInfo.url}`);

    // 7. 等待前端 JS 处理 OAuth 回调（交换 code、保存 token 到 localStorage/cookie）
    console.log('[OAuth] 等待前端处理 OAuth 回调...');

    // 7.5. 手动触发 OAuth 回调处理（某些站点的前端 JS 可能不会自动执行）
    console.log('[OAuth] 手动调用 OAuth 回调 API...');
    const oauthUrl = new URL(tabInfo.url);
    const code = oauthUrl.searchParams.get('code');
    if (code) {
      try {
        const callbackResults = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: async (authCode) => {
            try {
              // 手动调用 OAuth 回调 API
              const resp = await fetch(`/api/oauth/linuxdo?code=${authCode}`, {
                method: 'GET',
                credentials: 'include'
              });
              const data = await resp.json();
              console.log('[OAuth 回调] API 响应:', data);

              // 如果登录成功,将用户数据写入 localStorage
              if (data.success && data.data) {
                localStorage.setItem('user', JSON.stringify(data.data));
                console.log('[OAuth 回调] 已将用户数据写入 localStorage');
              }

              // 等待一下让浏览器处理 Set-Cookie
              await new Promise(r => setTimeout(r, 1000));

              // 检查 localStorage
              const hasUser = localStorage.getItem('user') !== null;
              return { success: true, apiResponse: data, hasUser: hasUser };
            } catch (e) {
              return { success: false, error: e.message };
            }
          },
          args: [code]
        });
        const callbackResult = callbackResults[0]?.result;
        console.log('[OAuth] 回调 API 结果:', JSON.stringify(callbackResult).substring(0, 300));
      } catch (e) {
        console.warn('[OAuth] 手动调用回调 API 失败:', e.message);
      }
    }

    // 7.6. 验证 session 是否已建立（在页面上下文中检查）
    let sessionEstablished = false;
    for (let retry = 0; retry < 5; retry++) {
      await sleep(2000);
      console.log(`[OAuth] 验证 session 是否建立 (尝试 ${retry + 1}/5)...`);

      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: async () => {
            try {
              // 检查 localStorage 中是否有 user 键（旧版 New API 会写入 user）
              const hasUser = localStorage.getItem('user') !== null;
              let statusData = null;
              let selfData = null;
              let selfStatus = 0;
              let userAuthenticated = false;

              try {
                const statusResp = await fetch('/api/status', { credentials: 'include' });
                statusData = await statusResp.json();
              } catch (e) {}

              try {
                const selfResp = await fetch('/api/user/self', { credentials: 'include' });
                selfStatus = selfResp.status;
                selfData = await selfResp.json();
                userAuthenticated = selfResp.ok &&
                  selfStatus !== 401 &&
                  selfData?.success !== false &&
                  Boolean(selfData?.data || selfData?.success === true);
              } catch (e) {}

              return {
                success: true,
                hasUser: hasUser,
                userAuthenticated: userAuthenticated,
                data: statusData,
                selfStatus: selfStatus,
                selfData: selfData
              };
            } catch (e) {
              return { success: false, error: e.message };
            }
          }
        });
        const result = results[0]?.result;
        console.log(`[OAuth] 页面上下文检查结果:`, JSON.stringify(result).substring(0, 300));
        console.log(`[OAuth] localStorage 有 user 键: ${result?.hasUser}, /api/user/self 已认证: ${result?.userAuthenticated}`);

        if (result?.success && hasNewApiUserSession(result)) {
          sessionEstablished = true;
          console.log('[OAuth] session 已建立且用户已登录');
          break;
        } else if (result?.success) {
          console.log('[OAuth] 尚未检测到已登录用户 session，继续等待...');
        }
      } catch (e) {
        console.warn(`[OAuth] 验证失败:`, e.message);
      }
    }

    if (!sessionEstablished) {
      console.warn('[OAuth] session 未建立，OAuth 可能失败');
      await closeTabQuietly(tab.id);
      return null;
    }

    // 7.6. 在 OAuth 回调页面刷新，强制浏览器写入新 cookie
    console.log('[OAuth] 在 OAuth 回调页面刷新以写入 cookie...');
    await chrome.tabs.reload(tab.id);
    await waitForTabComplete(tab.id, 15000);
    await sleep(2000);

    // 8. 导航到用户配置页以捕获认证头（session 已在 OAuth 回调页面建立）
    const postLoginUrl = getNewApiPostLoginUrl(domain, visitUrl);
    console.log(`[OAuth] 导航到用户页以捕获认证头: ${postLoginUrl}`);
    await chrome.tabs.update(tab.id, { url: postLoginUrl });
    await waitForTabComplete(tab.id, 15000);
    await sleep(2000);

    // 9. 捕获认证头（刷新首页触发正常的 API 请求，携带有效 session）
    const headers = await captureAuthHeaders(domain, tab.id);
    if (!headers || Object.keys(headers).length === 0) {
      console.warn('[OAuth] 未捕获到认证头');
      await closeTabQuietly(tab.id);
      return null;
    }
    console.log('[OAuth] 捕获到的请求头:', JSON.stringify(Object.keys(headers)));

    // 10. 如果没有捕获到 Cookie，尝试从 chrome.cookies API 读取
    if (!headers['Cookie'] && !headers['cookie']) {
      console.log('[OAuth] 未捕获到 Cookie，尝试从 cookies API 读取...');
      const cookies = await chrome.cookies.getAll({ domain: domain });
      console.log(`[OAuth] cookies API 返回 ${cookies.length} 个 cookie:`, cookies.map(c => c.name));
      if (cookies.length > 0) {
        const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
        headers['Cookie'] = cookieStr;
        console.log(`[OAuth] 设置 Cookie 头: ${cookieStr.substring(0, 100)}...`);
      }
    } else {
      console.log('[OAuth] 已捕获到 Cookie 头');
    }

    // 11. 尝试从 localStorage 读取 token（某些站点使用 localStorage 而非 cookie）
    try {
      console.log('[OAuth] 尝试从 localStorage 读取 token...');
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const token = localStorage.getItem('token') || localStorage.getItem('access_token') || localStorage.getItem('auth_token');
          const allKeys = Object.keys(localStorage);
          return { token, allKeys };
        }
      });
      const result = results[0]?.result;
      console.log('[OAuth] localStorage 所有 key:', result?.allKeys);
      const token = result?.token;
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        console.log('[OAuth] 从 localStorage 读取到 token:', token.substring(0, 20) + '...');
      } else {
        console.log('[OAuth] localStorage 中未找到 token');
      }
    } catch (e) {
      console.warn('[OAuth] 读取 localStorage 失败:', e);
    }

    // 12. 验证捕获的认证头是否有效（测试 /api/status 接口）
    console.log('[OAuth] 验证认证头有效性...');
    console.log('[OAuth] 当前请求头:', JSON.stringify(Object.keys(headers)));
    try {
      const testResult = await doFetchWithHeaders(`https://${domain}/api/status`, 'GET', null, headers);
      console.log('[OAuth] 验证请求返回状态:', testResult.httpStatus);
      console.log('[OAuth] 验证请求返回数据:', JSON.stringify(testResult.data));
      if (testResult.httpStatus === 401) {
        console.warn('[OAuth] 认证头无效（401），可能需要更长等待时间');
        // 再等待一段时间后重试
        await sleep(3000);
        console.log('[OAuth] 等待 3 秒后重新捕获认证头...');
        const retryHeaders = await captureAuthHeaders(domain, tab.id);
        if (retryHeaders && Object.keys(retryHeaders).length > 0) {
          console.log('[OAuth] 重新捕获认证头成功，请求头:', JSON.stringify(Object.keys(retryHeaders)));
          return { headers: retryHeaders, tabId: tab.id };
        } else {
          console.warn('[OAuth] 重新捕获认证头失败');
        }
      } else {
        console.log('[OAuth] 认证头验证通过');
      }
    } catch (e) {
      console.warn('[OAuth] 验证认证头失败:', e);
    }

    return { headers, tabId: tab.id };
  } catch (e) {
    console.error('[OAuth] 失败:', e);
    await closeTabQuietly(tab?.id);
    return null;
  }
}

async function createTemporaryBackgroundTab(url, timeout = 15000) {
  const tab = await chrome.tabs.create(getTemporaryCheckInTabCreateOptions(url));
  await waitForTabComplete(tab.id, timeout);
  tab._autoCreated = true;
  const tabInfo = await chrome.tabs.get(tab.id);
  if (isInvalidTabUrl(tabInfo.url)) {
    await closeTabQuietly(tab.id);
    throw createInvalidSiteError(url);
  }
  return tab;
}

async function closeTabQuietly(tabId) {
  if (!tabId) return;
  try { await chrome.tabs.remove(tabId); } catch (e) {}
}

// 发送通知
// 发送单个站点签到结果通知
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getAutoSignTime() {
  const data = await chrome.storage.local.get('autoSignTime');
  return isValidAutoSignTime(data.autoSignTime) ? data.autoSignTime : GLOBAL_CONFIG.autoSignTime;
}

async function scheduleDailyCheckIn(time) {
  const autoSignTime = isValidAutoSignTime(time) ? time : await getAutoSignTime();
  const nextRun = getNextCheckInTimeFor(autoSignTime);

  await chrome.alarms.clear(DAILY_CHECK_IN_ALARM);
  await chrome.alarms.create(DAILY_CHECK_IN_ALARM, {
    when: nextRun,
    periodInMinutes: 24 * 60
  });

  console.log(`每日签到时间已设置为 ${autoSignTime}`);
  return autoSignTime;
}
