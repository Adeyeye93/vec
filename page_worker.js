(function () {
  let lastUrl = location.href;
  let lastClickedSelector = null;

  // Capture click and notify background immediately
  document.addEventListener(
    "click",
    (e) => {
      lastClickedSelector = getElementSelector(e.target);
      chrome.runtime.sendMessage({
        type: "click_record",
        selector: lastClickedSelector,
        timestamp: Date.now(),
      });
    },
    true
  );

  // Build selector string
  function getElementSelector(el) {
    if (!el) return null;
    if (el.id) return `#${el.id}`;
    if (el.className && typeof el.className === "string") {
      const className = el.className.trim().replace(/\s+/g, ".");
      return `${el.tagName.toLowerCase()}.${className}`;
    }

    // fallback: unique path
    const path = [];
    while (el && el.nodeType === 1) {
      let selector = el.nodeName.toLowerCase();
      if (el.id) {
        selector += `#${el.id}`;
        path.unshift(selector);
        break;
      } else {
        let siblingIndex = 1;
        let sibling = el;
        while (sibling.previousElementSibling) {
          sibling = sibling.previousElementSibling;
          siblingIndex++;
        }
        selector += `:nth-child(${siblingIndex})`;
      }
      path.unshift(selector);
      el = el.parentElement;
    }
    return path.join(" > ");
  }

  // Notify background of URL change
  function notifyUrlChange(isPageLoad) {
    // Ask background for last click if available
    chrome.runtime.sendMessage({ type: "get_last_click" }, (selector) => {
      chrome.runtime.sendMessage({
        type: "url_change",
        new_url: location.href,
        selector: selector || null,
        page_load: isPageLoad,
        lastUrl: lastUrl,
      });
    });
  }

  // Detect SPA URL changes (pushState, replaceState)
  const pushState = history.pushState;
  const replaceState = history.replaceState;
  function handleHistoryChange() {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      // For SPA, we still want selector info
      notifyUrlChange(false);
    }
  }
  history.pushState = function (...args) {
    pushState.apply(this, args);
    handleHistoryChange();
  };
  history.replaceState = function (...args) {
    replaceState.apply(this, args);
    handleHistoryChange();
  };
  window.addEventListener("popstate", handleHistoryChange);

  // Full reload detection
  window.addEventListener("load", () => {
    lastUrl = location.href;
    notifyUrlChange(true);
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "URL_CHANGE_CHECK_RESULT") {
    console.log(message)
  }
});
  
})();
