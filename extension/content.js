console.log("Gemini Extension content script loaded");

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

// Ask a question about the selected text - direct to Gemini API
async function askQuestion(selectedText) {
  const input = document.getElementById('question-input');
  const question = input.value.trim();
  const resultArea = document.getElementById('result-area');
  
  if (!question) {
    alert('Please enter a question');
    return;
  }
  
  // Clear the input field after asking
  const questionText = question;
  input.value = '';
  
  console.log("Asking question:", questionText);
  console.log("About text:", selectedText.substring(0, 50) + "...");
  
  // Show loading state
  resultArea.innerHTML = '<div style="text-align: center;"><div class="gemini-spinner"></div></div>';
  
  // Get API key and model from storage
  chrome.storage.local.get(["geminiApiKey", "geminiModel"], async (data) => {
    const apiKey = data.geminiApiKey;
    const model = data.geminiModel || "gemini-2.5-flash-lite";
    
    if (!apiKey) {
      resultArea.textContent = "Error: API key not set. Please set your API key in the extension popup.";
      return;
    }
    
    const prompt = `
      Question: ${questionText}
      
      Context: ${selectedText}
      
      Based on the provided context, please answer the question concisely and accurately.
      If the context doesn't contain enough information to answer the question,
      please use your own knowledge to provide a helpful answer.
      Only give text output. Do not give markdown or HTML.
    `;
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    
    const payload = {
      contents: [
        {
          parts: [
            {
              text: prompt
            }
          ]
        }
      ]
    };
    
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      console.log("API response:", data);
      
      if (data.error) {
        resultArea.textContent = `Error: ${data.error.message || "Unknown error"}`;
        return;
      }
      
      // Extract the explanation from the response
      const explanation = data.candidates?.[0]?.content?.parts?.[0]?.text || "No explanation available";
      
      resultArea.textContent = explanation;
      
      // Save to extension storage for later use
      chrome.storage.local.set({ 
        lastExplanation: explanation,
        lastSelectedText: selectedText 
      });
      
    } catch (error) {
      console.error("Error:", error);
      resultArea.textContent = "Error connecting to Gemini API: " + error.message;
    }
  });
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

console.log("Gemini Extension content script fully loaded and initialized");