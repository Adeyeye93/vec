console.log("Content script running");
// Page Change Listener - Detects when user interacts with page-change elements
(function() {
  console.log("Page change listener loaded");

  let pageChangeElements = [];
  let pageWontChangeElements = [];

  // Listen for tutorial steps that include page-change metadata
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "SETUP_PAGE_LISTENERS") {
      const steps = message.steps || [];
      
      pageChangeElements = [];
      pageWontChangeElements = [];

      steps.forEach((step) => {
        // Elements that trigger page change
        if (step.will_change_page) {
          const element = document.querySelector(step.selector);
          if (element) {
            pageChangeElements.push(element);
            console.log(`Registered page-change element: ${step.selector}`);
          }
        }
        
        // Elements that don't trigger page change
        if (step.wont_change_page) {
          const element = document.querySelector(step.selector);
          if (element) {
            pageWontChangeElements.push(element);
            console.log(`Registered non-change element: ${step.selector}`);
          }
        }
      });

      // Attach listeners to page-change elements
      pageChangeElements.forEach((element) => {
        element.addEventListener('click', handlePageChange);
      });

      sendResponse({ status: "Page listeners setup" });
    }
  });

  function handlePageChange(event) {
    console.log("Page change element clicked!");
    
    // Notify background script that page will change
    chrome.runtime.sendMessage({
      type: "PAGE_WILL_CHANGE"
    }, (response) => {
      console.log("Background response:", response);
    });
  }

  // Optional: Listen for navigation changes if you need to detect route changes
  // This helps if your site uses SPAs (Single Page Apps) instead of full page reloads
  window.addEventListener('beforeunload', () => {
    console.log("Page unloading");
  });
})();