// Background Script - Tutorial State Manager
console.log("Background script running");
addToStorage("Page", 0).catch((er) => {
  console.log(er);
});
addToStorage("FromToast?", "NO").catch((er) => {
  console.log(er);
});
addToStorage("FirstPage", "").catch((er) => {
  console.log(er);
});
addToStorage("PageMemory", "").catch((er) => {
  console.log(er);
});
addToStorage("activeTabId", -1).catch((er) => {
  console.log(er);
});

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === "NEW_LOAD") {
    addToStorage("PageMemory", msg.url).catch((er) => {
      console.log(er);
    });
  }
});

var Di_step = null;
// background.js (service worker)
importScripts("bg-navigation.js"); // legacy-style import for worker scope
// or you can dynamically `fetch`+`eval` or combine code during build
var last_url = "";
var user_digressed = false;

let process_state = {
  first_stage: [false, 1],
  second_stage: false,
};

let tutorialState = {
  isActive: false,
  currentPage: 0,
  steps: [],
  completedPages: new Set(),
};

// Receive START_PROCESS from popup.js with all tutorial steps
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "START_PROCESS") {
    tutorialState.isActive = true;
    tutorialState.steps = message.steps || [];
    tutorialState.currentPage = 0;
    tutorialState.completedPages.clear();
    process_state.first_stage[0] = true;

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        chrome.tabs.get(tabs[0].id, (tab) => {
          const firstPageLink = tab.url;
          addToStorage("FirstPage", firstPageLink).catch((er) => {
            console.log(er);
          });
          addToStorage("activeTabId", tabs[0].id).catch((er) => {
            console.log(er);
          });
        });
      }
    });

    const currentPageSteps =
      Di_step == null
        ? tutorialState.steps?.[tutorialState.currentPage] ?? []
        : Di_step;

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.scripting.executeScript(
        {
          target: { tabId: tabs[0].id },
          files: ["Guide.js"],
        },
        () => {
          // Send tutorial steps
          chrome.tabs.sendMessage(tabs[0].id, {
            type: "LOAD_TUTORIAL",
            pageSteps: currentPageSteps,
            pageNumber: tutorialState.currentPage,
            totalPages: tutorialState.steps.length,
          });

          // Setup page listeners immediately
          chrome.tabs.sendMessage(tabs[0].id, {
            type: "SETUP_PAGE_LISTENERS",
            steps: currentPageSteps,
          });
        }
      );
    });
  }
});

// Receive PAGE_WILL_CHANGE from content script when user interacts with page-change element
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "PAGE_WILL_CHANGE") {
    tutorialState.completedPages.add(tutorialState.currentPage);
    tutorialState.currentPage++;
    updateStorage("Page", 1);

    if (tutorialState.currentPage < tutorialState.steps.length) {
      console.log(`Moving to page ${tutorialState.currentPage + 1}`);

      // Listen for the new page to load
      const listener = (details) => {
        if (
          tutorialState.isActive &&
          tutorialState.currentPage < tutorialState.steps.length
        ) {
          console.log("New page loaded, sending tutorial data...");

          const nextPageSteps =
            tutorialState.steps[tutorialState.currentPage] || [];

          // Send tutorial steps for new page
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.scripting.executeScript(
              {
                target: { tabId: tabs[0].id },
                files: ["Guide.js"],
              },
              () => {
                const currentPageSteps =
                  tutorialState.steps[tutorialState.currentPage] || [];

                // Send tutorial steps
                chrome.tabs.sendMessage(tabs[0].id, {
                  type: "LOAD_TUTORIAL",
                  pageSteps: currentPageSteps,
                  pageNumber: tutorialState.currentPage,
                  totalPages: tutorialState.steps.length,
                });

                // Setup page listeners immediately
                chrome.tabs.sendMessage(tabs[0].id, {
                  type: "SETUP_PAGE_LISTENERS",
                  steps: currentPageSteps,
                });
              }
            );
          });

          // Remove listener after first use
          chrome.webNavigation.onCompleted.removeListener(listener);
        }
      };

      chrome.webNavigation.onCompleted.addListener(listener);
      sendResponse({ status: "Page change detected, waiting for new page..." });
    } else {
      tutorialState.isActive = false;
      console.log("Tutorial completed!");
      sendResponse({ status: "Tutorial completed" });
    }
  }
});

// Receive FINISH_PROCESS when spotlight finishes, inject dots script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "FINISH_PROCESS") {
    const pageSteps = tutorialState.steps[tutorialState.currentPage] || [];
    process_state.first_stage[0] = false;
    process_state.second_stage = true;

    chrome.scripting.executeScript(
      {
        target: { tabId: sender.tab.id },
        files: ["tip.js"],
      },
      () => {
        // After tip.js injects, send the steps for dots
        chrome.tabs.sendMessage(sender.tab.id, {
          type: "LOAD_DOTS",
          steps: pageSteps,
        });
      }
    );

    sendResponse({ status: "Dots injected" });
  }
});

// Listen for content script ready on new pages

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.type === "CONTENT_READY") {
    if (tutorialState.isActive) {
      const pageSteps = tutorialState.steps[tutorialState.currentPage] || [];
      let toastAction = await getFromStorage("FromToast?");
      if (toastAction !== "YES") {
        chrome.tabs.sendMessage(sender.tab.id, {
          type: "LOAD_TUTORIAL",
          pageSteps: pageSteps,
          pageNumber: tutorialState.currentPage,
          totalPages: tutorialState.steps.length,
        });
      }

      sendResponse({ status: "Tutorial resumed" });
    } else {
      sendResponse({ status: "No active tutorial" });
    }
    updateStorage("FromToast?", "NO");
  }
});

// Get current tutorial state
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_TUTORIAL_STATE") {
    sendResponse({
      isActive: tutorialState.isActive,
      currentPage: tutorialState.currentPage,
      totalPages: tutorialState.steps.length,
    });
  }
});

let lastClickSelector = null;

// Store last click selector when a click occurs
chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  if (msg.type === "click_record") {
    lastClickSelector = msg.selector || null;
    return;
  }

  if (msg.type === "get_last_click") {
    sendResponse(lastClickSelector);
    // clear it so it doesn’t persist forever
    lastClickSelector = null;
    return true;
  }
  if (msg.type === "url_change" && sender.tab && sender.tab.id) {
    lastClickSelector = msg.selector;
    const newUrl = msg.new_url || "";
    // previous page index (the page the user came from)
    const prevIndex = Math.max(0, tutorialState.currentPage - 1);
    const prevPageSteps = tutorialState.steps[prevIndex] || [];
    // infer expected selector for the "last thing the user should do" on the previous page:
    // we assume the last step in prevPageSteps describes that action
    let expectedSelector;
    if (Array.isArray(prevPageSteps) && prevPageSteps.length) {
      const lastStep = prevPageSteps[prevPageSteps.length - 1];
      expectedSelector =
        lastStep.selector || lastStep.expectedSelector || lastStep.target;
    }

    let fromtoast = await getFromStorage("FromToast?");
    let pm = await getFromStorage("PageMemory");

    const selectorMatches =
      lastClickSelector && expectedSelector
        ? lastClickSelector === expectedSelector
        : false;

    if (
      !selectorMatches &&
      lastClickSelector != null &&
      tutorialState.isActive &&
      fromtoast == "NO" &&
      pm != newUrl
    ) {
      user_digressed = true;
      chrome.scripting.executeScript(
        {
          target: { tabId: sender.tab.id },
          files: ["toast.js"],
        },
        () => {
          chrome.tabs.sendMessage(sender.tab.id, {
            type: "showTutorialInterruptedToast",
            lastClickSelector,
          });
        }
      );
    } else {
      last_url = msg.lastUrl || "";
      if (sender && sender.tab && sender.tab.id !== undefined) {
        chrome.tabs.sendMessage(sender.tab.id, {
          type: "URL_CHANGE_CHECK_RESULT",
          expectedSelector: expectedSelector || null,
          lastClickSelector,
          selectorMatches,
        });
      }
    }

    // notify the content script (or popup) about the check result

    // clear lastClickSelector so it won't persist across unrelated actions
    lastClickSelector = null;
    return;
  }
  if (msg.type === "CONTINUE_PROCESS") {
    console.log("Continuing tutorial process to URL:", last_url);
    updateStorage("FromToast?", "YES");
    const targetUrl = last_url;
    const tabId = sender && sender.tab && sender.tab.id;

    const handleNavigationAndSendDots = (id) => {
      chrome.tabs.update(id, { url: targetUrl, autoDiscardable: true }, () => {
        const onCompleted = async (details) => {
          if (details.tabId === id && details.url === targetUrl) {
            const pageSteps =
              tutorialState.steps[tutorialState.currentPage] || [];
            const currentPageSteps =
              tutorialState.steps[tutorialState.currentPage] || [];
            const lastOnly = currentPageSteps.slice(-1);
            Di_step = lastOnly;
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
              chrome.scripting.executeScript(
                {
                  target: { tabId: tabs[0].id },
                  files: ["Guide.js"],
                },
                () => {
                  console.log("Sending last step only:", lastOnly);

                  chrome.tabs.sendMessage(id, {
                    type: "LOAD_TUTORIAL",
                    pageSteps: lastOnly,
                    pageNumber: tutorialState.currentPage,
                    totalPages: tutorialState.steps.length,
                  });

                  chrome.tabs.sendMessage(tabs[0].id, {
                    type: "SETUP_PAGE_LISTENERS",
                    steps: currentPageSteps,
                  });
                }
              );
            });
            chrome.webNavigation.onCompleted.removeListener(onCompleted);
            sendResponse({ status: "navigated", url: targetUrl });
          }
        };
        chrome.webNavigation.onCompleted.addListener(onCompleted);
      });
    };

    if (tabId !== undefined) {
      handleNavigationAndSendDots(tabId);
    } else {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0]) {
          handleNavigationAndSendDots(tabs[0].id);
        } else {
          sendResponse({ status: "error", message: "No active tab found." });
        }
      });
    }

    return true;
  }

  if (msg.type === "RESTART_PROCESS") {
    tutorialState.isActive = true;
    tutorialState.currentPage = 0;
    tutorialState.completedPages.clear();
    updateStorage("Page", 0);
    updateStorage("FromToast?", "YES");

    firstPageLink = await getFromStorage("FirstPage");

    chrome.tabs.update(
      sender.tab.id,
      { url: firstPageLink, autoDiscardable: true },
      () => {
        const onCompleted = (details) => {
          if (
            details.tabId === sender.tab.id &&
            details.url === firstPageLink
          ) {
            const currentPageSteps =
              tutorialState.steps[tutorialState.currentPage] || [];
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
              chrome.scripting.executeScript(
                {
                  target: { tabId: tabs[0].id },
                  files: ["Guide.js"],
                },
                () => {
                  // Send tutorial steps
                  chrome.tabs.sendMessage(tabs[0].id, {
                    type: "LOAD_TUTORIAL",
                    pageSteps: currentPageSteps,
                    pageNumber: tutorialState.currentPage,
                    totalPages: tutorialState.steps.length,
                  });

                  // Setup page listeners immediately
                  chrome.tabs.sendMessage(tabs[0].id, {
                    type: "SETUP_PAGE_LISTENERS",
                    steps: currentPageSteps,
                  });
                }
              );
            });
            chrome.webNavigation.onCompleted.removeListener(onCompleted);
            sendResponse({ status: "Tutorial restarted." });
          }
        };
        chrome.webNavigation.onCompleted.addListener(onCompleted);
      }
    );

    return true;
  }

  if (msg.type === "BREAK_PROCESS") {
    tutorialState.isActive = false;
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0].id;

      chrome.tabs.sendMessage(
        tabId,
        { type: "check_flash_injected" },
        (response) => {
          if (chrome.runtime.lastError || !response) {
            chrome.scripting.executeScript(
              {
                target: { tabId },
                files: ["flash.js"],
              },
              () => {
                chrome.tabs.sendMessage(tabId, {
                  type: "showFlashToast",
                  message: "The tutorial has been skipped.",
                  duration: 2000,
                });
              }
            );
          } else {
            chrome.tabs.sendMessage(tabId, {
              type: "showFlashToast",
              message: "The tutorial has been skipped.",
              duration: 2000,
            });
          }
        }
      );
    });
  }

  let at = await getFromStorage("activeTabId");
  let pm = await getFromStorage("PageMemory");

  if (
    msg.type === "PAGE_LOADED" &&
    tutorialState.isActive &&
    at == sender.tab.id &&
    pm === sender.tab.url
  ) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0].id;
      chrome.tabs.sendMessage(
        tabId,
        { type: "check_flash_injected" },
        (response) => {
          if (chrome.runtime.lastError || !response) {
            chrome.scripting.executeScript(
              {
                target: { tabId },
                files: ["flash.js", "Guide.js", "tip.js"],
              },
              () => {
                const currentPageSteps =
                  tutorialState.steps[tutorialState.currentPage] || [];
                let user_last_step = process_state.first_stage[1];
                const stepNumber = Number.parseInt(user_last_step, 10) || 1;
                const startIndex = Math.max(0, stepNumber - 1);
                const slicedSteps = currentPageSteps.slice(startIndex);

                if (
                  process_state.first_stage[0] === true &&
                  process_state.second_stage === false
                ) {
                  Di_step = slicedSteps;
                  chrome.tabs.sendMessage(tabId, {
                    type: "LOAD_TUTORIAL",
                    pageSteps: slicedSteps,
                    pageNumber: tutorialState.currentPage,
                    totalPages: tutorialState.steps.length,
                  });
                } else {
                  console.log("Removing guide as tutorial is in dots stage.");
                  chrome.tabs.sendMessage(tabId, {
                    type: "REMOVE_GUIDE",
                  });
                }
                chrome.tabs.sendMessage(tabId, {
                  type: "showFlashToast",
                  message: "Looks like the page reloaded. Tutorial resumed.",
                  duration: 3000,
                });
              }
            );
          } else {
            chrome.tabs.sendMessage(tabId, {
              type: "showFlashToast",
              message: "Looks like the page reloaded. Tutorial resumed.",
              duration: 3000,
            });
          }
        }
      );
    });
  }

  if (msg.type === "NEXT_STEP_CLICKED") {
    process_state.first_stage[1] += 1;
  }

  if (msg.type === "PREV_STEP_CLICKED") {
    process_state.first_stage[1] -= 1;
  }

  if (msg.type === "LOAD_ALART") {
  }
});

// Background-safe storage using chrome.storage.local
// Replace the content-script localStorage usage with this background script.
// Use as a background/service-worker script (Manifest V3) or background page (MV2).

// Add item to chrome.storage.local
function addToStorage(key, value) {
  return new Promise((resolve, reject) => {
    try {
      const payload = { [key]: value };
      chrome.storage.local.set(payload, () => {
        if (chrome.runtime.lastError)
          return reject(new Error(chrome.runtime.lastError.message));
        console.log(`Added to storage: ${key}`, value);
        resolve(true);
      });
    } catch (err) {
      reject(err);
    }
  });
}

// Remove item from chrome.storage.local
function removeFromStorage(key) {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.remove(key, () => {
        if (chrome.runtime.lastError)
          return reject(new Error(chrome.runtime.lastError.message));
        console.log(`Removed from storage: ${key}`);
        resolve(true);
      });
    } catch (err) {
      reject(err);
    }
  });
}

// Get item from chrome.storage.local
function getFromStorage(key) {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.get([key], (result) => {
        if (chrome.runtime.lastError)
          return reject(new Error(chrome.runtime.lastError.message));
        resolve(result.hasOwnProperty(key) ? result[key] : null);
      });
    } catch (err) {
      reject(err);
    }
  });
}

// Update (set) item in chrome.storage.local
function updateStorage(key, value) {
  // For chrome.storage.local, set overrides existing entry.
  if (key === "Page" && (value === 1 || value === 0)) {
    getFromStorage(key).then(async (current) => {
      const currentNum =
        typeof current === "number"
          ? current
          : Number.parseInt(current, 10) || 0;
      const newValue = currentNum + (value === 1 ? 1 : -1);
      await addToStorage(key, newValue);
      console.log(newValue);
      return newValue;
    });
  } else {
    getFromStorage(key).then(async (current) => {
      if (current === null) {
        // Key does not exist, add it
        await addToStorage(key, value);
      } else {
        // Key exists, update it
        await addToStorage(key, value);
      }
    });
  }
}

// Update specific property in stored object
async function updateStorageProperty(key, property, value) {
  const currentData = await getFromStorage(key);
  const data = currentData == null ? {} : currentData;
  if (typeof data !== "object" || Array.isArray(data)) {
    return Promise.reject(
      new Error("Cannot update property on non-object value")
    );
  }
  data[property] = value;
  return await addToStorage(key, data);
}

// Clear all storage
function clearAllStorage() {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.clear(() => {
        if (chrome.runtime.lastError)
          return reject(new Error(chrome.runtime.lastError.message));
        console.log("Cleared all storage");
        resolve(true);
      });
    } catch (err) {
      reject(err);
    }
  });
}

// Message listener (background)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    const { action, key, value, property } = message;

    const respond = (p) => {
      p.then((res) => sendResponse({ success: true, data: res })).catch((err) =>
        sendResponse({ success: false, error: err && err.message })
      );
      return true; // keep channel open for async response
    };

    switch (action) {
      case "add":
        return respond(addToStorage(key, value));

      case "remove":
        return respond(removeFromStorage(key));

      case "get":
        return respond(getFromStorage(key));

      case "update": {
        // Special handling for Page increments/decrements
        if (key === "Page" && (value === 1 || value === 0)) {
          return respond(
            getFromStorage(key).then(async (current) => {
              const currentNum =
                typeof current === "number"
                  ? current
                  : Number.parseInt(current, 10) || 0;
              const newValue = currentNum + (value === 1 ? 1 : -1);
              updateStorage(key, newValue);
              return newValue;
            })
          );
        }
        return respond(updateStorage(key, value));
      }

      case "updateProperty":
        return respond(updateStorageProperty(key, property, value));

      case "clear":
        return respond(clearAllStorage());

      default:
        sendResponse({ success: false, error: "Unknown action" });
        return false;
    }
  } catch (error) {
    sendResponse({ success: false, error: error && error.message });
    return false;
  }
});
