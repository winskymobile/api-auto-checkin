(function(root) {
  function getSiteActionDisplayName(site) {
    return site?.name || site?.domain || '该站点';
  }

  function getSiteModeView(site = {}) {
    const mode = site.mode === 'visit' ? 'visit' : 'checkin';
    if (mode === 'visit') {
      return {
        mode,
        nextMode: 'checkin',
        label: '访问',
        title: '点击切换为自动签到模式',
        className: 'visit'
      };
    }

    return {
      mode,
      nextMode: 'visit',
      label: '自动',
      title: '点击切换为访问模式',
      className: ''
    };
  }

  function getSwitchedSiteMode(site = {}) {
    const view = getSiteModeView(site);
    if (view.nextMode === 'visit') {
      return { ...site, mode: 'visit' };
    }

    const nextSite = { ...site };
    delete nextSite.mode;
    if (nextSite.type === 'visit' || !nextSite.type) {
      nextSite.type = 'auto';
    }
    return nextSite;
  }

  function buildModeSwitchConfirmationMessage(site = {}) {
    const view = getSiteModeView(site);
    const targetLabel = view.nextMode === 'visit' ? '访问模式' : '自动签到模式';
    return `确定将 ${getSiteActionDisplayName(site)} 切换为${targetLabel}？`;
  }

  function normalizeSiteRename(value) {
    const name = String(value || '').trim();
    return name || null;
  }

  root.getSiteActionDisplayName = getSiteActionDisplayName;
  root.getSiteModeView = getSiteModeView;
  root.getSwitchedSiteMode = getSwitchedSiteMode;
  root.buildModeSwitchConfirmationMessage = buildModeSwitchConfirmationMessage;
  root.normalizeSiteRename = normalizeSiteRename;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      buildModeSwitchConfirmationMessage,
      getSiteActionDisplayName,
      getSiteModeView,
      getSwitchedSiteMode,
      normalizeSiteRename
    };
  }
})(typeof self !== 'undefined' ? self : globalThis);
