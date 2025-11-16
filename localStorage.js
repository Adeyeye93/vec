// // Add item to localStorage
// function addToLocalStorage(key, value) {
//   try {
//     localStorage.setItem(key, JSON.stringify(value));
//     console.log(`Added to localStorage: ${key}`, value);
//     return true;
//   } catch (error) {
//     console.error(`Error adding to localStorage: ${error}`);
//     return false;
//   }
// }

// // Remove item from localStorage
// function removeFromLocalStorage(key) {
//   try {
//     localStorage.removeItem(key);
//     console.log(`Removed from localStorage: ${key}`);
//     return true;
//   } catch (error) {
//     console.error(`Error removing from localStorage: ${error}`);
//     return false;
//   }
// }

// // Get item from localStorage
// function getFromLocalStorage(key) {
//   try {
//     const value = localStorage.getItem(key);
//     return value ? JSON.parse(value) : null;
//   } catch (error) {
//     console.error(`Error retrieving from localStorage: ${error}`);
//     return null;
//   }
// }

// // Update item in localStorage
// function updateLocalStorage(key, value) {
//   console.log(`Updating localStorage key: ${key} with value:`, value);
//   try {
//     if (localStorage.getItem(key) === null) {
//       console.warn(`Key "${key}" does not exist in localStorage. Creating new entry.`);
//     }
//     localStorage.setItem(key, JSON.stringify(value));
//     console.log(`Updated localStorage: ${key}`, value);
//     return true;
//   } catch (error) {
//     console.error(`Error updating localStorage: ${error}`);
//     return false;
//   }
// }

// // Update specific property in localStorage object
// function updateLocalStorageProperty(key, property, value) {
//   try {
//     const currentData = getFromLocalStorage(key) || {};
//     if (typeof currentData !== 'object' || Array.isArray(currentData)) {
//       console.error(`Cannot update property on non-object value`);
//       return false;
//     }
//     currentData[property] = value;
//     localStorage.setItem(key, JSON.stringify(currentData));
//     console.log(`Updated localStorage property: ${key}.${property} = ${value}`);
//     return true;
//   } catch (error) {
//     console.error(`Error updating localStorage property: ${error}`);
//     return false;
//   }
// }

// // Clear all localStorage
// function clearAllLocalStorage() {
//   try {
//     localStorage.clear();
//     console.log('Cleared all localStorage');
//     return true;
//   } catch (error) {
//     console.error(`Error clearing localStorage: ${error}`);
//     return false;
//   }
// }

// // Listen for messages from the extension to manipulate localStorage
// chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
//   try {
//     const { action, key, value, property } = message;

//     switch (action) {
//       case 'add':
//         sendResponse({ success: addToLocalStorage(key, value) });
//         break;

//       case 'remove':
//         sendResponse({ success: removeFromLocalStorage(key) });
//         break;

//       case 'get': {
//         const data = getFromLocalStorage(key);
//         sendResponse({ success: true, data });
//         break;
//       }

//       case 'update':
//         case 'update': {
//           try {
//             // Special handling for Page: value === 1 => increment, value === 0 => decrement
//             if (key === 'Page' && (value === 1 || value === 0)) {
//           const current = getFromLocalStorage(key);
//           const currentNum = (typeof current === 'number')
//             ? current
//             : (Number.parseInt(current, 10) || 0);
//           const newValue = currentNum + (value === 1 ? 1 : -1);
//           sendResponse({ success: updateLocalStorage(key, newValue), data: newValue });
//             } else {
//           // Default update behavior
//           sendResponse({ success: updateLocalStorage(key, value) });
//             }
//           } catch (err) {
//             sendResponse({ success: false, error: err && err.message });
//           }
//           break;
//         }
//         break;

//       case 'updateProperty':
//         sendResponse({ success: updateLocalStorageProperty(key, property, value) });
//         break;

//       case 'clear':
//         sendResponse({ success: clearAllLocalStorage() });
//         break;

//       default:
//         sendResponse({ success: false, error: 'Unknown action' });
//     }
//   } catch (error) {
//     sendResponse({ success: false, error: error && error.message });
//   }

//   // Return true to indicate we may send a response asynchronously (safe default)
//   return true;
// });

// // Usage Examples:
// // Add a string
// // addToLocalStorage('tutorialStatus', 'active');

// // // Add an object
// // addToLocalStorage('userProgress', { step: 3, completed: false });

// // // Add an array
// // addToLocalStorage('completedSteps', [1, 2, 3]);

// // // Get item
// // const status = getFromLocalStorage('tutorialStatus');
// // console.log('Status:', status);

// // // Remove item
// // removeFromLocalStorage('tutorialStatus');

// // // Clear everything
// // // clearAllLocalStorage();

// // Usage Examples:
// // // Add a string
//  addToLocalStorage('Page', 0);

// // // Add an object
// // addToLocalStorage('userProgress', { step: 3, completed: false });

// // // Add an array
// // addToLocalStorage('completedSteps', [1, 2, 3]);

// // // Get item
// // const status = getFromLocalStorage('tutorialStatus');
// // console.log('Status:', status);

// // // Remove item
// // removeFromLocalStorage('tutorialStatus');

// // Clear everything
