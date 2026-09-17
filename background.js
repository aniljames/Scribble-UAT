/* ═══════════════════════════════════════════════════════════════
   SCRIBBLE- UAT EXTENSION — BACKGROUND SERVICE WORKER
   Author: Anil James
   LinkedIn: https://www.linkedin.com/in/aniljames7/
 ═══════════════════════════════════════════════════════════════ */

// Handle Extension Icon Click: Inject content scripts on demand & toggle toolbar
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || !tab.id || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
    return;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, { action: 'PING' });
    chrome.tabs.sendMessage(tab.id, { action: 'TOGGLE_TOOLBAR' });
  } catch (err) {
    await chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      files: ['content.css']
    });

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['lib/jspdf.umd.min.js', 'content.js']
    });

    setTimeout(() => {
      chrome.tabs.sendMessage(tab.id, { action: 'TOGGLE_TOOLBAR' });
    }, 100);
  }
});

// Message listener for tab capture, downloads, and responsive window resizing
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'CAPTURE_TAB') {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true, dataUrl });
      }
    });
    return true;
  }

  if (request.action === 'DOWNLOAD_FILE') {
    chrome.downloads.download({
      url: request.url,
      filename: request.filename,
      saveAs: request.saveAs || false
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true, downloadId });
      }
    });
    return true;
  }

  // Handle responsive viewport resizing via Chrome Window API safely
  if (request.action === 'RESIZE_VIEWPORT') {
    try {
      chrome.windows.getCurrent((win) => {
        if (chrome.runtime.lastError || !win) {
          sendResponse({ success: false, error: chrome.runtime.lastError?.message || 'Could not get window' });
          return;
        }

        if (request.width === 'full' || request.isFull) {
          chrome.windows.update(win.id, { state: 'maximized' }, () => {
            if (chrome.runtime.lastError) {
              sendResponse({ success: false, error: chrome.runtime.lastError.message });
            } else {
              sendResponse({ success: true });
            }
          });
        } else {
          const targetW = Math.max(320, parseInt(request.width, 10));
          const targetH = Math.max(400, parseInt(request.height, 10));

          chrome.windows.update(win.id, {
            state: 'normal',
            width: targetW,
            height: targetH
          }, () => {
            if (chrome.runtime.lastError) {
              chrome.windows.update(win.id, { width: targetW, height: targetH }, () => {
                sendResponse({ success: true });
              });
            } else {
              sendResponse({ success: true });
            }
          });
        }
      });
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }
    return true;
  }
});
