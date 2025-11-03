// Background Script - Tutorial State Manager
console.log("Background script running");

let tutorialState = {
  isActive: false,
  currentPage: 0,
  steps: [],
  completedPages: new Set()
};

// Receive START_PROCESS from popup.js with all tutorial steps
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "START_PROCESS") {
    tutorialState.isActive = true;
    tutorialState.steps = message.steps || [];
    tutorialState.currentPage = 0;
    tutorialState.completedPages.clear();

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        files: ['Guide.js']
      }, () => {
        const currentPageSteps = tutorialState.steps[tutorialState.currentPage] || [];
        
        // Send tutorial steps
        chrome.tabs.sendMessage(tabs[0].id, {
          type: "LOAD_TUTORIAL",
          pageSteps: currentPageSteps,
          pageNumber: tutorialState.currentPage,
          totalPages: tutorialState.steps.length
        });

        // Setup page listeners immediately
        chrome.tabs.sendMessage(tabs[0].id, {
          type: "SETUP_PAGE_LISTENERS",
          steps: currentPageSteps
        });
      });
    });

    sendResponse({ status: "Tutorial started" });
  }
});

// Receive PAGE_WILL_CHANGE from content script when user interacts with page-change element
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "PAGE_WILL_CHANGE") {
    tutorialState.completedPages.add(tutorialState.currentPage);
    tutorialState.currentPage++;

    if (tutorialState.currentPage < tutorialState.steps.length) {
      console.log(`Moving to page ${tutorialState.currentPage + 1}`);
      
      // Listen for the new page to load
      const listener = (details) => {
        if (tutorialState.isActive && tutorialState.currentPage < tutorialState.steps.length) {
          console.log("New page loaded, sending tutorial data...");
          
          const nextPageSteps = tutorialState.steps[tutorialState.currentPage] || [];
          
          // Send tutorial steps for new page
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                files: ['Guide.js']
            }, () => {
                const currentPageSteps = tutorialState.steps[tutorialState.currentPage] || [];
                
                // Send tutorial steps
                chrome.tabs.sendMessage(tabs[0].id, {
                type: "LOAD_TUTORIAL",
                pageSteps: currentPageSteps,
                pageNumber: tutorialState.currentPage,
                totalPages: tutorialState.steps.length
                });

                // Setup page listeners immediately
                chrome.tabs.sendMessage(tabs[0].id, {
                type: "SETUP_PAGE_LISTENERS",
                steps: currentPageSteps
                });
            });
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

    chrome.scripting.executeScript({
      target: { tabId: sender.tab.id },
      files: ['tip.js']
    }, () => {
      // After tip.js injects, send the steps for dots
      chrome.tabs.sendMessage(sender.tab.id, {
        type: "LOAD_DOTS",
        steps: pageSteps
      });
    });

    sendResponse({ status: "Dots injected" });
  }
});

// Listen for content script ready on new pages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "CONTENT_READY") {
    if (tutorialState.isActive) {
      const pageSteps = tutorialState.steps[tutorialState.currentPage] || [];
      
      chrome.tabs.sendMessage(sender.tab.id, {
        type: "LOAD_TUTORIAL",
        pageSteps: pageSteps,
        pageNumber: tutorialState.currentPage,
        totalPages: tutorialState.steps.length
      });

      sendResponse({ status: "Tutorial resumed" });
    } else {
      sendResponse({ status: "No active tutorial" });
    }
  }
});

// Get current tutorial state
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_TUTORIAL_STATE") {
    sendResponse({
      isActive: tutorialState.isActive,
      currentPage: tutorialState.currentPage,
      totalPages: tutorialState.steps.length
    });
  }
});