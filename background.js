// --- Constants ---
const FILTER_LIST_URL = "https://raw.githubusercontent.com/easylist/easylist/master/easylist/easylist_general_block.txt"
const RULESET_ID = "dynamic_ruleset"
const USER_RULE_START_ID = 100000

// --- Ad Blocker State ---
let isAdBlockerEnabled = true
let totalBlockedCount = 0;
let whitelistedSites = []
let tabRequests = {}
let userRules = []

const defaultFilterLists = {
  easylist: 'https://easylist.to/easylist/easylist.txt',
  easyprivacy: 'https://easylist.to/easylist/easyprivacy.txt',
  'peter-lowe-list': 'https://pgl.yoyo.org/adservers/serverlist.php?hostformat=hosts&showintro=0&mimetype=plaintext',
};

async function updateBlockingRules() {
  console.log("Starting to update blocking rules...");
  try {
    const { enabledFilterLists, isAdBlockerEnabled } = await chrome.storage.local.get(['enabledFilterLists', 'isAdBlockerEnabled']);
    
    // Ad blocker is disabled globally, so disable the ruleset.
    if (isAdBlockerEnabled === false) {
      await chrome.declarativeNetRequest.updateEnabledRulesets({ disableRulesetIds: ['dynamic_rules'] });
      console.log("Ad blocker is globally disabled. Ruleset turned off.");
      return;
    } else {
      await chrome.declarativeNetRequest.updateEnabledRulesets({ enableRulesetIds: ['dynamic_rules'] });
    }

    const listsToFetch = enabledFilterLists || { easylist: true };
    
    let allNetworkRules = [];
    let allCosmeticRules = [];
    let ruleIdCounter = 1;

    for (const listId in listsToFetch) {
      if (listsToFetch[listId] && defaultFilterLists[listId]) {
        try {
          console.log(`Fetching ${listId}...`);
          const response = await fetch(defaultFilterLists[listId]);
          const text = await response.text();
          const lines = text.split('\n');

          for (const line of lines) {
            if (line.startsWith('||')) {
              const domain = line.substring(2).split('^')[0];
              if (domain) {
                allNetworkRules.push({
                  id: ruleIdCounter++,
                  priority: 1,
                  action: { type: 'block' },
                  condition: {
                    urlFilter: `||${domain}`,
                    resourceTypes: ['main_frame', 'sub_frame', 'script', 'image', 'xmlhttprequest', 'stylesheet', 'object', 'media'],
                  },
                });
              }
            } else if (line.includes('##')) {
                const parts = line.split('##');
                const selector = parts[1];
                if(selector) allCosmeticRules.push(selector);
            }
          }
        } catch (e) {
          console.error(`Failed to fetch or parse list ${listId}:`, e);
        }
      }
    }
    
    console.log(`Found ${allNetworkRules.length} network rules and ${allCosmeticRules.length} cosmetic rules in total.`);

    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const existingRuleIds = existingRules.map(rule => rule.id);

    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existingRuleIds,
      addRules: allNetworkRules,
    });
    
    await chrome.storage.local.set({ 'cosmeticRules': allCosmeticRules });
    
    console.log("Blocking rules updated successfully.");
  } catch (error) {
    console.error("Error updating blocking rules:", error);
  }
}

function setupWebRequestlistener() {
  chrome.permissions.contains({ permissions: ['webRequest'] }, (hasPermission) => {
    if (hasPermission && !chrome.webRequest.onBeforeRequest.hasListener(webRequestListener)) {
      chrome.webRequest.onBeforeRequest.addListener(
        webRequestListener,
        { urls: ["<all_urls>"] }
      );
      console.log("webRequest listener added.");
    }
  });
}

const webRequestListener = (details) => {
    const { tabId, requestId, url } = details;
    if (tabId >= 0) {
      if (!tabRequests[tabId]) {
        tabRequests[tabId] = {};
      }
      if (!tabRequests[tabId][requestId]) {
        tabRequests[tabId][requestId] = { url };

        chrome.runtime.sendMessage({
          action: 'update_network_log',
          requests: tabRequests
        });
      }
    }
};

// --- Initial Setup ---
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ 
    isAdBlockerEnabled: true, 
    totalBlockedCount: 0,
    whitelistedSites: [],
    userRules: []
  })
  chrome.storage.local.get('enabledFilterLists', (data) => {
    if (!data.enabledFilterLists) {
      chrome.storage.local.set({ enabledFilterLists: { easylist: true } });
    }
    updateBlockingRules();
  });
  setupWebRequestlistener();
})

// Load initial state from storage
chrome.storage.local.get(["isAdBlockerEnabled", "totalBlockedCount", "whitelistedSites", "userRules"], (data) => {
    isAdBlockerEnabled = data.isAdBlockerEnabled !== false // default to true
    totalBlockedCount = data.totalBlockedCount || 0
    whitelistedSites = data.whitelistedSites || []
    userRules = data.userRules || []
});

// Listen for all network requests
// chrome.webRequest.onBeforeRequest.addListener(
//   (details) => {
//     const { tabId, requestId, url } = details;
//     if (tabId >= 0) {
//       if (!tabRequests[tabId]) {
//         tabRequests[tabId] = {};
//       }
//       if (!tabRequests[tabId][requestId]) {
//         tabRequests[tabId][requestId] = { url };

//         // Send update to popup
//         chrome.runtime.sendMessage({
//           action: 'update_network_log',
//           requests: tabRequests
//         });
//       }
//     }
//   },
//   { urls: ["<all_urls>"] }
// );

// Clear requests when a tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  delete tabRequests[tabId];
});

// Message listener from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "getAdBlockerStatus") {
        chrome.storage.local.get(["isAdBlockerEnabled", "totalBlockedCount"], (data) => {
          sendResponse({ 
            isEnabled: data.isAdBlockerEnabled,
            blockedCount: data.totalBlockedCount || 0
          })
        })
        return true // Indicates that the response is sent asynchronously
    } else if (message.action === "toggleAdBlocker") {
        chrome.storage.local.get("isAdBlockerEnabled", (data) => {
          const newState = !data.isAdBlockerEnabled
          chrome.storage.local.set({ isAdBlockerEnabled: newState }, () => {
            isAdBlockerEnabled = newState
            updateAdBlockerState(newState)
            sendResponse({ isEnabled: newState })
          })
        })
        return true
    } else if (message.action === "analyzeArticle") {
        triggerAnalysis(sendResponse)
        return true
    } else if (message.action === "getSiteStatus") {
        sendResponse({ isWhitelisted: whitelistedSites.includes(message.hostname) })
        return true
    } else if (message.action === "toggleWhitelist") {
        const { hostname } = message
        if (whitelistedSites.includes(hostname)) {
          whitelistedSites = whitelistedSites.filter(site => site !== hostname)
        } else {
          whitelistedSites.push(hostname)
        }
        chrome.storage.local.set({ whitelistedSites: whitelistedSites }, () => {
          sendResponse({ isWhitelisted: whitelistedSites.includes(hostname) })
          // We might need to re-evaluate rules for the current tab
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
              chrome.tabs.reload(tabs[0].id)
            }
          });
        })
        return true
    } else if (message.action === "addDynamicRule") {
        const { domain, ruleAction } = message
        const newRule = {
          id: USER_RULE_START_ID + userRules.length,
          priority: 2, // Higher priority than list rules
          action: { type: ruleAction },
          condition: {
            urlFilter: `||${domain}`,
            resourceTypes: ["main_frame", "sub_frame", "script", "image", "xmlhttprequest", "stylesheet", "object", "media"],
          },
        }
        userRules.push(newRule)
        chrome.storage.local.set({ userRules: userRules }, () => {
          updateDynamicRules()
          sendResponse({ success: true })
        })
        return true
    } else if (message.action === 'get_network_log') {
        const { tabId } = message;
        if (tabId && tabRequests[tabId]) {
            // Send only the requests for the specific tab
            chrome.runtime.sendMessage({
                action: 'update_network_log',
                requests: { [tabId]: tabRequests[tabId] }
            });
        }
    } else if (message.action === 'allow_domain') {
        console.log("Allowing domain:", message.domain);
        // Placeholder for rule creation
    } else if (message.action === 'block_domain') {
        console.log("Blocking domain:", message.domain);
        // Placeholder for rule creation
    } else if (message.action === 'get_block_count') {
        sendResponse({ count: totalBlockedCount });
    } else if (message.action === 'toggle_adblocker_globally') {
      updateBlockingRules();
    } else if (message.action === 'update_filter_lists') {
        updateBlockingRules();
    } else if (message.action === 'add_cosmetic_rule') {
        console.log(`Adding new cosmetic rule: ${message.selector}`);
        chrome.storage.local.get('cosmeticRules', (data) => {
            const rules = data.cosmeticRules || [];
            if (!rules.includes(message.selector)) {
                rules.push(message.selector);
                chrome.storage.local.set({ 'cosmeticRules': rules }, () => {
                    // Optionally, re-apply rules on active tabs
                    console.log("New cosmetic rule saved.");
                });
            }
        });
    } else if (message.action === 'analyze_page') {
      triggerAnalysis(message.provider);
    } else if (message.action === 'initialize_network_listener') {
      setupWebRequestlistener();
    }

    // Return true to indicate you wish to send a response asynchronously
    return true;
});

// --- Ad Blocker Logic ---
function updateAdBlockerState(isEnabled) {
  if (isEnabled) {
    chrome.declarativeNetRequest.updateEnabledRulesets({ enableRulesetIds: [RULESET_ID] })
    console.log("Ad blocker enabled, dynamic ruleset active.")
  } else {
    chrome.declarativeNetRequest.updateEnabledRulesets({ disableRulesetIds: [RULESET_ID] })
    console.log("Ad blocker disabled, dynamic ruleset inactive.")
  }
}

async function updateDynamicRules() {
  try {
    console.log("Fetching filter list...")
    const response = await fetch(FILTER_LIST_URL)
    const text = await response.text()
    const lines = text.split("\n")

    const networkRules = []
    const cosmeticRules = []
    let ruleId = 1

    for (const line of lines) {
      if (line.startsWith("||")) {
        const domain = line.substring(2).split("^")[0]
        if (domain) {
          networkRules.push({
            id: ruleId++,
            priority: 1,
            action: { type: "block" },
            condition: {
              urlFilter: `||${domain}`,
              resourceTypes: ["main_frame", "sub_frame", "script", "image", "xmlhttprequest", "stylesheet", "object", "media"],
            },
          })
        }
      } else if (line.includes("##")) {
        const selector = line.split("##")[1]
        if (selector) {
          cosmeticRules.push(selector)
        }
      }
    }

    console.log(`Parsed ${networkRules.length} network rules and ${cosmeticRules.length} cosmetic rules.`)

    const existingRules = await chrome.declarativeNetRequest.getDynamicRules()
    const existingRuleIds = existingRules.map(rule => rule.id)
    
    // Combine list rules with user rules
    const allRules = [...networkRules, ...userRules]

    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existingRuleIds,
      addRules: allRules,
    })
    
    await chrome.storage.local.set({ cosmeticRules: cosmeticRules })

    console.log("Dynamic and cosmetic rules updated successfully.")
    updateAdBlockerState(isAdBlockerEnabled)

  } catch (error) {
    console.error("Failed to update dynamic rules:", error)
  }
}

// --- Cosmetic Filtering Logic ---
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (isAdBlockerEnabled && changeInfo.status === 'loading' && tab.url) {
    const url = new URL(tab.url)
    if (whitelistedSites.includes(url.hostname)) {
      console.log(`Guardian: Skipping cosmetic filtering for whitelisted site ${url.hostname}`)
      return
    }
    
    chrome.storage.local.get("cosmeticRules", (data) => {
      if (data.cosmeticRules && data.cosmeticRules.length > 0) {
        chrome.tabs.sendMessage(tabId, {
          action: "applyCosmeticRules",
          rules: data.cosmeticRules,
        }).catch(err => {
          if (!err.message.includes("Could not establish connection.")) {
            console.error("Cosmetic filtering error:", err);
          }
        });
      }
    });
  }
});


// --- Block Counter Logic ---
function incrementBlockCount() {
  totalBlockedCount++
  chrome.storage.local.set({ totalBlockedCount: totalBlockedCount })
  chrome.action.setBadgeText({ text: totalBlockedCount.toString() });
  chrome.action.setBadgeBackgroundColor({ color: "#e11d48" });
}

// Listen for DNR blocked requests
chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
    if (isAdBlockerEnabled) {
      console.log("DNR Blocked:", info.request.url)
      incrementBlockCount()
    }
});


// --- Popup/Redirect Blocker ---
chrome.webNavigation.onCreatedNavigationTarget.addListener(
  (details) => {
    chrome.tabs.get(details.sourceTabId, (sourceTab) => {
        if (chrome.runtime.lastError) {
          console.log(`Could not get source tab: ${chrome.runtime.lastError.message}`);
          return;
        }
        
        const url = new URL(sourceTab.url)
        if (isAdBlockerEnabled && !whitelistedSites.includes(url.hostname)) {
          chrome.tabs.remove(details.tabId)
          console.log(`Guardian: Blocked a popup/redirect from: ${url.hostname}`)
          incrementBlockCount()
        }
    });
  },
  {
    sourceTabId: -1, // Catches targets from all tabs
  }
)


async function fetchAnalysis(articleData, provider) {
  const response = await fetch("http://localhost:3000/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ articleData, provider }),
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.details || `API error: ${response.statusText}`)
  }
  return response.json()
}

// --- Helper Functions ---
async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  return tabs[0]
}

function getArticleContent() {
  // This function is injected into the webpage, so it runs in the page's context
  // It cannot access variables from the background script.
  const article = document.querySelector("article")
  let content = ""

  if (article) {
    const paragraphs = article.querySelectorAll("p")
    content = Array.from(paragraphs)
      .map((p) => p.textContent)
      .join("\n")
  } else {
    // Fallback for pages without a clear <article> tag
    content = document.body.innerText || ""
  }
  
  if (!content || content.trim().length < 200) {
    return { error: "Could not find enough content on this page to analyze." };
  }
  
  const url = window.location.href
  const domainMatch = url.match(/:\/\/(.[^/]+)/)

  return {
    title: document.title,
    content: content.trim(),
    url: url,
    domain: domainMatch ? domainMatch[1] : "N/A",
    author: "N/A", // Placeholder
    publishDate: "N/A", // Placeholder
  }
}

const CACHE_DURATION_MS = 3600 * 1000; // 1 hour

async function triggerAnalysis(provider) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id && tab.url) {
      
      const cacheKey = `analysis_cache_${tab.url}`;
      const cachedData = await chrome.storage.local.get(cacheKey);
      
      if (cachedData[cacheKey] && (Date.now() - cachedData[cacheKey].timestamp < CACHE_DURATION_MS)) {
        console.log("Returning cached analysis for:", tab.url);
        const resultWithTimestamp = {
          ...cachedData[cacheKey].result,
          timestamp: cachedData[cacheKey].timestamp
        };
        chrome.runtime.sendMessage({ action: 'analysis_result', result: resultWithTimestamp });
        return;
      }

      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const title = document.querySelector('h1')?.innerText;
          const content = document.body.innerText;
          const author = document.querySelector('[rel="author"]')?.innerText;
          
          // Get significant images from the article
          const imageCandidates = Array.from(document.querySelectorAll('article img, main img, .post-content img, .entry-content img'));
          const significantImages = imageCandidates
            .filter(img => img.width > 150 && img.height > 150) // Filter for reasonably sized images
            .map(img => img.src)
            .filter(src => src && (src.startsWith('http'))); // Ensure it's a valid, absolute URL

          return { title, content, author, images: significantImages.slice(0, 3) }; // Limit to first 3 images
        },
      });

      const pageContent = results[0].result;
      if (!pageContent || !pageContent.content) {
        throw new Error("Could not extract content from the page.");
      }
      
      const articleData = {
        ...pageContent,
        url: tab.url,
        domain: new URL(tab.url).hostname,
      };

      // NOTE: This assumes your Next.js app is running on localhost:3000
      const response = await fetch('http://localhost:3000/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleData, provider }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API request failed with status ${response.status}`);
      }
      
      const result = await response.json();

      await chrome.storage.local.set({
        [cacheKey]: {
          result: result,
          timestamp: Date.now()
        }
      });

      chrome.runtime.sendMessage({ action: 'analysis_result', result });

    }
  } catch (error) {
    console.error("Analysis failed:", error);
    chrome.runtime.sendMessage({ action: 'analysis_result', error: error.message });
  }
}

async function updateDeclarativeNetRequestRules() {
  const enabledLists = await getEnabledFilterLists();
  if (enabledLists.length === 0) {
    console.log("No filter lists enabled. Clearing all rules.");
    // ... (rest of the if block)
    return;
  }

  try {
    const allRules = await fetchAndParseLists(enabledLists);
    const networkRules = allRules.filter(r => !r.selector);
    const cosmeticRules = allRules.filter(r => r.selector);

    // Get existing rules to determine the next available ID
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const nextId = Math.max(0, ...existingRules.map(r => r.id)) + 1;

    const newRules = networkRules.map((rule, index) => {
      // ... (rule mapping logic)
    });

    // Enforce the dynamic rule limit to prevent errors
    const MAX_RULES = chrome.declarativeNetRequest.MAX_NUMBER_OF_DYNAMIC_RULES || 5000;
    const rulesToApply = newRules.slice(0, MAX_RULES - 1); // Slice to just under the limit

    if (rulesToApply.length > 0) {
        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: existingRules.map(r => r.id), // Clear old rules
            addRules: rulesToApply
        });
        console.log(`Successfully loaded ${rulesToApply.length} ad-blocking rules.`);
    } else {
        // ...
    }

    // ... (rest of the function)
}
