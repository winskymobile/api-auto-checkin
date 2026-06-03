(function(root) {
  function getNewApiPostLoginUrl(domain, visitUrl) {
    return visitUrl || `https://${domain}/console/personal`;
  }

  function hasNewApiUserSession(session) {
    return Boolean(session?.userAuthenticated || session?.hasUser);
  }

  root.getNewApiPostLoginUrl = getNewApiPostLoginUrl;
  root.hasNewApiUserSession = hasNewApiUserSession;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      getNewApiPostLoginUrl,
      hasNewApiUserSession
    };
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
