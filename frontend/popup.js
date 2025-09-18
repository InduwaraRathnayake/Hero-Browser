// Show last Gemini explanation if available
document.addEventListener("DOMContentLoaded", async () => {
  const resultEl = document.getElementById("result");
  const questionInput = document.getElementById("question");
  const askButton = document.getElementById("askButton");
  const toggleButton = document.getElementById("toggleButton");

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
    console.log("Ask button clicked");
    const question = questionInput.value.trim();
    
    if (!question) {
      alert("Please enter a question");
      return;
    }

    // Get the last selected text
    chrome.storage.local.get("lastSelectedText", async (data) => {
      console.log("Retrieved from storage:", data);
      if (!data.lastSelectedText) {
        alert("Please select some text first");
        return;
      }

      resultEl.textContent = "Getting answer...";
      resultEl.classList.remove("empty");

      try {
        console.log("Sending question about selected text to backend");
        const response = await fetch("http://127.0.0.1:8000/explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            text: `Question: ${question}\n\nContext: ${data.lastSelectedText}` 
          })
        });

        const result = await response.json();
        console.log("Received response:", result);
        
        if (result.error) {
          resultEl.textContent = "Error: " + result.explanation;
        } else {
          resultEl.textContent = result.explanation;
          chrome.storage.local.set({ lastExplanation: result.explanation });
        }
      } catch (error) {
        console.error("Error:", error);
        resultEl.textContent = "Error connecting to server: " + error.message;
      }
    });
  });
});
