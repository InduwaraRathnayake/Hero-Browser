chrome.runtime.onInstalled.addListener(() => {
  // Set initial state of extension (enabled by default)
  chrome.storage.local.set({ extensionEnabled: true });
  
  chrome.contextMenus.create({
    id: "explainWithGemini",
    title: "Explain with Gemini",
    contexts: ["selection"]
  });
  
  chrome.contextMenus.create({
    id: "toggleGemini",
    title: "Toggle Gemini Floating UI",
    contexts: ["action"]
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "explainWithGemini") {
    const selectedText = info.selectionText;
    
    // Store the selected text for later use
    chrome.storage.local.set({ lastSelectedText: selectedText });

    // Use a separate function for the fetch to avoid issues with service worker
    fetchExplanation(selectedText);
  }
  
  if (info.menuItemId === "toggleGemini") {
    // Toggle extension state
    chrome.storage.local.get("extensionEnabled", (data) => {
      const newState = !(data.extensionEnabled === true);
      chrome.storage.local.set({ extensionEnabled: newState });
      
      // Notify user of state change
      chrome.notifications.create({
        type: "basic",
        iconUrl: "icon48.png",
        title: "Gemini Floating UI",
        message: newState ? "Enabled" : "Disabled"
      });
    });
  }
});

// Also toggle on browser action click
chrome.action.onClicked.addListener((tab) => {
  chrome.storage.local.get("extensionEnabled", (data) => {
    const newState = !(data.extensionEnabled === true);
    chrome.storage.local.set({ extensionEnabled: newState });
  });
});

async function fetchExplanation(text) {
  try {
    const response = await fetch("http://127.0.0.1:8000/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text })
    });

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    const data = await response.json();

    // Store in extension storage so popup can access
    chrome.storage.local.set({ lastExplanation: data.explanation });

    // Show a notification that the explanation is ready
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icon48.png",
      title: "Gemini Explanation Ready",
      message: "Click the extension icon to view"
    });
  } catch (error) {
    console.error("Error fetching explanation:", error);
    chrome.storage.local.set({ 
      lastExplanation: `Error: ${error.message}. Make sure the backend server is running at http://127.0.0.1:8000`
    });
    
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icon48.png",
      title: "Gemini Explanation Error",
      message: "Connection failed. Is the server running?"
    });
  }
}
