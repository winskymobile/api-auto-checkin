(function(root) {
  function buildExportConfig(sites, autoSignTime) {
    const config = { sites };
    if (typeof root.isValidAutoSignTime === 'function' && root.isValidAutoSignTime(autoSignTime)) {
      config.autoSignTime = autoSignTime;
    }
    return config;
  }

  function getImportAutoSignTime(config) {
    const time = config?.autoSignTime;
    if (typeof root.isValidAutoSignTime === 'function' && root.isValidAutoSignTime(time)) {
      return time;
    }
    return null;
  }

  function normalizeImportSites(sites) {
    if (!Array.isArray(sites)) return [];
    return sites
      .filter(site => site?.domain && typeof site.domain === 'string')
      .map(site => {
        if (site.mode === 'visit' || site.type) return site;
        return { ...site, type: 'auto' };
      });
  }

  function buildImportSites(currentSites, validSites, mode) {
    if (mode === 'cancel') return null;
    if (mode === 'replace' || !Array.isArray(currentSites) || currentSites.length === 0) {
      return validSites;
    }

    const existingDomains = new Set(currentSites.map(site => site.domain));
    const newSites = validSites.filter(site => !existingDomains.has(site.domain));
    return {
      sites: [...currentSites, ...newSites],
      newCount: newSites.length
    };
  }

  root.buildExportConfig = buildExportConfig;
  root.buildImportSites = buildImportSites;
  root.getImportAutoSignTime = getImportAutoSignTime;
  root.normalizeImportSites = normalizeImportSites;

  if (typeof module !== 'undefined' && module.exports) {
    const { isValidAutoSignTime } = require('./schedule.js');
    root.isValidAutoSignTime = isValidAutoSignTime;
    module.exports = {
      buildExportConfig,
      buildImportSites,
      getImportAutoSignTime,
      normalizeImportSites
    };
  }
})(typeof self !== 'undefined' ? self : globalThis);
