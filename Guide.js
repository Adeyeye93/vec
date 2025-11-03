// Tutorial Spotlight - Content Script
(function() {
  const tutorialOverlay = document.createElement('div');
  tutorialOverlay.id = 'tutorial-overlay';
  
  const tutorialBox = document.createElement('div');
  tutorialBox.id = 'tutorial-box';
  
  const headerContainer = document.createElement('div');
  headerContainer.id = 'tutorial-header';
  
  const instructionText = document.createElement('p');
  instructionText.id = 'tutorial-instruction';
  
  const actionIcon = document.createElement('span');
  actionIcon.id = 'tutorial-action-icon';
  
  headerContainer.appendChild(actionIcon);
  headerContainer.appendChild(instructionText);
  
  const buttonContainer = document.createElement('div');
  buttonContainer.id = 'tutorial-buttons';
  
  const prevBtn = document.createElement('button');
  prevBtn.id = 'tutorial-prev';
  prevBtn.textContent = 'Prev';
  prevBtn.disabled = true;
  
  const nextBtn = document.createElement('button');
  nextBtn.id = 'tutorial-next';
  nextBtn.textContent = 'Next';
  
  const skipBtn = document.createElement('button');
  skipBtn.id = 'tutorial-skip';
  skipBtn.textContent = 'Skip';
  
  const highlightSpotlight = document.createElement('div');
  highlightSpotlight.id = 'tutorial-spotlight';
  
  buttonContainer.appendChild(prevBtn);
  buttonContainer.appendChild(nextBtn);
  buttonContainer.appendChild(skipBtn);
  tutorialBox.appendChild(headerContainer);
  tutorialBox.appendChild(buttonContainer);
  document.body.appendChild(tutorialOverlay);
  document.body.appendChild(highlightSpotlight);
  document.body.appendChild(tutorialBox);
  
  const tutorialStyle = document.createElement('style');
  tutorialStyle.textContent = `
    @import url('${chrome.runtime.getURL('tutorial.css')}');
  `;
  document.head.appendChild(tutorialStyle);

  const actionIcons = {
    'click': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>',
    'input': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"></path></svg>',
    'dropdown': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>',
    'scroll': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"></path></svg>',
    'select': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>',
    'hover': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"></path></svg>',
    'type': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"></path><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>',
    'drag': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="5" r="1"></circle><circle cx="9" cy="19" r="1"></circle><circle cx="9" cy="12" r="1"></circle><circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="19" r="1"></circle><circle cx="15" cy="12" r="1"></circle></svg>',
    'default': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>'
  };

  window.startTutorial = function(steps) {
    let currentStep = 0;
    let currentElement = null;

    function updatePosition(element, offsetX, offsetY) {
      const rect = element.getBoundingClientRect();
      const boxHeight = tutorialBox.offsetHeight;
      const viewportHeight = window.innerHeight;
      
      highlightSpotlight.style.width = rect.width + 'px';
      highlightSpotlight.style.height = rect.height + 'px';
      highlightSpotlight.style.left = rect.left + 'px';
      highlightSpotlight.style.top = rect.top + 'px';

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

      tutorialBox.style.left = boxLeft + 'px';
      tutorialBox.style.top = boxTop + 'px';

      tutorialOverlay.classList.add('active');
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
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      setTimeout(() => {
        updatePosition(targetElement, step.offsetX || 10, step.offsetY || 10);
        instructionText.textContent = step.instruction;
        
        // Set action icon
        const actionType = step.action || 'default';
        actionIcon.innerHTML = actionIcons[actionType] || actionIcons['default'];
        
        // Update button states
        prevBtn.disabled = stepIndex === 0;
        nextBtn.textContent = stepIndex === steps.length - 1 ? 'Finish' : 'Next';
        
        currentStep = stepIndex;
      }, 300);
    }

    nextBtn.addEventListener('click', function() {
      if (currentStep === steps.length - 1) {
        window.endTutorial();
      } else {
        showStep(currentStep + 1);
      }
    });

    prevBtn.addEventListener('click', function() {
      showStep(currentStep - 1);
    });

    skipBtn.addEventListener('click', function() {
      window.endTutorial();
    });

    window.addEventListener('scroll', function() {
      if (currentElement && tutorialOverlay.classList.contains('active')) {
        const rect = currentElement.getBoundingClientRect();
        const step = steps[currentStep];
        updatePosition(currentElement, step.offsetX || 10, step.offsetY || 10);
      }
    });

    window.endTutorial = function() {
      tutorialOverlay.classList.remove('active');
      highlightSpotlight.style.display = 'none';
      tutorialBox.style.display = 'none';
    };

    showStep(0);
  };

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "LOAD_TUTORIAL") {
      const pageSteps = message.pageSteps || [];
      const pageNumber = message.pageNumber;
      const totalPages = message.totalPages;

      console.log(`Loading tutorial page ${pageNumber + 1}/${totalPages}`);

      if (pageSteps.length > 0) {
        window.startTutorial(pageSteps);
        sendResponse({ status: "Tutorial loaded" });
      }
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
      console.log("Tutorial completed!");
    }
  });

  chrome.runtime.sendMessage({
    type: "CONTENT_READY"
  }).catch(() => {});
})();