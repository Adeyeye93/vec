// Listen for messages from background script
// chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
//   if (request.action === 'showTutorialInterruptedToast') {
    
//   }
// });

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "showTutorialInterruptedToast") {
    console.log(message)
    showTutorialToast();
    sendResponse({ success: true });
  }
});

function showTutorialToast() {
  // Create toast container
  const toastContainer = document.createElement('div');
  toastContainer.id = 'tutorial-toast-container';
  toastContainer.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background-color: #fff;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    padding: 20px;
    max-width: 400px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    z-index: 10000;
    animation: slideIn 0.3s ease-out;
  `;

  // Create message text
  const messageText = document.createElement('p');
  messageText.style.cssText = `
    margin: 0 0 15px 0;
    font-size: 14px;
    color: #333;
    line-height: 1.5;
  `;
  messageText.textContent = 'Tutorial interrupted - you navigated away from the expected path. Would you like to...';

  // Create buttons container
  const buttonsContainer = document.createElement('div');
  buttonsContainer.style.cssText = `
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  `;

  // Create Continue button
  const continueBtn = document.createElement('button');
  continueBtn.textContent = 'Continue';
  continueBtn.id = 'tutorial-continue-btn';
  continueBtn.style.cssText = `
    flex: 1;
    min-width: 80px;
    padding: 8px 12px;
    background-color: #4CAF50;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    transition: background-color 0.2s;
  `;
  continueBtn.onmouseover = () => continueBtn.style.backgroundColor = '#45a049';
  continueBtn.onmouseout = () => continueBtn.style.backgroundColor = '#4CAF50';

  // Create Restart button
  const restartBtn = document.createElement('button');
  restartBtn.textContent = 'Restart';
  restartBtn.id = 'tutorial-restart-btn';
  restartBtn.style.cssText = `
    flex: 1;
    min-width: 80px;
    padding: 8px 12px;
    background-color: #2196F3;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    transition: background-color 0.2s;
  `;
  restartBtn.onmouseover = () => restartBtn.style.backgroundColor = '#0b7dda';
  restartBtn.onmouseout = () => restartBtn.style.backgroundColor = '#2196F3';

  // Create Break Leave button
  const breakBtn = document.createElement('button');
  breakBtn.textContent = 'Break Leave';
  breakBtn.id = 'tutorial-break-btn';
  breakBtn.style.cssText = `
    flex: 1;
    min-width: 80px;
    padding: 8px 12px;
    background-color: #f44336;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    transition: background-color 0.2s;
  `;
  breakBtn.onmouseover = () => breakBtn.style.backgroundColor = '#da190b';
  breakBtn.onmouseout = () => breakBtn.style.backgroundColor = '#f44336';

  // Add event listeners
  continueBtn.addEventListener('click', handleContinue);
  restartBtn.addEventListener('click', handleRestart);
  breakBtn.addEventListener('click', handleBreak);

  // Assemble toast
  buttonsContainer.appendChild(continueBtn);
  buttonsContainer.appendChild(restartBtn);
  buttonsContainer.appendChild(breakBtn);

  toastContainer.appendChild(messageText);
  toastContainer.appendChild(buttonsContainer);
  document.body.appendChild(toastContainer);

  // Add animation keyframes
  if (!document.querySelector('style[data-tutorial-toast]')) {
    const style = document.createElement('style');
    style.setAttribute('data-tutorial-toast', 'true');
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style);
  }
}

function removeToast() {
  const toast = document.getElementById('tutorial-toast-container');
  if (toast) {
    toast.style.animation = 'slideIn 0.3s ease-out reverse';
    setTimeout(() => toast.remove(), 300);
  }
}

// Event listener for Continue button
function handleContinue(event) {
  console.log('Continue button clicked');
  removeToast();
  // TODO: Add your continue action here
}

// Event listener for Restart button
function handleRestart(event) {
  console.log('Restart button clicked');
  removeToast();
  // TODO: Add your restart action here
}

// Event listener for Break Leave button
function handleBreak(event) {
  console.log('Break Leave button clicked');
  removeToast();
  // TODO: Add your break/leave action here
}