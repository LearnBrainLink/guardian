// --- Cosmetic Filtering Logic ---

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "applyCosmeticRules") {
    applyRules(request.rules);
    sendResponse({ success: true });
  } else if (request.action === 'activate_element_picker') {
    activatePicker();
  }
});

function applyRules(rules) {
  const styleId = "guardian-cosmetic-rules";
  let styleSheet = document.getElementById(styleId);

  if (!styleSheet) {
    styleSheet = document.createElement("style");
    styleSheet.id = styleId;
    document.head.appendChild(styleSheet);
  }

  const selectors = rules.join(",\n");
  if (selectors) {
    styleSheet.textContent = `${selectors} { display: none !important; }`;
  } else {
    styleSheet.textContent = "";
  }
}


// --- Element Picker Logic ---

let isPickerActive = false;
let highlightedElement = null;

function activatePicker() {
  if (isPickerActive) return;
  isPickerActive = true;
  document.body.style.cursor = 'crosshair';
  document.addEventListener('mouseover', onMouseOver);
  document.addEventListener('mouseout', onMouseOut);
  document.addEventListener('click', onClick, true);
}

function deactivatePicker() {
  if (!isPickerActive) return;
  isPickerActive = false;
  document.body.style.cursor = 'default';
  if (highlightedElement) {
    highlightedElement.style.outline = '';
  }
  document.removeEventListener('mouseover', onMouseOver);
  document.removeEventListener('mouseout', onMouseOut);
  document.removeEventListener('click', onClick, true);
}

function onMouseOver(e) {
  highlightedElement = e.target;
  highlightedElement.style.outline = '2px solid red';
}

function onMouseOut(e) {
  if (e.target) {
    e.target.style.outline = '';
  }
  highlightedElement = null;
}

function onClick(e) {
  e.preventDefault();
  e.stopPropagation();

  if (highlightedElement) {
    const selector = generateSelector(highlightedElement);
    showConfirmationDialog(selector);
  }
  
  deactivatePicker();
}

function showConfirmationDialog(selector) {
  // Remove existing dialog if any
  const oldDialog = document.getElementById('guardian-picker-dialog');
  if (oldDialog) oldDialog.remove();

  const dialog = document.createElement('div');
  dialog.id = 'guardian-picker-dialog';
  dialog.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: white;
    color: black;
    border: 1px solid #ccc;
    border-radius: 8px;
    padding: 16px;
    z-index: 2147483647;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    font-family: sans-serif;
  `;

  dialog.innerHTML = `
    <h3 style="margin-top: 0; font-size: 16px; font-weight: 600;">Create cosmetic filter?</h3>
    <p style="font-size: 14px; margin-bottom: 12px;">Selector:</p>
    <input type="text" readonly value="${selector}" style="width: 100%; padding: 4px; border: 1px solid #ccc; border-radius: 4px; font-family: monospace; margin-bottom: 12px;" />
    <div style="display: flex; justify-content: flex-end; gap: 8px;">
      <button id="guardian-cancel-btn" style="padding: 6px 12px; border: 1px solid #ccc; border-radius: 4px; cursor: pointer;">Cancel</button>
      <button id="guardian-create-btn" style="padding: 6px 12px; border: none; border-radius: 4px; background: #2563eb; color: white; cursor: pointer;">Create</button>
    </div>
  `;

  document.body.appendChild(dialog);

  document.getElementById('guardian-cancel-btn').onclick = () => dialog.remove();
  document.getElementById('guardian-create-btn').onclick = () => {
    chrome.runtime.sendMessage({ action: 'add_cosmetic_rule', selector: selector });
    dialog.remove();
  };
}


function generateSelector(el) {
    if (!el) return '';
    if (el.id) return `#${el.id.trim()}`;
    
    let path = [];
    while(el && el.nodeType === Node.ELEMENT_NODE) {
        let selector = el.nodeName.toLowerCase();
        if (el.className && typeof el.className === 'string') {
            const classes = el.className.trim().split(/\s+/).filter(Boolean).join('.');
            if(classes) selector += `.${classes}`;
        }
        path.unshift(selector);
        el = el.parentNode;
    }
    return path.join(' > ');
}
