(function(root) {
  const DEFAULT_SITE_PAGE_PATH = '/console/personal';

  function normalizeUrlInput(input) {
    const trimmed = String(input || '').trim();
    if (!trimmed) return null;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (trimmed.includes('/')) return `https://${trimmed}`;
    return null;
  }

  function applySiteMode(site, mode) {
    if (mode === 'visit') {
      return { ...site, mode: 'visit' };
    }
    return site;
  }

  function parseSiteInput(input, mode = 'checkin') {
    const rawInput = String(input || '').trim();
    const trimmed = rawInput.toLowerCase();
    if (!trimmed) return null;

    const normalizedUrl = normalizeUrlInput(rawInput);
    if (normalizedUrl) {
      try {
        const url = new URL(normalizedUrl);
        if (!url.hostname || !url.hostname.includes('.')) return null;
        const domain = url.hostname.toLowerCase();
        return applySiteMode({
          domain,
          name: domain,
          enabled: true,
          pageUrl: url.href
        }, mode);
      } catch (e) {
        return null;
      }
    }

    const domain = trimmed.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!domain || !domain.includes('.')) return null;
    return applySiteMode({
      domain,
      name: domain,
      enabled: true
    }, mode);
  }

  function getSitePageUrl(site) {
    if (site?.pageUrl) return site.pageUrl;
    return `https://${site.domain}${DEFAULT_SITE_PAGE_PATH}`;
  }

  root.parseSiteInput = parseSiteInput;
  root.getSitePageUrl = getSitePageUrl;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      parseSiteInput,
      getSitePageUrl
    };
  }
})(typeof self !== 'undefined' ? self : globalThis);
