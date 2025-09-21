document.addEventListener("DOMContentLoaded", async () => {
  const resultEl = document.getElementById("result");
  const questionInput = document.getElementById("question");
  const askButton = document.getElementById("askButton");
  const toggleButton = document.getElementById("toggleButton");
  const apiKeyInput = document.getElementById("apiKey");
  const modelSelect = document.getElementById("modelSelect");
  const saveSettingsButton = document.getElementById("saveSettings");
  const tabs = document.querySelectorAll(".tab");
  const tabContents = document.querySelectorAll(".tab-content");

  // Tab switching
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const tabName = tab.getAttribute("data-tab");
      
      // Update active tab
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      
      // Update active content
      tabContents.forEach(content => {
        content.classList.remove("active");
      });
      document.getElementById(`${tabName}-tab`).classList.add("active");
    });
  });

  // Load settings from storage
  chrome.storage.local.get(["geminiApiKey", "geminiModel"], (data) => {
    if (data.geminiApiKey) {
      apiKeyInput.value = data.geminiApiKey;
    }
    
    if (data.geminiModel) {
      modelSelect.value = data.geminiModel;
    }
  });

  // Save settings
  saveSettingsButton.addEventListener("click", () => {
    const apiKey = apiKeyInput.value.trim();
    const model = modelSelect.value;
    
    chrome.storage.local.set({ 
      geminiApiKey: apiKey,
      geminiModel: model
    }, () => {
      // Show a brief "Saved" message
      saveSettingsButton.textContent = "Saved!";
      setTimeout(() => {
        saveSettingsButton.textContent = "Save Settings";
      }, 1500);
    });
  });

  // Check extension enabled state
  chrome.storage.local.get("extensionEnabled", (data) => {
    const isEnabled = data.extensionEnabled === true;
    toggleButton.textContent = isEnabled ? "Disable Floating UI" : "Enable Floating UI";
    toggleButton.classList.toggle("enabled", isEnabled);
  });

  // Toggle button event listener
  toggleButton.addEventListener("click", () => {
    chrome.storage.local.get("extensionEnabled", (data) => {
      const newState = !(data.extensionEnabled === true);
      chrome.storage.local.set({ extensionEnabled: newState });
      toggleButton.textContent = newState ? "Disable Floating UI" : "Enable Floating UI";
      toggleButton.classList.toggle("enabled", newState);
    });
  });

  // Fetch stored explanation from extension storage
  chrome.storage.local.get(["lastExplanation", "lastSelectedText"], (data) => {
    if (data.lastExplanation) {
      resultEl.textContent = data.lastExplanation;
      resultEl.classList.remove("empty");
    }
  });

  // Add event listener for the ask button
  askButton.addEventListener("click", async () => {
    const question = questionInput.value.trim();
    
    if (!question) {
      alert("Please enter a question");
      return;
    }

    // Get the last selected text
    chrome.storage.local.get(["lastSelectedText", "geminiApiKey", "geminiModel"], async (data) => {
      if (!data.lastSelectedText) {
        alert("Please select some text first");
        return;
      }
      
      if (!data.geminiApiKey) {
        alert("Please set your Gemini API key in the Settings tab");
        // Switch to settings tab
        tabs[1].click();
        return;
      }

      resultEl.textContent = "Getting answer...";
      resultEl.classList.remove("empty");
      
      // Clear the input after asking
      questionInput.value = "";

      const apiKey = data.geminiApiKey;
      const model = data.geminiModel || "gemini-2.5-flash-lite";
      const selectedText = data.lastSelectedText;
      
      const prompt = `
        Question: ${question}
        
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

        const result = await response.json();
        
        if (result.error) {
          resultEl.textContent = `Error: ${result.error.message || "Unknown error"}`;
          return;
        }
        
        // Extract the explanation from the response
        const explanation = result.candidates?.[0]?.content?.parts?.[0]?.text || "No explanation available";
        
        resultEl.textContent = explanation;
        chrome.storage.local.set({ lastExplanation: explanation });
      } catch (error) {
        console.error("Error:", error);
        resultEl.textContent = "Error connecting to Gemini API: " + error.message;
      }
    });
  });
});