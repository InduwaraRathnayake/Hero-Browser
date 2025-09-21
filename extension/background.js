chrome.runtime.onInstalled.addListener(() => {
  // Set initial state of extension (enabled by default)
  chrome.storage.local.set({ 
    extensionEnabled: true,
    // Default to gemini-2.5-flash-lite if no model is set
    geminiModel: "gemini-2.5-flash-lite"
  });
  
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

// Fetch explanation directly from Gemini API
async function fetchExplanation(text) {
  // Get API key and model from storage
  chrome.storage.local.get(["geminiApiKey", "geminiModel"], async (data) => {
    const apiKey = data.geminiApiKey;
    const model = data.geminiModel || "gemini-2.5-flash-lite";
    
    if (!apiKey) {
      chrome.storage.local.set({ 
        lastExplanation: "Error: API key not set. Please set your API key in the extension popup." 
      });
      
      chrome.notifications.create({
        type: "basic",
        iconUrl: "icon48.png",
        title: "Gemini Explanation Error",
        message: "API key not set"
      });
      
      return;
    }
    
    const prompt = `
      Please explain the following text in a clear and concise way:
      
      ${text}
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
      
      if (data.error) {
        chrome.storage.local.set({ 
          lastExplanation: `Error: ${data.error.message || "Unknown error"}` 
        });
        
        chrome.notifications.create({
          type: "basic",
          iconUrl: "icon48.png",
          title: "Gemini Explanation Error",
          message: "API error occurred"
        });
        
        return;
      }
      
      // Extract the explanation from the response
      const explanation = data.candidates?.[0]?.content?.parts?.[0]?.text || "No explanation available";
      
      // Store in extension storage so popup can access
      chrome.storage.local.set({ lastExplanation: explanation });

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
        lastExplanation: `Error: ${error.message}. Failed to connect to Gemini API.`
      });
      
      chrome.notifications.create({
        type: "basic",
        iconUrl: "icon48.png",
        title: "Gemini Explanation Error",
        message: "Connection failed"
      });
    }
  });
}