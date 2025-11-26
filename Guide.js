// Tutorial Spotlight - Content Script with Progress Ring
(function () {
  const tutorialOverlay = document.createElement("div");
  tutorialOverlay.id = "tutorial-overlay";

  const tutorialBox = document.createElement("div");
  tutorialBox.id = "tutorial-box";

  const headerContainer = document.createElement("div");
  headerContainer.id = "tutorial-header";

  const progressRing = document.createElement("div");
  progressRing.id = "tutorial-progress-ring";

  const instructionText = document.createElement("p");
  instructionText.id = "tutorial-instruction";

  const actionIcon = document.createElement("span");
  actionIcon.id = "tutorial-action-icon";

  headerContainer.appendChild(progressRing);
  headerContainer.appendChild(actionIcon);
  headerContainer.appendChild(instructionText);

  const buttonContainer = document.createElement("div");
  buttonContainer.id = "tutorial-buttons";

  const prevBtn = document.createElement("button");
  prevBtn.id = "tutorial-prev";
  prevBtn.textContent = "Prev";
  prevBtn.disabled = true;

  const nextBtn = document.createElement("button");
  nextBtn.id = "tutorial-next";
  nextBtn.textContent = "Next";

  const skipBtn = document.createElement("button");
  skipBtn.id = "tutorial-skip";
  skipBtn.textContent = "Skip";

  const highlightSpotlight = document.createElement("div");
  highlightSpotlight.id = "tutorial-spotlight";

  buttonContainer.appendChild(prevBtn);
  buttonContainer.appendChild(nextBtn);
  buttonContainer.appendChild(skipBtn);
  tutorialBox.appendChild(headerContainer);
  tutorialBox.appendChild(buttonContainer);
  document.body.appendChild(tutorialOverlay);
  document.body.appendChild(highlightSpotlight);
  document.body.appendChild(tutorialBox);

  const tutorialStyle = document.createElement("style");
  tutorialStyle.textContent = `
    @import url('${chrome.runtime.getURL("tutorial.css")}');
    
    #tutorial-progress-ring {
      display: flex;
      gap: 2px;
      margin-right: 8px;
    }

    .progress-segment {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background-color: #d0d0d0;
      transition: background-color 0.3s ease;
    }

    .progress-segment.completed {
      background-color: #4CAF50;
    }

    .progress-segment.active {
      background-color: #4CAF50;
      animation: pulse 1.5s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }
  `;
  document.head.appendChild(tutorialStyle);

  const actionIcons = {
    click:
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>',
    input:
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"></path></svg>',
    dropdown:
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>',
    scroll:
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"></path></svg>',
    select:
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>',
    hover:
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"></path></svg>',
    type: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"></path><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>',
    drag: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="5" r="1"></circle><circle cx="9" cy="19" r="1"></circle><circle cx="9" cy="12" r="1"></circle><circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="19" r="1"></circle><circle cx="15" cy="12" r="1"></circle></svg>',
    default:
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>',
  };

  // Typing animation function
  let typingTimeout;
  function typeText(element, text, speed = 30) {
    clearTimeout(typingTimeout);
    element.textContent = "";
    let index = 0;

    function type() {
      if (index < text.length) {
        element.textContent += text.charAt(index);
        index++;
        typingTimeout = setTimeout(type, speed);
      }
    }

    type();
  }

  function createProgressRing(totalSteps) {
    progressRing.innerHTML = "";
    for (let i = 0; i < totalSteps; i++) {
      const segment = document.createElement("div");
      segment.className = "progress-segment";
      segment.id = `progress-segment-${i}`;
      progressRing.appendChild(segment);
    }
  }

  function updateProgressRing(currentStepIndex, totalSteps) {
    for (let i = 0; i < totalSteps; i++) {
      const segment = document.getElementById(`progress-segment-${i}`);
      if (segment) {
        segment.classList.remove("completed", "active");
        if (i < currentStepIndex) {
          segment.classList.add("completed");
        } else if (i === currentStepIndex) {
          segment.classList.add("active");
        }
      }
    }
  }

  window.startTutorial = function (steps) {
    let currentStep = 0;
    let currentElement = null;

    // Create progress ring with total steps
    createProgressRing(steps.length);

    function updatePosition(element, offsetX, offsetY) {
      const rect = element.getBoundingClientRect();
      const boxHeight = tutorialBox.offsetHeight;
      const viewportHeight = window.innerHeight;

      highlightSpotlight.style.width = rect.width + "px";
      highlightSpotlight.style.height = rect.height + "px";
      highlightSpotlight.style.left = rect.left + "px";
      highlightSpotlight.style.top = rect.top + "px";

      let boxTop = rect.top + rect.height + offsetY;

      if (boxTop + boxHeight > viewportHeight - 10) {
        boxTop = rect.top - boxHeight - offsetY;
      }

      let boxLeft = rect.left + offsetX;
      if (boxLeft + 300 > window.innerWidth - 10) {
        boxLeft = window.innerWidth - 310;
      }
      if (boxLeft < 10) {
        boxLeft = 10;
      }

      tutorialBox.style.left = boxLeft + "px";
      tutorialBox.style.top = boxTop + "px";

      tutorialOverlay.classList.add("active");
    }

    function showStep(stepIndex) {
      if (stepIndex >= steps.length || stepIndex < 0) {
        return;
      }

      const step = steps[stepIndex];
      const targetElement = document.querySelector(step.selector);

      if (!targetElement) {
        console.warn(`Element not found: ${step.selector}`);
        return;
      }

      currentElement = targetElement;
      targetElement.scrollIntoView({ behavior: "smooth", block: "center" });

      setTimeout(() => {
        updatePosition(targetElement, step.offsetX || 10, step.offsetY || 10);

        // Use typing animation for instruction text
        typeText(instructionText, step.instruction, 30);

        // Set action icon
        const actionType = step.action || "default";
        actionIcon.innerHTML =
          actionIcons[actionType] || actionIcons["default"];

        // Update progress ring
        updateProgressRing(stepIndex, steps.length);

        // Update button states
        prevBtn.disabled = stepIndex === 0;
        nextBtn.textContent =
          stepIndex === steps.length - 1 ? "Finish" : "Next";

        currentStep = stepIndex;
      }, 300);
    }

    nextBtn.addEventListener("click", function () {
      const currentStepData = steps[currentStep];

      //(currentStepData.conclude_tutorial);

      // Check if this step concludes the tutorial
      if (currentStepData.conclude_tutorial) {
        //("Tutorial concluded!");
        chrome.runtime
          .sendMessage({
            type: "TUTORIAL_CONCLUDED",
          })
          .catch(() => {});
        window.endTutorial();
        return;
      }

      if (currentStep === steps.length - 1) {
        //("NEXT clicked - Final step");
        chrome.runtime
          .sendMessage({
            type: "NEXT_STEP_CLICKED",
          })
          .catch(() => {});
        window.endTutorial();
      } else {
        //("NEXT clicked");
        chrome.runtime
          .sendMessage({
            type: "NEXT_STEP_CLICKED",
          })
          .catch(() => {});
        showStep(currentStep + 1);
      }
    });

    prevBtn.addEventListener("click", function () {
      showStep(currentStep - 1);
      //("PREV clicked");

      chrome.runtime
        .sendMessage({
          type: "PREV_STEP_CLICKED",
        })
        .catch(() => {});
    });

    skipBtn.addEventListener("click", function () {
      window.endTutorial();
    });

    window.addEventListener("scroll", function () {
      if (currentElement && tutorialOverlay.classList.contains("active")) {
        const rect = currentElement.getBoundingClientRect();
        const step = steps[currentStep];
        updatePosition(currentElement, step.offsetX || 10, step.offsetY || 10);
      }
    });

    window.endTutorial = function () {
      clearTimeout(typingTimeout);
      tutorialOverlay.classList.remove("active");
      highlightSpotlight.style.display = "none";
      tutorialBox.style.display = "none";
      tutorialOverlay.style.display = "none";

      chrome.runtime
        .sendMessage({
          type: "FINISH_PROCESS",
        })
        .catch(() => {});
    };

    showStep(0);
  };

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "LOAD_TUTORIAL") {
      const pageSteps = message.pageSteps || [];
      const pageNumber = message.pageNumber;
      const totalPages = message.totalPages;

      //(`Loading tutorial page ${pageNumber + 1}/${totalPages}`);
      //(pageSteps);

      if (pageSteps.length > 0) {
        window.startTutorial(pageSteps);
        sendResponse({ status: "Tutorial loaded" });
      }
    }

    if (message.type === "REMOVE_GUIDE") {
      window.endTutorial();
    }

    if (message.type === "LOAD_DOTS") {
      const steps = message.steps || [];
      if (steps.length > 0) {
        if (window.addTutorialDots) {
          window.addTutorialDots(steps);
          sendResponse({ status: "Dots loaded" });
        }
      }
    }

    if (message.type === "TUTORIAL_COMPLETE") {
      window.endTutorial();
      //("Tutorial completed!");
    }
  });

  chrome.runtime
    .sendMessage({
      type: "CONTENT_READY",
    })
    .catch(() => {});

  //("Tutorial Spotlight content script initialized");
})();
