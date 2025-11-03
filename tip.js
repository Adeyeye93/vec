// Tutorial Dots & Hints - Content Script
(function() {
  const dotsStyle = document.createElement('style');
  dotsStyle.textContent = `
    .tutorial-dot {
      position: fixed;
      width: 32px;
      height: 32px;
      background: #4CAF50;
      border: 2px solid white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      color: white;
      font-size: 14px;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(76, 175, 80, 0.4);
      z-index: 10001;
    }

    .tutorial-dot:hover {
      transform: scale(1.1);
      box-shadow: 0 4px 16px rgba(76, 175, 80, 0.6);
    }

    .tutorial-tooltip {
      position: fixed;
      background: white;
      border: 2px solid #4CAF50;
      border-radius: 8px;
      padding: 12px 16px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
      z-index: 10002;
      max-width: 280px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      display: none;
      animation: slideIn 0.3s ease;
    }

    .tutorial-tooltip.active {
      display: block;
    }

    .tutorial-tooltip-text {
      margin: 0;
      font-size: 13px;
      line-height: 1.5;
      color: #333;
      font-weight: 500;
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(-8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `;
  document.head.appendChild(dotsStyle);

  const tooltip = document.createElement('div');
  tooltip.className = 'tutorial-tooltip';
  const tooltipText = document.createElement('p');
  tooltipText.className = 'tutorial-tooltip-text';
  tooltip.appendChild(tooltipText);
  document.body.appendChild(tooltip);

  window.addTutorialDots = function(steps) {
    const dots = [];
    let scrollListener = null;
    let resizeListener = null;

    function updateAllDots() {
      dots.forEach(({ dot, element }) => {
        const rect = element.getBoundingClientRect();
        dot.style.left = (rect.right - 16) + 'px';
        dot.style.top = (rect.top - 16) + 'px';
      });
    }

    steps.forEach((step, index) => {
      const targetElement = document.querySelector(step.selector);

      if (!targetElement) {
        console.warn(`Element not found: ${step.selector}`);
        return;
      }

      const dot = document.createElement('div');
      dot.className = 'tutorial-dot';
      dot.textContent = index + 1;
      dot.style.pointerEvents = 'auto';
      dot.style.position = 'fixed';
      
      document.body.appendChild(dot);

      const rect = targetElement.getBoundingClientRect();
      dot.style.left = (rect.right - 16) + 'px';
      dot.style.top = (rect.top - 16) + 'px';

      dot.addEventListener('mouseenter', function() {
        tooltipText.textContent = step.instruction;
        const dotRect = dot.getBoundingClientRect();
        const tooltipHeight = tooltip.offsetHeight || 50;

        let tooltipTop = dotRect.top - tooltipHeight - 10;
        if (tooltipTop < 10) {
          tooltipTop = dotRect.bottom + 10;
        }

        let tooltipLeft = dotRect.left - 140;
        if (tooltipLeft < 10) {
          tooltipLeft = 10;
        }
        if (tooltipLeft + 280 > window.innerWidth - 10) {
          tooltipLeft = window.innerWidth - 290;
        }

        tooltip.style.left = tooltipLeft + 'px';
        tooltip.style.top = tooltipTop + 'px';
        tooltip.classList.add('active');
      });

      dot.addEventListener('mouseleave', function() {
        tooltip.classList.remove('active');
      });

      dots.push({ dot, element: targetElement });
    });

    scrollListener = window.addEventListener('scroll', updateAllDots);
    resizeListener = window.addEventListener('resize', updateAllDots);

    return dots;
  };
  addTutorialDots([
  {
        selector: '#target',
            instruction: 'Click here to submit the form',
            offsetX: 10,
            offsetY: 10
    }

    ,
    {
    selector: '#target2',
        instruction: 'This is the main heading',
        offsetX: 0,
        offsetY: 15
}

,
{
selector: '#target3',
    instruction: 'Click here to submit the form',
    offsetX: 10,
    offsetY: 10
}

,
{
selector: '#target4',
    instruction: 'This is the main heading',
    offsetX: 0,
    offsetY: 15
}

,
{
selector: '#target5',
    instruction: 'Click here to submit the form',
    offsetX: 10,
    offsetY: 10
}
]);
})();