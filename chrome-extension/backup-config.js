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

  root.buildExportConfig = buildExportConfig;
  root.getImportAutoSignTime = getImportAutoSignTime;

  if (typeof module !== 'undefined' && module.exports) {
    const { isValidAutoSignTime } = require('./schedule.js');
    root.isValidAutoSignTime = isValidAutoSignTime;
    module.exports = {
      buildExportConfig,
      getImportAutoSignTime
    };
  }
})(typeof self !== 'undefined' ? self : globalThis);
