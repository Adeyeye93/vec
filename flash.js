// Flash message toast with slide and fade animation
function showFlashMessage(message = "Tutorial Interrupted!", duration = 2000) {
  // Create container
  const container = document.createElement('div');
  container.id = 'flash-toast-container';
  container.innerHTML = `
    <div class="flash-toast-message">
      ${message}
    </div>
  `;

  // Add styles
  const style = document.createElement('style');
  style.textContent = `
    #flash-toast-container {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 10000;
      display: flex;
      justify-content: center;
      padding-top: 20px;
      pointer-events: none;
    }

    .flash-toast-message {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 16px 32px;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 500;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
      animation: slideInDown 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
      letter-spacing: 0.3px;
    }

    @keyframes slideInDown {
      from {
        opacity: 0;
        transform: translateY(-30px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes slideOutUp {
      from {
        opacity: 1;
        transform: translateY(0);
      }
      to {
        opacity: 0;
        transform: translateY(-30px);
      }
    }

    .flash-toast-message.exit {
      animation: slideOutUp 0.5s cubic-bezier(0.6, -0.28, 0.735, 0.045) forwards;
    }
  `;

  document.head.appendChild(style);
  document.body.appendChild(container);

  // Auto remove after duration
  setTimeout(() => {
    const message = container.querySelector('.flash-toast-message');
    message.classList.add('exit');
    
    setTimeout(() => {
      container.remove();
      style.remove();
    }, 500); // Wait for animation to complete
  }, duration);
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "showFlashToast") {
    showFlashMessage(request.message || "Tutorial Interrupted!", request.duration || 2000);
  }
});

// Export for direct use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = showFlashMessage;
}