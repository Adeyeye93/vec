(function () {
  let lastUrl = location.href;
  let lastClickedSelector = null;
  console.log("Content script initialized.");

  // Capture click and notify background immediately
  document.addEventListener(
    "click",
    (e) => {
      lastClickedSelector = getElementXPath(e.target);
      chrome.runtime.sendMessage({
        type: "click_record",
        selector: lastClickedSelector,
        timestamp: Date.now(),
      });
    },
    true
  );

  function getElementXPath(el) {
    if (el.id) {
      return `//*[@id="${el.id}"]`;
    }

    const parts = [];
    while (el && el.nodeType === Node.ELEMENT_NODE) {
      let count = 0;
      let sibling = el.previousSibling;
      while (sibling) {
        if (
          sibling.nodeType === Node.ELEMENT_NODE &&
          sibling.nodeName === el.nodeName
        ) {
          count++;
        }
        sibling = sibling.previousSibling;
      }

      const tagName = el.nodeName.toLowerCase();
      const part = count ? `${tagName}[${count + 1}]` : tagName;

      parts.unshift(part);
      el = el.parentNode;
    }

    return "/" + parts.join("/");
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "GET_PAGE_DATA") {
      const { elements, selectors, truncated } = getInteractiveElements();
      sendResponse({
        success: true,
        elements,
        selectors,
        truncated,
        site: location.hostname,
      });
    }
  });

  // Only elements a user could actually act on — this is what gets sent to
  // the AI, instead of the full page (cheaper, and lets us keep real
  // attributes since we're only describing a handful of elements, not the
  // whole tree). The AI never sees selectors, only an index per element;
  // the real XPath (computed with the same algorithm as click recording,
  // so it stays consistent with the digression-detection logic in
  // background.js) is resolved locally and kept out of the AI payload.
  const INTERACTIVE_SELECTOR = [
    "button",
    "a[href]",
    "input:not([type=hidden])",
    "textarea",
    "select",
    "[role=button]",
    "[role=link]",
    "[role=checkbox]",
    "[role=radio]",
    "[role=tab]",
    "[role=menuitem]",
    "[role=switch]",
    "[onclick]",
    "[contenteditable=true]",
    "summary",
  ].join(",");

  const MAX_INTERACTIVE_ELEMENTS = 200;

  function isVisible(el) {
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    if (parseFloat(style.opacity) === 0) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function getAssociatedLabel(el) {
    if (el.id) {
      const forLabel = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (forLabel) return forLabel.textContent.trim().replace(/\s+/g, " ").slice(0, 60);
    }
    const parentLabel = el.closest("label");
    if (parentLabel) return parentLabel.textContent.trim().replace(/\s+/g, " ").slice(0, 60);
    return null;
  }

  function describeElement(el) {
    const tag = el.tagName.toLowerCase();
    const entry = { tag };

    const type = el.getAttribute("type") || (tag === "a" ? "link" : null);
    if (type) entry.type = type;

    const text = (el.innerText || el.textContent || "").trim().replace(/\s+/g, " ");
    if (text) entry.text = text.length > 60 ? text.slice(0, 60) + "…" : text;

    const placeholder = el.getAttribute("placeholder");
    if (placeholder) entry.placeholder = placeholder;

    const ariaLabel = el.getAttribute("aria-label");
    if (ariaLabel) entry.ariaLabel = ariaLabel;

    const label = getAssociatedLabel(el);
    if (label) entry.label = label;

    if (tag === "select") {
      const options = Array.from(el.options || [])
        .slice(0, 8)
        .map((o) => o.textContent.trim())
        .filter(Boolean);
      if (options.length) entry.options = options;
    }

    if ("disabled" in el && el.disabled) entry.disabled = true;

    return entry;
  }

  // Tags that are never themselves a click target, even if they inherit a
  // pointer cursor from a styled ancestor — skip these outright before
  // paying for getComputedStyle.
  const CURSOR_SCAN_NOISE_TAGS = new Set([
    "script", "style", "meta", "link", "head", "title", "noscript",
    "path", "circle", "rect", "line", "polygon", "polyline", "g", "defs",
    "clippath", "br", "hr", "template", "html", "body",
  ]);

  // Above this many total elements, the full-page cursor scan below risks
  // freezing the tab for one click — skip it and rely on the semantic
  // matches only. Semantic matches (button/input/role=.../etc.) still run
  // regardless of page size.
  const CURSOR_SCAN_ELEMENT_CAP = 6000;

  function hasPointerCursor(el) {
    return window.getComputedStyle(el).cursor === "pointer";
  }

  // Framework-built UIs (React/Vue/etc.) very often make a plain <div> or
  // <span> clickable purely via an addEventListener call, with no HTML
  // signal at all — no role, no tabindex, no inline onclick. The semantic
  // selector above can't see those. A styled pointer cursor is the cheapest
  // reliable tell that an element is meant to be clicked, so it's the
  // fallback net for anything the semantic pass missed.
  function findCursorPointerFallbacks(alreadyMatched) {
    const all = document.body.querySelectorAll("*");
    if (all.length > CURSOR_SCAN_ELEMENT_CAP) return [];

    const already = new Set(alreadyMatched);
    const found = [];

    for (const el of all) {
      if (already.has(el)) continue;
      if (CURSOR_SCAN_NOISE_TAGS.has(el.tagName.toLowerCase())) continue;
      if (el.ownerSVGElement) continue; // test the <svg> itself, not its internals
      if (!isVisible(el)) continue;
      if (!hasPointerCursor(el)) continue;

      // cursor is an inherited CSS property, so every plain text node and
      // wrapper inside a clickable card reports "pointer" too. Only the
      // outermost element of a pointer region is the actual click target —
      // skip anything whose parent already has the same cursor.
      if (el.parentElement && hasPointerCursor(el.parentElement)) continue;

      found.push(el);
    }

    return found;
  }

  // When a wrapper and something inside it both look clickable (a card div
  // styled with cursor:pointer around a real <button>), keep only the
  // innermost one — that's the actual target, the outer one is noise.
  function pruneNestedDuplicates(nodes) {
    return nodes.filter(
      (el) => !nodes.some((other) => other !== el && el.contains(other))
    );
  }

  function inDocumentOrder(a, b) {
    const position = a.compareDocumentPosition(b);
    if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  }

  function getInteractiveElements() {
    const semanticMatches = Array.from(
      document.querySelectorAll(INTERACTIVE_SELECTOR)
    ).filter(isVisible);

    const cursorMatches = findCursorPointerFallbacks(semanticMatches);

    const merged = pruneNestedDuplicates([...semanticMatches, ...cursorMatches]).sort(
      inDocumentOrder
    );

    const truncated = merged.length > MAX_INTERACTIVE_ELEMENTS;
    const nodes = merged.slice(0, MAX_INTERACTIVE_ELEMENTS);

    const elements = [];
    const selectors = {};

    nodes.forEach((el, index) => {
      const entry = describeElement(el);
      entry.index = index;
      elements.push(entry);
      selectors[index] = getElementXPath(el);
    });

    return { elements, selectors, truncated };
  }



  // Build selector string
  // function getElementSelector(el) {
  //   if (!el) return null;
  //   if (el.id) return `#${el.id}`;
  //   if (el.className && typeof el.className === "string") {
  //     const className = el.className.trim().replace(/\s+/g, ".");
  //     return `${el.tagName.toLowerCase()}.${className}`;
  //   }

  //   // fallback: unique path
  //   const path = [];
  //   while (el && el.nodeType === 1) {
  //     let selector = el.nodeName.toLowerCase();
  //     if (el.id) {
  //       selector += `#${el.id}`;
  //       path.unshift(selector);
  //       break;
  //     } else {
  //       let siblingIndex = 1;
  //       let sibling = el;
  //       while (sibling.previousElementSibling) {
  //         sibling = sibling.previousElementSibling;
  //         siblingIndex++;
  //       }
  //       selector += `:nth-child(${siblingIndex})`;
  //     }
  //     path.unshift(selector);
  //     el = el.parentElement;
  //   }
  //   return path.join(" > ");
  // }

  // Notify background of URL change
  function notifyUrlChange(isPageLoad, type) {
    // Ask background for last click if available
    chrome.runtime.sendMessage({ type: "get_last_click" }, (selector) => {
      chrome.runtime.sendMessage({
        type: type || "url_change",
        new_url: location.href,
        selector: selector || null,
        page_load: isPageLoad,
        lastUrl: lastUrl,
      });
    });
  }

  // Full reload detection
  window.addEventListener("load", () => {
    lastUrl = location.href;
    notifyUrlChange(true, "url_change");
    chrome.runtime.sendMessage({ type: "PAGE_LOADED" });
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "URL_CHANGE_CHECK_RESULT") {
      //(message)
    }
  });


  

    function notifyUrl() {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        console.log("SPA navigation detected:");
        notifyUrlChange(false, "spa_url_change");
      }
    }

    /** 1. Patch history.pushState & replaceState */
    const origPush = history.pushState;
    history.pushState = function () {
      origPush.apply(this, arguments);
      setTimeout(notifyUrl, 0);
    };

    const origReplace = history.replaceState;
    history.replaceState = function () {
      origReplace.apply(this, arguments);
      setTimeout(notifyUrl, 0);
    };

    /** 2. Back/forward buttons */
    window.addEventListener("popstate", notifyUrl);

    /** 3. Hash routing */
    window.addEventListener("hashchange", notifyUrl);

    /** 4. Detect <a> click navigation (this is the missing part) */
    document.addEventListener("click", function (e) {
      const anchor = e.target.closest("a");
      if (!anchor) return;

      const url = anchor.href;

      setTimeout(notifyUrl, 0);
  
    });




    // Superseded by getInteractiveElements() above — sending the whole
    // cleaned page body was too expensive token-wise, and stripping every
    // attribute + deleting empty leaf elements meant inputs/images/icon
    // buttons never made it to the AI anyway. Left here in case we need to
    // fall back to whole-page context for something getInteractiveElements()
    // can't handle.
    /*
    function cleanHTML() {
      console.log("Cleaning HTML content...");
      // Clone the body to avoid modifying the actual page
      const bodyClone = document.body.cloneNode(true);
      console.log("Cloned body for cleaning.", bodyClone);

      // Remove all script tags
      const scripts = bodyClone.querySelectorAll("script");
      scripts.forEach((script) => script.remove());

      // Remove all style tags (optional, but saves tokens)
      const styles = bodyClone.querySelectorAll("style");
      styles.forEach((style) => style.remove());

      // Remove all comments
      const walker = document.createTreeWalker(
        bodyClone,
        NodeFilter.SHOW_COMMENT,
        null
      );
      const comments = [];
      let comment;
      while ((comment = walker.nextNode())) {
        comments.push(comment);
      }
      comments.forEach((c) => c.remove());

      // Process all elements to remove attributes and trim text
      const allElements = bodyClone.querySelectorAll("*");

      allElements.forEach((el) => {
        // Remove all attributes
        while (el.attributes.length > 0) {
          el.removeAttribute(el.attributes[0].name);
        }

        // Process text nodes to trim long text
        el.childNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            let text = node.textContent.trim();

            if (text.length > 25) {
              text = text.substring(0, 56) + "...";
            }

            if (text.length > 0) {
              node.textContent = text;
            } else {
              node.remove();
            }
          }
        });
      });

      // Remove empty elements (optional, but helps minimize)
      let hasEmpty = true;
      while (hasEmpty) {
        hasEmpty = false;
        bodyClone.querySelectorAll("*").forEach((el) => {
          if (el.children.length === 0 && el.textContent.trim() === "") {
            el.remove();
            hasEmpty = true;
          }
        });
      }

      // Get the cleaned HTML
      return bodyClone.outerHTML;
    }
    */

})();
