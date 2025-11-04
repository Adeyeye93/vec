let start = document.getElementById("start");


const tutorialSteps = [
  // Page 1
  [
    {
      selector: '#target',
      instruction: 'Welcome! Start by clicking this button',
      action: 'click'
    },
    {
      selector: '#target2',
      instruction: 'Read this heading to understand what to do next',
      action: 'hover'
    },
    {
      selector: 'a#target3 > button:nth-child(1)',
      instruction: 'Now fill in the required information',
      action: 'input',
      will_change_page: true
    }
  ],
  // Page 2
  [
    {
      selector: '#target4',
      instruction: 'Great! Now review the details',
      action: 'scroll'
    },
    {
      selector: '#target5',
      instruction: 'Make sure everything looks correct',
      action: 'select'
    },
    {
      selector: '#target6',
      instruction: 'Finally, click submit to complete',
      action: 'click',
      will_change_page: true
    }
  ]
];

start.addEventListener("click", async () => {
try {
    const response = await chrome.runtime.sendMessage({ 
        type: "START_PROCESS",
        steps: tutorialSteps
     });
    console.log("Background response:", response);
} catch (error) {
    console.error("Failed to send message to background script:", error);
}
});