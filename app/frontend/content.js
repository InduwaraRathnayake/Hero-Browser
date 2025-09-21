let extensionEnabled = true;
let processingClick = false; // Flag to prevent event conflicts
let dragOffset = { x: 0, y: 0 }; // For dragging functionality
let isDragging = false; // Flag to track if user is currently dragging

// Check if the extension is enabled when loaded
chrome.storage.local.get("extensionEnabled", (data) => {
  extensionEnabled = data.extensionEnabled !== false;
  console.log("Extension enabled state:", extensionEnabled);
});

// Listen for changes to extension state
chrome.storage.onChanged.addListener((changes) => {
  if (changes.extensionEnabled) {
    extensionEnabled = changes.extensionEnabled.newValue !== false;
    console.log("Extension enabled state changed to:", extensionEnabled);
    
    if (!extensionEnabled) {
      removePopup();
    }
  }
});

// Remove the popup from the document
function removePopup() {
  const popup = document.getElementById('gemini-popup');
  if (popup) {
    console.log("Removing existing popup");
    popup.remove();
  }
}

// Show the popup with input field
function showPopup(x, y, selectedText) {
  console.log("Showing popup with selected text:", selectedText.substring(0, 30) + "...");
  
  if (!selectedText) {
    console.error("No text selected");
    return;
  }

  removePopup();

  const popup = document.createElement('div');
  popup.id = 'gemini-popup';
  

  let popupX = x;
  let popupY = y + 10; // Place it near the selection
  
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  if (popupX + 332 > viewportWidth) {
    popupX = Math.max(10, viewportWidth - 350);
  }
  
  if (popupY + 200 > viewportHeight) {
    popupY = Math.max(10, y - 220);
  }
  
  popup.style.left = `${popupX}px`;
  popup.style.top = `${popupY}px`;
  
  // Add a subtle entrance animation
  popup.style.opacity = '0';
  popup.style.transform = 'translateY(10px)';
  popup.style.transition = 'opacity 0.3s, transform 0.3s';
  
  // Popup content with cyber theme
  popup.innerHTML = `
    <div class="gemini-popup-header">
      <h3>Gemini AI</h3>
      <span id="popup-close">✕</span>
    </div>
    <div class="gemini-popup-content">
      <div id="result-area">Ask a question about the selected text</div>
      <div class="gemini-popup-input">
        <input type="text" id="question-input" placeholder="Type your question...">
        <button id="ask-button">Ask</button>
      </div>
    </div>
  `;
  
  // Add the popup
  document.body.appendChild(popup);
  console.log("Popup created and appended to document");
  
  // Trigger animation after a small delay
  setTimeout(() => {
    popup.style.opacity = '1';
    popup.style.transform = 'translateY(0)';
  }, 10);
  
  // Make the popup draggable by the header
  const header = popup.querySelector('.gemini-popup-header');
  header.addEventListener('mousedown', startDraggingPopup);
  
  // Add event listeners after the popup is in the DOM
  document.getElementById('popup-close').addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    removePopup();
  });
  
  document.getElementById('ask-button').addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    askQuestion(selectedText);
  });
  
  const input = document.getElementById('question-input');
  input.focus();
  input.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      askQuestion(selectedText);
    }
  });
  
  // Store the selected text for later use
  chrome.storage.local.set({ lastSelectedText: selectedText });
}

// Function to start dragging the popup
function startDraggingPopup(e) {
  if (e.button !== 0) return; // Only left click
  e.preventDefault();
  e.stopPropagation();
  
  const popup = document.getElementById('gemini-popup');
  if (!popup) return;
  
  isDragging = true;
  
  const rect = popup.getBoundingClientRect();
  dragOffset = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };
  
  document.addEventListener('mousemove', movePopup);
  document.addEventListener('mouseup', stopDraggingPopup);
  
  console.log("Started dragging popup");
}

// Function to move the popup when dragging
function movePopup(e) {
  const popup = document.getElementById('gemini-popup');
  if (!popup) return;
  
  popup.style.left = `${e.clientX - dragOffset.x}px`;
  popup.style.top = `${e.clientY - dragOffset.y}px`;
}

// Function to stop dragging the popup
function stopDraggingPopup(e) {
  document.removeEventListener('mousemove', movePopup);
  document.removeEventListener('mouseup', stopDraggingPopup);
  
  // Keep track that we were dragging to prevent click events
  setTimeout(() => {
    isDragging = false;
    console.log("Stopped dragging popup");
  }, 100);
}

// Ask a question about the selected text
async function askQuestion(selectedText) {
  const input = document.getElementById('question-input');
  const question = input.value.trim();
  const resultArea = document.getElementById('result-area');
  
  if (!question) {
    alert('Please enter a question');
    return;
  }
  
  console.log("Asking question:", question);
  console.log("About text:", selectedText.substring(0, 50) + "...");
  
  // Show loading state
  resultArea.innerHTML = '<div style="text-align: center;"><div class="gemini-spinner"></div></div>';
  
  try {
    const response = await fetch('http://127.0.0.1:8000/explain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        text: `Question: ${question}\n\nContext: ${selectedText}` 
      })
    });
    
    const result = await response.json();
    console.log("Received response:", result);
    
    if (result.error) {
      resultArea.textContent = 'Error: ' + result.explanation;
    } else {
      resultArea.textContent = result.explanation;
      // Save to extension storage for later use
      chrome.storage.local.set({ 
        lastExplanation: result.explanation,
        lastSelectedText: selectedText 
      });
    }
  } catch (error) {
    console.error("Error:", error);
    resultArea.textContent = 'Error connecting to server: ' + error.message;
  }
}

// Handle text selection
document.addEventListener('mouseup', (e) => {
  console.log("Mouse up detected, extension enabled:", extensionEnabled);
  
  // Don't process if we're handling dragging
  if (isDragging) {
    console.log("Ignoring mouse up during drag");
    return;
  }
  
  if (!extensionEnabled) {
    console.log("Extension disabled, ignoring selection");
    return;
  }
  
  // Check if clicked on our UI elements
  if (e.target.closest('#gemini-popup')) {
    console.log("Clicked on our UI elements, not processing selection");
    return;
  }
  
  setTimeout(() => {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    
    if (selectedText && selection.rangeCount > 0) {
      console.log("Text selected:", selectedText.substring(0, 20) + "...");
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      // Position popup at the end of the selection
      const x = rect.right + window.scrollX;
      const y = rect.bottom + window.scrollY;
      
      // Show popup directly instead of the G button
      showPopup(x, y, selectedText);
    }
  }, 100);
});

// Only remove UI when clicking outside our elements
document.addEventListener('click', (e) => {
  // Don't process if we're handling dragging
  if (isDragging) {
    console.log("Ignoring click during drag");
    return;
  }
  
  // Don't remove if clicked on our UI elements
  if (e.target.closest('#gemini-popup')) {
    console.log("Clicked on popup, keeping it open");
    return; 
  }
  
  // If clicked elsewhere, remove the UI
  console.log("Clicked outside popup, removing it");
  removePopup();
});

// Prevent popup from closing when mousedown on popup content
document.addEventListener('mousedown', (e) => {
  if (e.target.closest('#gemini-popup')) {
    e.stopPropagation();
  }
});