const LM_ENDPOINT = "http://localhost:1234/v1/chat/completions";
const LM_MODEL = "Choose Model";
const CRAWL_ENDPOINT = "http://localhost:5000/crawl";
const WEBSEARCH_ENDPOINT = "http://localhost:5000/websearch";
const WEATHER_ENDPOINT = "http://localhost:5000/weather";
const NEWS_ENDPOINT = "http://localhost:5000/news";
const YOUTUBE_ENDPOINT = "http://localhost:5000/youtube";
let allowYouTubeEmbeds = false;
let currentChat = [];
let savedChats = [];
let pendingPdf = null;
const messagesEl = document.getElementById("messages");
const inputEl = document.getElementById("input");
const sendBtn = document.getElementById("sendBtn");
const chatListEl = document.getElementById("chatList");
const modalEl = document.getElementById("crawlModal");
const modalContentEl = document.getElementById("modalContent");
const modalOverlay = document.getElementById("modalOverlay");
const settingsModal = document.getElementById("settingsModal");
const settingsModalContent = document.getElementById("settingsModalContent");
const youtubeToggleBtn = document.getElementById("youtubeToggleBtn");
const settingsBtn = document.getElementById("settingsBtn");
const imageModal = document.getElementById("imageModal");
const expandedImage = document.getElementById("expandedImage");

// Auto-scroll flag (starts enabled)
let autoScroll = true;

if (window.DOMPurify) {
  DOMPurify.addHook('afterSanitizeAttributes', function(node) {
    if (node.tagName === 'A') {
      if (!node.getAttribute('target')) node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    }
  });
}

const anchorObserver = new MutationObserver(mutations => {
  for (const m of mutations) {
    for (const n of Array.from(m.addedNodes)) {
      if (n.nodeType !== 1) continue;
      if (n.tagName === 'A') {
        if (!n.getAttribute('target')) n.setAttribute('target', '_blank');
        n.setAttribute('rel', 'noopener noreferrer');
      }
      n.querySelectorAll && n.querySelectorAll('a').forEach(a => {
        if (!a.getAttribute('target')) a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
      });
    }
  }
});

anchorObserver.observe(messagesEl, { childList: true, subtree: true });

youtubeToggleBtn.addEventListener("click", () => {
  allowYouTubeEmbeds = !allowYouTubeEmbeds;
  youtubeToggleBtn.classList.toggle("active", allowYouTubeEmbeds);
  youtubeToggleBtn.title = allowYouTubeEmbeds ? "YouTube Embeds Enabled" : "YouTube Embeds Disabled";
});

settingsBtn.addEventListener("click", () => {
  openSettingsModal();
});

let systemPrompts = {
  weather: `You are a friendly, knowledgeable AI assistant specializing in weather updates, with access to weather data in JSON format.

Here is the weather information for the user's query:
----- WEATHER DATA START -----
{weather_data}
----- WEATHER DATA END -----

Your task:
- Parse the JSON weather data, which may include current conditions, a 7-day forecast, UV index, and air quality.
- Deliver a clear, concise, and engaging summary in natural language using Markdown format.
- Begin the response with the country flag emoji derived from the location in weather_data (e.g., 🇺🇸 for USA). If no country is specified, use a generic ☀️ emoji.
- Use Celsius (°C) for temperatures and km/h for wind speeds, unless the user specifies otherwise.
- Structure the response with the following sections:
  - **## Current Conditions**: Include temperature, humidity, wind speed, weather description, and an appropriate emoji (e.g., ☀️ for sunny, 🌧️ for rain). Mention "feels like" temperature if available.
  - **## 7-Day Forecast**: Provide a concise summary in a Markdown table with columns for Date, Max/Min Temp (°C), Weather Description, Wind Speed (km/h), Precipitation (%), and Humidity Range (%). Highlight notable trends (e.g., warming trend, rainy days).
  - **## UV Index**: Include current UV index, daily max, UV band (e.g., Low, Moderate, High), and tailored advice (e.g., "Wear sunscreen" for High).
  - **## Air Quality**: Include PM2.5, PM10, AQI, and a brief advisory (e.g., "Good air quality, ideal for outdoor activities").
- If the data is incomplete, corrupted, or missing key fields, politely explain the issue (e.g., "Sorry, some weather data is missing for [location]") and provide available information or suggest an alternative (e.g., "Would you like a general forecast?").
- Maintain a warm, conversational tone suitable for a general audience, avoiding technical jargon unless necessary.
- Example tone: "Looks like a sunny day in Paris! 🇫🇷 Let's break down the forecast for you."`,

  websearch: `You are a web-savvy AI assistant designed to deliver clear, engaging, and balanced summaries based on recent web search results in JSON format.

Here are the relevant web search results:
----- WEB RESULTS START -----
{search_data}
----- WEB RESULTS END -----

Your task:
- Parse the JSON web search data, which includes an array of results with site URLs, titles, summaries, and optional metadata (e.g., publication date, author).
- Sort results by relevance (based on metadata like click-through rates or query match) or recency if metadata supports it; otherwise, maintain the provided order.
- Deliver a response in Markdown format with:
  - **## Search Overview**: A concise, engaging summary (3-5 sentences) synthesizing key findings, trends, or insights across results. Highlight common themes, contradictions, or notable patterns without bias.
  - **## Search Results**: A Markdown table with columns for Source (hostname, e.g., "example.com"), Summary (2-3 sentences capturing main points, key facts, or unique insights), and Link (formatted as "[Title](URL)").
- Ensure summaries are neutral, avoiding sensationalism or favoritism toward any source.
- If metadata (e.g., publication date) is available, integrate it naturally into summaries (e.g., "Published on [date], this article...").
- If no valid results are available or results are irrelevant, politely explain (e.g., "No relevant results found for [query]. Would you like me to search again or provide general information?").
- Use a clear, professional, and engaging tone suitable for a general audience, ensuring accessibility and depth.
- Example tone: "Here's what the web has to say about [query]—let's dive into the key insights!"`,

  crawl: `You are an AI assistant tasked with summarizing webpage content to provide a clear, engaging, and accurate response.

Here is the content from the provided URL:
----- SITE CONTENT START -----
{content}
----- SITE CONTENT END -----

Your task:
- Analyze the webpage content to deliver a concise, engaging summary in Markdown format.
- Structure the response with:
  - **## Page Overview**: A brief introduction (2-3 sentences) stating the webpage’s purpose, topic, or main focus, based solely on the content.
  - **## Key Points**: A bullet-point list or paragraphs summarizing the main ideas, arguments, or findings. Include notable quotes, statistics, or unique insights where relevant.
- If answering a specific user query, directly address it by referencing relevant sections of the content (use > for blockquotes) and explain how they apply.
- If the content is incomplete, irrelevant, or inaccessible, politely explain (e.g., "The webpage content is limited or not relevant to your query. Would you like general information on [topic]?") and provide any usable insights or suggest alternatives.
- Use a friendly, professional tone suitable for a general audience, avoiding jargon unless contextually appropriate.
- Example tone: "This webpage dives into [topic]—here’s a quick rundown of what it covers!"`,

  pdf: `You are an AI assistant tasked with analyzing and summarizing the text of an uploaded PDF document to provide clear, accurate, and user-focused responses.

Here is the content of the PDF:
----- PDF CONTENT START -----
{pdf_content}
----- PDF CONTENT END -----

Your task:
- Address the user’s query based solely on the PDF content, using Markdown format for clarity.
- If summarizing, provide:
  - **## Document Overview**: A brief introduction (2-3 sentences) stating the document’s purpose, topic, or scope.
  - **## Key Points**: A bullet-point list or paragraphs summarizing the main sections, arguments, or findings. Include notable quotes or data where relevant.
- If answering a specific question, quote relevant sections (using > for blockquotes) and explain how they address the query in a clear, concise manner.
- If the query is unrelated to the PDF content, politely state (e.g., "The PDF doesn’t cover [topic]. Would you like general information on this?") and offer to assist with available knowledge.
- If the PDF content is incomplete or unreadable, note this politely and provide any usable information or suggest alternatives.
- Use a professional, helpful tone suitable for a general audience, ensuring clarity and structure.
- Example tone: "This PDF covers [topic]—here’s a quick summary to get you up to speed!"`,

  news: `You are a news-savvy AI assistant designed to deliver clear, balanced, and engaging summaries based on recent news articles in JSON format.

Here are the relevant news results:
----- NEWS RESULTS START -----
{news_data}
----- NEWS RESULTS END -----

Your task:
- Parse the JSON news data, which includes a top summary and an array of articles (with site URLs, titles, summaries, and optional metadata like publication date or meta description).
- Sort articles by publication date (latest to oldest) if available in metadata or inferred from summaries. If no dates are available, prioritize relevance to the user’s query or maintain JSON order.
- Deliver a response in Markdown format with:
  - **## News Overview**: A concise, engaging summary (3-5 sentences) synthesizing key events, trends, or insights across articles. Highlight broader context, implications, differing perspectives, or emerging patterns while maintaining neutrality.
  - **## Recent Articles**: A Markdown table with columns for Date (if available), Source (hostname, e.g., "nytimes.com"), Summary (2-4 sentences capturing main points, key facts, quotes, or unique insights), and Link (formatted as "[Title](URL)").
  - For highly similar articles (e.g., covering the same event), group them into a single table row with a combined summary that synthesizes shared and unique insights, listing all sources and links to avoid redundancy.
- Integrate metadata naturally (e.g., "Reported on [date] by [source]").
- If no relevant articles or valid data are available, politely explain (e.g., "No recent news found for [query]. Would you like me to search again or provide background info?") and offer general knowledge if applicable.
- Use a clear, neutral, and engaging tone suitable for news reporting, ensuring accessibility and depth for a general audience.
- Example tone: "Here’s the latest on [query]—let’s break down the key stories!"`,

  youtube: `You are an AI assistant tasked with summarizing YouTube video transcripts to provide clear, engaging, and accurate responses.

Here is the transcript from the YouTube video:
----- VIDEO TRANSCRIPT START -----
{content}
----- VIDEO TRANSCRIPT END -----

Additional metadata:
----- METADATA START -----
{metadata}
----- METADATA END -----

Your task:
- Analyze the transcript and metadata (e.g., video title, channel, upload date) to provide a concise, engaging summary in Markdown format.
- Structure the response with:
  - **## Video Overview**: A brief introduction (2-3 sentences) stating the video’s purpose, topic, or main focus, incorporating metadata (e.g., "Uploaded by [channel] on [date]").
  - **## Key Points**: A bullet-point list or paragraphs summarizing the main topics, arguments, or notable moments (e.g., quotes, examples) from the transcript.
- If answering a specific user query, reference relevant transcript sections (use > for blockquotes) and explain how they address the query.
- If the transcript is incomplete, irrelevant, or missing, politely explain (e.g., "The transcript is limited for this video. Would you like general info on [topic]?") and provide available insights.
- Use a friendly, conversational tone suitable for a general audience, ensuring clarity and enthusiasm.
- Example tone: "This YouTube video from [channel] dives into [topic]—here’s what it’s all about!"`
};

async function loadSettings() {
  try {
    const response = await fetch("settings.json");
    if (response.ok) {
      const data = await response.json();
      systemPrompts = { ...systemPrompts, ...data };
    }
  } catch (err) {
    console.warn("Could not load settings.json:", err.message);
  }
}

async function saveSettings() {
  try {
    console.log("Settings saved in memory:", JSON.stringify(systemPrompts, null, 2));
    alert("Settings saved for this session (until reload).");
  } catch (err) {
    console.error("Error saving settings:", err.message);
    alert("Failed to save settings: " + err.message);
  }
}

function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

function openSettingsModal() {
  settingsModalContent.innerHTML = `
  <h3 style="margin: 0 0 12px; color: var(--accent); font-weight: 600;">Edit System Prompts</h3>
  <label>Weather Prompt</label>
  <textarea id="weatherPrompt" class="settings-textarea">${systemPrompts.weather}</textarea>
  <label>Web Search Prompt</label>
  <textarea id="websearchPrompt" class="settings-textarea">${systemPrompts.websearch}</textarea>
  <label>URL Crawl Prompt</label>
  <textarea id="crawlPrompt" class="settings-textarea">${systemPrompts.crawl}</textarea>
  <label>YouTube Prompt</label>
  <textarea id="youtubePrompt" class="settings-textarea">${systemPrompts.youtube}</textarea>
  <label>PDF Prompt</label>
  <textarea id="pdfPrompt" class="settings-textarea">${systemPrompts.pdf}</textarea>
  <label>News Prompt</label>
  <textarea id="newsPrompt" class="settings-textarea">${systemPrompts.news}</textarea>
  <div style="display: flex; gap: 8px; margin-top: 12px;">
  <button id="saveSettingsBtn" class="btn primary">Save</button>
  <button id="cancelSettingsBtn" class="btn">Cancel</button>
  </div>
  `;
  settingsModal.classList.add("active");
  modalOverlay.classList.add("active");

  const saveBtn = document.getElementById("saveSettingsBtn");
  const cancelBtn = document.getElementById("cancelSettingsBtn");

  saveBtn.addEventListener("click", async () => {
    systemPrompts.weather = document.getElementById("weatherPrompt").value.trim();
    systemPrompts.websearch = document.getElementById("websearchPrompt").value.trim();
    systemPrompts.crawl = document.getElementById("crawlPrompt").value.trim();
    systemPrompts.youtube = document.getElementById("youtubePrompt").value.trim();
    systemPrompts.pdf = document.getElementById("pdfPrompt").value.trim();
    systemPrompts.news = document.getElementById("newsPrompt").value.trim();
    await saveSettings();
    settingsModal.classList.remove("active");
    modalOverlay.classList.remove("active");
  });

  cancelBtn.addEventListener("click", () => {
    settingsModal.classList.remove("active");
    modalOverlay.classList.remove("active");
  });
}

function scrollToBottom() {
  if (autoScroll) {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
}

function highlightCodeBlocks(container) {
  if (typeof Prism === 'undefined') {
    console.warn('Prism.js not loaded yet; skipping highlight.');
    return;
  }
  container.querySelectorAll('pre[class*="language-"]').forEach(el => {
    if (!el.dataset.highlighted) {
      Prism.highlightElement(el);
      el.dataset.highlighted = 'true';
    }
  });
}

function sanitizeAndRenderMarkdown(text) {
  const rawHtml = marked.parse(text || "");
  const clean = DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: [
      'b','strong','i','em','u','a','p','br','ul','ol','li','pre','code',
      'table','thead','tbody','tr','th','td','span','div','h1','h2','h3','h4','h5','h6','iframe','details','summary','img',
      'span'
    ],
    ALLOWED_ATTR: [
      'href','target','rel','class','id','title','aria-hidden','aria-label','role','data-lang',
      'src','width','height','frameborder','allow','allowfullscreen','style'
    ]
  });

  const parser = new DOMParser();
  const doc = parser.parseFromString(clean, 'text/html');

  // Add language class to <code> if missing
  doc.querySelectorAll('pre code').forEach(code => {
    if (![...code.classList].some(c => c.startsWith('language-'))) {
      const firstLine = code.textContent.split('\n')[0].toLowerCase();
      let lang = 'text'; // default

      if (firstLine.includes('css') || firstLine.includes('@media')) lang = 'css';
      else if (firstLine.includes('js') || firstLine.includes('javascript')) lang = 'javascript';
      else if (firstLine.includes('python') || firstLine.includes('def')) lang = 'python';
      else if (firstLine.includes('html') || firstLine.includes('<!doctype')) lang = 'markup';

      code.classList.add(`language-${lang}`);
    }
  });

  return doc.body.innerHTML;
}

// Highlight inserted code blocks
function highlightCodeBlocks(container) {
  if (typeof Prism === 'undefined') {
    console.warn('Prism.js not loaded yet; skipping highlight.');
    return;
  }
  container.querySelectorAll('pre code').forEach(el => {
    if (!el.dataset.highlighted) {  // Avoid re-highlighting
      Prism.highlightElement(el);
      el.dataset.highlighted = 'true';
    }
  });
}

function extractUrl(text) {
  const urlRegex = /(https?:\/\/[^\s]+)/i;
  const match = text.match(urlRegex);
  if (match) {
    return match[0];
  }
  return null;
}

function extractYouTubeId(url) {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtube\.com\/.*[?&]v=)([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/
  ];
  for (const pat of patterns) {
    const m = url.match(pat);
    if (m && m[1]) return m[1];
  }
  return null;
}

async function canEmbedYouTubeVideo(youtubeId) {
  const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${youtubeId}&format=json`;
  try {
    const res = await fetch(url);
    return res.ok;
  } catch (err) {
    return false;
  }
}

function createYouTubeThumbnailElement(youtubeId, originalUrl) {
  const wrapper = document.createElement("div");
  wrapper.className = "yt-thumb";

  const img = document.createElement("img");
  img.src = `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;
  img.alt = "YouTube thumbnail";
  wrapper.appendChild(img);

  const play = document.createElement("div");
  play.className = "yt-play-btn";
  wrapper.appendChild(play);

  const fallback = document.createElement("a");
  fallback.className = "yt-fallback";
  fallback.href = originalUrl;
  fallback.target = "_blank";
  fallback.rel = "noopener noreferrer";
  fallback.style.display = "none";

  wrapper.addEventListener("click", async function onClickLoad() {
    wrapper.removeEventListener("click", onClickLoad);

    const canEmbed = await canEmbedYouTubeVideo(youtubeId);
    if (!canEmbed) {
      wrapper.innerHTML = "";
      fallback.style.display = "inline-block";
      wrapper.appendChild(fallback);
      return;
    }

    const iframeWrap = document.createElement("div");
    iframeWrap.style.width = "100%";
    iframeWrap.style.aspectRatio = "16/9";
    iframeWrap.style.position = "relative";
    iframeWrap.style.overflow = "hidden";
    iframeWrap.style.borderRadius = "12px";

    const iframe = document.createElement("iframe");
    iframe.frameBorder = "0";
    iframe.allow = "";
    iframe.allowFullscreen = false;
    iframe.style.position = "absolute";
    iframe.style.top = "0";
    iframe.style.left = "0";
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "0";
    iframe.style.background = "#000";

    setTimeout(() => {
      iframe.src = `https://www.youtube-nocookie.com/embed/${youtubeId}`;
    }, 50);

    iframeWrap.appendChild(iframe);
    wrapper.innerHTML = "";
    wrapper.appendChild(iframeWrap);
    wrapper.appendChild(fallback);

    let handled = false;
    iframe.addEventListener("error", () => {
      if (handled) return;
      handled = true;
      wrapper.innerHTML = "";
      fallback.style.display = "inline-block";
      wrapper.appendChild(fallback);
    });

    setTimeout(() => {
      if (!handled && wrapper.querySelector("iframe")) {
        fallback.style.display = "inline-block";
        wrapper.appendChild(fallback);
      }
    }, 1500);
  });

  const container = document.createElement("div");
  container.style.width = "100%";
  container.style.borderRadius = "12px";
  container.style.overflow = "hidden";
  container.style.marginBottom = "10px";
  container.appendChild(wrapper);
  container.appendChild(fallback);

  return container;
}

let websearchEnabled = false;

document.getElementById("webBtn").addEventListener("click", () => {
  websearchEnabled = !websearchEnabled;
  document.getElementById("webBtn").classList.toggle("active", websearchEnabled);
});

function createBubbleElement(markdownText = "", type = "bot", hasSources = false, sourceUrl = "", sourceContent = "", metadata = null, embedUrl = "", youtubeId = null, originalUrl = null, images = []) {
  const wrapper = document.createElement("div");
  wrapper.className = `msg-row ${type === "user" ? "user" : "bot"}`;

  const bubble = document.createElement("div");
  bubble.className = "bubble " + (type === "user" ? "user" : type === "thinking" ? "thinking" : "bot");

  if (youtubeId && originalUrl) {
    if (allowYouTubeEmbeds) {
      const thumbEl = createYouTubeThumbnailElement(youtubeId, originalUrl);
      bubble.appendChild(thumbEl);
    } else {
      const fallbackLink = document.createElement("a");
      fallbackLink.href = originalUrl;
      fallbackLink.target = "_blank";
      fallbackLink.textContent = "Watch on YouTube";
      fallbackLink.className = "yt-fallback";
      bubble.appendChild(fallbackLink);
    }
  } else if (embedUrl) {
    const iframeWrap = document.createElement("div");
    iframeWrap.style.width = "100%";
    iframeWrap.style.borderRadius = "12px";
    iframeWrap.style.overflow = "hidden";
    iframeWrap.style.marginBottom = "10px";

    const iframe = document.createElement("iframe");
    iframe.src = embedUrl;
    iframe.width = "100%";
    iframe.height = "360";
    iframe.frameBorder = "0";
    iframe.allow = "";
    iframe.allowFullscreen = true;
    iframe.style.display = "block";
    iframe.style.border = "0";
    iframe.style.background = "#000";
    iframeWrap.appendChild(iframe);
    bubble.appendChild(iframeWrap);
  }

  const textContainer = document.createElement("div");
  textContainer.className = "bubble-text";
  textContainer.innerHTML = sanitizeAndRenderMarkdown(markdownText || "");

  highlightCodeBlocks(textContainer);
  bubble.appendChild(textContainer);
  addPreCopyButtons(bubble);

  wrapper.appendChild(bubble);

  const controls = document.createElement("div");
  controls.className = "controls";
  wrapper.appendChild(controls);

  imageModal.addEventListener("click", () => {
    imageModal.classList.remove("active");
    expandedImage.src = "";
  });

  return { wrapper, bubble, textContainer, controls };
}

function addPreCopyButtons(bubble) {
  bubble.querySelectorAll("pre").forEach(pre => {
    if (pre.querySelector(".inline-copy-btn")) return;
    pre.style.position = "relative";

    const code = pre.querySelector("code") || pre;
    const btn = document.createElement("button");
    btn.className = "inline-copy-btn copy-btn";
    btn.innerHTML = '<i class="fas fa-copy"></i>';
    btn.setAttribute("title", "Copy code");

    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(code.textContent);
        btn.innerHTML = '<i class="fas fa-check"></i>';
        setTimeout(() => btn.innerHTML = '<i class="fas fa-copy"></i>', 1400);
      } catch {
        btn.innerHTML = '<i class="fas fa-times"></i>';
        setTimeout(() => btn.innerHTML = '<i class="fas fa-copy"></i>', 1400);
      }
    });

    pre.appendChild(btn);
  });
}

function streamMessage(textContainer, thinkingBubble, onChunk, onComplete) {
  let accumulatedText = "";
  let hasContent = false;
  return async (chunk) => {
    if (chunk) {
      accumulatedText += chunk;
      if (!hasContent && accumulatedText.trim()) {
        hasContent = true;
        try { thinkingBubble.wrapper.remove(); } catch (e) {}
      }
      onChunk(accumulatedText);
      textContainer.innerHTML = sanitizeAndRenderMarkdown(accumulatedText);
      textContainer.querySelectorAll("a").forEach(a => {
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noopener noreferrer");
      });
    } else if (!hasContent) {
      try { thinkingBubble.wrapper.remove(); } catch (e) {}
    }
    return accumulatedText;
  };
}

function addBubble(text, type = "bot", hasSources = false, sourceUrl = "", sourceContent = "", metadata = null, embedUrl = "", youtubeId = null, originalUrl = null, messageId = null, images = []) {
  const { wrapper, bubble, textContainer, controls } = createBubbleElement(text, type, hasSources, sourceUrl, sourceContent, metadata, embedUrl, youtubeId, originalUrl, images);
  if (messageId) {
    wrapper.dataset.messageId = messageId;
  } else if (type === "user") {
    wrapper.dataset.messageId = Date.now().toString();
  }
  messagesEl.appendChild(wrapper);

  const isThinking = type === "thinking";
  const isSearchingBubble = typeof text === "string" && (text.toLowerCase().includes("searching") || text.toLowerCase().includes("thinking"));

  if (!isThinking && !isSearchingBubble) {
    const copyBtn = document.createElement("button");
    copyBtn.className = "copy-btn";
    copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
    copyBtn.setAttribute("title", "Copy message");
    copyBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      try {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = bubble.innerHTML;

        function stripTagsAndNormalize(node) {
          let text = '';
          if (node.nodeType === Node.TEXT_NODE) {
            text = node.textContent || node.innerText || '';
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            if (['IMG', 'IFRAME', 'PRE', 'CODE'].includes(node.tagName)) {
              if (node.tagName === 'PRE' || node.tagName === 'CODE') {
                text = (node.textContent || '').replace(/\n\s*\n/g, '\n\n').trim();
              }
            } else {
              for (let child of node.childNodes) {
                text += stripTagsAndNormalize(child);
              }
            }
            text = text.replace(/\s+/g, ' ').replace(/ \n/g, '\n').trim();
          }
          return text;
        }

        const cleanText = stripTagsAndNormalize(tempDiv);
        await navigator.clipboard.writeText(cleanText);
        copyBtn.innerHTML = '<i class="fas fa-check"></i>';
        setTimeout(() => copyBtn.innerHTML = '<i class="fas fa-copy"></i>', 1400);
      } catch (err) {
        console.error('Copy failed:', err);
        copyBtn.innerHTML = '<i class="fas fa-times"></i>';
        setTimeout(() => copyBtn.innerHTML = '<i class="fas fa-copy"></i>', 1400);
      }
    });
    controls.appendChild(copyBtn);

    if (type === "user") {
      const editBtn = document.createElement("button");
      editBtn.className = "edit-btn";
      editBtn.innerHTML = '<i class="fas fa-edit"></i>';
      editBtn.setAttribute("title", "Edit message");
      editBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const messageId = wrapper.dataset.messageId;
        const message = currentChat.find(m => m.role === "user" && m.id === messageId);
        const currentText = message ? message.content : text;
        const textarea = document.createElement("textarea");
        textarea.className = "input";
        textarea.style.maxWidth = "820px";
        textarea.style.width = "100%";
        textarea.value = currentText;
        bubble.innerHTML = "";
        bubble.appendChild(textarea);
        controls.innerHTML = "";
        const saveBtn = document.createElement("button");
        saveBtn.className = "btn primary";
        saveBtn.textContent = "Save";
        saveBtn.addEventListener("click", () => {
          const newText = textarea.value.trim();
          if (newText) {
            bubble.innerHTML = "";
            const newTextContainer = document.createElement("div");
            newTextContainer.className = "bubble-text";
            newTextContainer.innerHTML = sanitizeAndRenderMarkdown(newText);
            highlightCodeBlocks(newTextContainer);
            bubble.appendChild(newTextContainer);
            controls.innerHTML = "";
            controls.appendChild(copyBtn);
            controls.appendChild(editBtn);
            const messageIndex = currentChat.findIndex(m => m.role === "user" && m.id === messageId);
            if (messageIndex !== -1) {
              currentChat[messageIndex].content = newText;
            } else {
              const lastUserMessageIndex = [...currentChat].reverse().findIndex(m => m.role === "user");
              if (lastUserMessageIndex !== -1) {
                const index = currentChat.length - 1 - lastUserMessageIndex;
                currentChat[index].content = newText;
                currentChat[index].id = messageId;
              }
            }
            addPreCopyButtons(bubble);
          }
        });
        const cancelBtn = document.createElement("button");
        cancelBtn.className = "btn";
        cancelBtn.textContent = "Cancel";
        cancelBtn.addEventListener("click", () => {
          bubble.innerHTML = "";
          const newTextContainer = document.createElement("div");
          newTextContainer.className = "bubble-text";
          newTextContainer.innerHTML = sanitizeAndRenderMarkdown(currentText);
          highlightCodeBlocks(newTextContainer);
          bubble.appendChild(newTextContainer);
          controls.innerHTML = "";
          controls.appendChild(copyBtn);
          controls.appendChild(editBtn);
          addPreCopyButtons(bubble);
        });
        controls.appendChild(saveBtn);
        controls.appendChild(cancelBtn);
        textarea.focus();
        textarea.addEventListener("keydown", (e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            saveBtn.click();
          }
        });
      });
      controls.appendChild(editBtn);
    }

    if (type === "bot") {
      const retryBtn = document.createElement("button");
      retryBtn.className = "retry-btn";
      retryBtn.innerHTML = '<i class="fas fa-rotate-right"></i>';
      retryBtn.setAttribute("role", "button");
      retryBtn.setAttribute("aria-label", "Retry last message");
      retryBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (sendBtn.disabled) return;

        const botMessageId = wrapper.dataset.messageId;
        const botMessageIndex = currentChat.findIndex(m => m.role === "assistant" && m.id === botMessageId);

        let userMessage = null;
        let userMessageId = null;
        for (let i = botMessageIndex - 1; i >= 0; i--) {
          if (currentChat[i].role === "user") {
            userMessage = currentChat[i];
            userMessageId = currentChat[i].id;
            break;
          }
        }

        if (!userMessage) return;

        if (botMessageIndex !== -1) {
          currentChat.splice(botMessageIndex, 1);
        }

        wrapper.remove();

        const userMessageElement = messagesEl.querySelector(`.msg-row.user[data-message-id="${userMessageId}"]`);
        if (userMessageElement) {
          const textContainer = userMessageElement.querySelector(".bubble-text");
          if (textContainer) {
            textContainer.innerHTML = sanitizeAndRenderMarkdown(userMessage.content);
            highlightCodeBlocks(textContainer);
          }
        } else {
          const bubble = addBubble(userMessage.content, "user");
          userMessage.id = bubble.wrapper.dataset.messageId;
        }

        inputEl.value = userMessage.content;
        await sendMessage(true);
      });
      controls.appendChild(retryBtn);
    }

    if (hasSources && sourceUrl && sourceContent) {
      const sourcesWrapper = document.createElement("button");
      sourcesWrapper.className = "sources-wrapper-btn";
      sourcesWrapper.setAttribute("role", "button");
      sourcesWrapper.setAttribute("aria-label", "View sources and articles");
      sourcesWrapper.setAttribute("title", "View source content and article indicators");
      sourcesWrapper.style.background = "transparent";
      sourcesWrapper.style.border = "none";
      sourcesWrapper.style.cursor = "pointer";
      sourcesWrapper.style.display = "flex";
      sourcesWrapper.style.alignItems = "center";
      sourcesWrapper.style.padding = "6px";
      sourcesWrapper.style.borderRadius = "6px";

      const iconSpan = document.createElement("span");
      iconSpan.innerHTML = '<i class="fas fa-link"></i>';
      iconSpan.style.marginRight = "6px";
      sourcesWrapper.appendChild(iconSpan);

      const iconContainer = document.createElement("div");
      iconContainer.className = "article-icons";

      let sourceCount = 0;
      let articles = [];
      if (metadata && metadata.fromNews) {
        articles = JSON.parse(sourceContent).articles || [];
        sourceCount = Math.min(4, articles.length);
      } else if (metadata && metadata.fromWebSearch) {
        try {
          const searchResults = JSON.parse(sourceContent);
          articles = searchResults.map(result => ({ site: result.site }));
          sourceCount = Math.min(4, searchResults.length);
        } catch (e) {
          console.error("Error parsing web search sourceContent:", e);
        }
      } else {
        sourceCount = 1;
        articles = [{ site: sourceUrl }];
      }

      function getFaviconUrl(url) {
        if (!url || !url.startsWith("http")) return null;
        try {
          const hostname = new URL(url).hostname;
          return `https://www.google.com/s2/favicons?domain=${hostname}`;
        } catch (e) {
          return null;
        }
      }

      for (let i = 0; i < sourceCount; i++) {
        const article = articles[i];
        const faviconUrl = getFaviconUrl(article.site);
        if (faviconUrl) {
          const img = document.createElement("img");
          img.src = faviconUrl;
          img.alt = `${article.site} favicon`;
          img.style.width = "12px";
          img.style.height = "12px";
          img.style.borderRadius = "50%";
          img.style.marginRight = "2px";
          img.style.objectFit = "cover";
          img.onerror = () => {
            img.style.display = "none";
            const fallback = document.createElement("span");
            fallback.style.width = "6px";
            fallback.style.height = "6px";
            fallback.style.backgroundColor = "#bbb";
            fallback.style.borderRadius = "50%";
            fallback.style.display = "inline-block";
            iconContainer.appendChild(fallback);
          };
          iconContainer.appendChild(img);
        } else {
          const fallback = document.createElement("span");
          fallback.style.width = "6px";
          fallback.style.height = "6px";
          fallback.style.backgroundColor = "#bbb";
          fallback.style.borderRadius = "50%";
          fallback.style.display = "inline-block";
          fallback.style.marginRight = "2px";
          iconContainer.appendChild(fallback);
        }
      }

      sourcesWrapper.appendChild(iconContainer);

      sourcesWrapper.addEventListener("click", () => {
        modalContentEl.innerHTML = "";
        let sections = [];

        if (metadata && metadata.fromWebSearch) {
          let searchResults;
          try {
            searchResults = JSON.parse(sourceContent);
          } catch (e) {
            console.error("Error parsing web search sourceContent:", e);
            searchResults = [];
          }
          sections = searchResults.map((result, idx) => {
            const hostname = isValidUrl(result.site) ? new URL(result.site).hostname : `Source ${idx + 1}`;
            return {
              title: hostname,
              favicon: getFaviconUrl(result.site),
              url: isValidUrl(result.site) ? result.site : null,
              content: isValidUrl(result.site) ? `Full URL: ${result.site}\n\n${result.summary || "No summary available"}` : `Source ${idx + 1}\n\n${result.summary || "No summary available"}`
            };
          });
        } else if (metadata && metadata.fromWeather) {
          sections = [
            {
              title: "Open Meteo",
              favicon: getFaviconUrl("https://open-meteo.com/"),
              url: sourceUrl,
              content: sourceContent
            }
          ];
        } else if (metadata && metadata.fromNews) {
          const articles = JSON.parse(sourceContent).articles || [];
          sections = articles.map((article, idx) => {
            const hostname = article.site ? new URL(article.site).hostname : '';
            return {
              title: hostname || `Article ${idx + 1}`,
              favicon: getFaviconUrl(article.site),
              url: article.site || sourceUrl,
              content: `${article.summary || "No summary available"}\n\nFull URL: ${article.site || sourceUrl || "No URL available"}`
            };
          });
        } else if (metadata && metadata.fromPDF) {
          sections = [
            {
              title: `PDF: ${sourceUrl}`,
              favicon: null,
              content: sourceContent.slice(0, 5000) || "No content available"
            }
          ];
        } else if (metadata && metadata.fromYouTube) {
          const videoMetadata = metadata.metadata || metadata;
          sections = [
            { title: "Video Title", favicon: null, content: videoMetadata.title || "Unknown" },
            { title: "Channel", favicon: null, content: videoMetadata.channel_name || "Unknown" },
            { title: "Language", favicon: null, content: videoMetadata.language || "Unknown" },
            { title: "Generated Transcript", favicon: null, content: videoMetadata.is_generated ? "Yes" : "No" },
            {
              title: "Source URL",
              favicon: getFaviconUrl(sourceUrl),
              url: sourceUrl,
              content: sourceUrl
            },
            { title: "Transcript", favicon: null, content: sourceContent }
          ];
        } else {
          sections = [
            {
              title: sourceUrl ? new URL(sourceUrl).hostname : "Source",
              favicon: getFaviconUrl(sourceUrl),
              url: sourceUrl,
              content: `Full URL: ${sourceUrl}\n\n${sourceContent || sourceUrl}`
            }
          ];
        }

        if (images && images.length > 0) {
          sections.push({
            title: "Images",
            favicon: null,
            content: images.map(img => `[${img}](${img})`).join('\n')
          });
        }

        sections.forEach(sec => {
          const details = document.createElement("details");
          details.style.marginBottom = "8px";
          const summary = document.createElement("summary");
          summary.style.cursor = "pointer";
          summary.style.fontWeight = "600";
          summary.style.color = "var(--accent)";
          summary.style.fontSize = "14px";
          summary.style.display = "flex";
          summary.style.alignItems = "center";
          summary.style.gap = "6px";

          if (sec.favicon) {
            const faviconImg = document.createElement("img");
            faviconImg.src = sec.favicon;
            faviconImg.style.width = "16px";
            faviconImg.style.height = "16px";
            faviconImg.style.verticalAlign = "middle";
            faviconImg.onerror = () => {
              faviconImg.style.display = "none";
              const fallbackIcon = document.createElement("i");
              fallbackIcon.className = "fas fa-globe";
              fallbackIcon.style.fontSize = "14px";
              summary.insertBefore(fallbackIcon, faviconImg);
            };
            summary.appendChild(faviconImg);
          } else if (metadata && metadata.fromPDF) {
            const pdfIcon = document.createElement("i");
            pdfIcon.className = "fas fa-file-pdf";
            pdfIcon.style.fontSize = "14px";
            summary.appendChild(pdfIcon);
          } else if (metadata && metadata.fromYouTube) {
            const ytIcon = document.createElement("i");
            ytIcon.className = "fab fa-youtube";
            ytIcon.style.fontSize = "14px";
            summary.appendChild(ytIcon);
          } else {
            const defaultIcon = document.createElement("i");
            defaultIcon.className = "fas fa-globe";
            defaultIcon.style.fontSize = "14px";
            summary.appendChild(defaultIcon);
          }

          if (sec.url) {
            const link = document.createElement("a");
            link.href = sec.url;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = sec.title;
            link.style.color = "var(--accent)";
            link.style.textDecoration = "underline";
            link.addEventListener('click', (e) => e.stopPropagation());
            summary.appendChild(link);
          } else {
            const titleSpan = document.createElement("span");
            titleSpan.textContent = sec.title;
            summary.appendChild(titleSpan);
          }

          details.appendChild(summary);
          const contentDiv = document.createElement("div");
          contentDiv.style.padding = "6px 10px";
          contentDiv.style.fontSize = "13px";
          contentDiv.style.color = "var(--text)";
          contentDiv.style.whiteSpace = "pre-wrap";
          contentDiv.innerHTML = sanitizeAndRenderMarkdown(sec.content);
          highlightCodeBlocks(contentDiv);
          details.appendChild(contentDiv);
          modalContentEl.appendChild(details);
        });

        modalEl.classList.add("active");
        modalOverlay.classList.add("active");
      });

      modalOverlay.addEventListener("click", () => {
        modalEl.classList.remove("active");
        modalOverlay.classList.remove("active");
        settingsModal.classList.remove("active");
        imageModal.classList.remove("active");
      });
      controls.appendChild(sourcesWrapper);
    }

    if (!wrapper.dataset.messageId) {
      wrapper.dataset.messageId = Date.now().toString();
    }
    currentChat.push({ role: "assistant", content: text, id: wrapper.dataset.messageId });
  }

  addPreCopyButtons(bubble);
  checkScroll();
  return { wrapper, bubble, textContainer, controls };
}

function setSending(isSending) {
  sendBtn.disabled = isSending;
  inputEl.disabled = isSending;
  if (isSending) {
    sendBtn.classList.add("stop");
    sendBtn.querySelector(".send-icon").style.display = "none";
    sendBtn.querySelector(".stop-icon").style.display = "inline";
    sendBtn.setAttribute("aria-label", "Stop generation");
  } else {
    sendBtn.classList.remove("stop");
    sendBtn.querySelector(".send-icon").style.display = "inline";
    sendBtn.querySelector(".stop-icon").style.display = "none";
    sendBtn.setAttribute("aria-label", "Send message");
  }
}

inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

sendBtn.addEventListener("click", () => sendMessage(false));

modalOverlay.addEventListener("click", () => {
  modalEl.classList.remove("active");
  modalOverlay.classList.remove("active");
  settingsModal.classList.remove("active");
  imageModal.classList.remove("active");
});

function formatWebsearchResponse(data) {
  if (data.error) {
    return `⚠️ Error: ${data.error}`;
  }

  let markdown = `### Web Search Results\n`;
  if (Array.isArray(data) && data.length > 0) {
    data.forEach((result, idx) => {
      if (result.site) {
        try {
          const hostname = new URL(result.site).hostname;
          markdown += `- **Result ${idx + 1}**: [${hostname}](${result.site})\n`;
        } catch (e) {
          markdown += `- **Result ${idx + 1}**: [Invalid URL](${result.site})\n`;
        }
        markdown += `  ${result.summary || "No summary available."}\n`;
        if (result.images && Array.isArray(result.images) && result.images.length > 0) {
          markdown += `  **Images**:\n`;
          result.images.forEach((img, imgIdx) => {
            markdown += `  - ![Image ${imgIdx + 1}](${img})\n`;
          });
        }
      } else {
        markdown += `- **Result ${idx + 1}**: No URL available\n`;
        markdown += `  ${result.summary || "No summary available."}\n`;
        if (result.images && Array.isArray(result.images) && result.images.length > 0) {
          markdown += `  **Images**:\n`;
          result.images.forEach((img, imgIdx) => {
            markdown += `  - ![Image ${imgIdx + 1}](${img})\n`;
          });
        }
      }
    });
  } else {
    markdown += `No search results found.\n`;
  }

  markdown += `\n**Source**: SearxNG Web Search`;
  return markdown;
}

function formatWeatherResponse(data) {
  if (data.error) {
    return `⚠️ Weather Error: ${data.error}`;
  }

  const { city, timezone, current, forecast, uv, air_quality, source } = data;

  let markdown = `### Weather in ${city || "Unknown"} (${timezone || "N/A"})\n`;

  markdown += `**Current Conditions**\n`;
  markdown += `- **Temperature**: ${current.temperature || "N/A"} °C\n`;
  markdown += `- **Condition**: ${current.weather_description || "N/A"} ${current.emoji || ""}\n`;
  markdown += `- **Humidity**: ${current.humidity ? current.humidity + "%" : "N/A"}\n`;
  markdown += `- **Wind Speed**: ${current.wind_speed ? current.wind_speed + " km/h" : "N/A"}\n\n`;

  if (uv) {
    markdown += `**UV Index**\n`;
    markdown += `- **Current UV**: ${uv.current_uv || "N/A"}\n`;
    markdown += `- **Daily Max UV**: ${uv.uv_index_max || "N/A"}\n`;
    markdown += `- **UV Band**: ${uv.uv_band.band || "N/A"}\n`;
    if (uv.uv_band.advice) {
      markdown += `- **Advice**: ${uv.uv_band.advice}\n`;
    }
    markdown += `\n`;
  }

  if (air_quality) {
    markdown += `**Air Quality**\n`;
    markdown += `- **PM2.5**: ${air_quality.pm2_5 ? air_quality.pm2_5 + " µg/m³" : "N/A"}\n`;
    markdown += `- **PM10**: ${air_quality.pm10 ? air_quality.pm10 + " µg/m³" : "N/A"}\n`;
    markdown += `- **Nitrogen Dioxide**: ${air_quality.nitrogen_dioxide ? air_quality.nitrogen_dioxide + " µg/m³" : "N/A"}\n`;
    markdown += `- **Ozone**: ${air_quality.ozone ? air_quality.ozone + " µg/m³" : "N/A"}\n`;
    markdown += `- **Sulphur Dioxide**: ${air_quality.sulphur_dioxide ? air_quality.sulphur_dioxide + " µg/m³" : "N/A"}\n`;
    markdown += `- **European AQI**: ${air_quality.european_aqi || "N/A"}\n`;
    markdown += `- **PM2.5 Advisory**: ${air_quality.advisory.level || "N/A"}\n`;
    if (air_quality.advisory.message) {
      markdown += `- **Recommendation**: ${air_quality.advisory.message}\n`;
    }
    markdown += `\n`;
  }

  if (forecast && forecast.length > 0) {
    markdown += `**7-Day Forecast**\n`;
    markdown += `| Date | Max Temp (°C) | Min Temp (°C) | Condition | Wind (km/h) | Precipitation (mm) | Humidity Range (%) |\n`;
    markdown += `|------|---------------|---------------|-----------|-------------|-------------------|-------------------|\n`;
    forecast.forEach(f => {
      const humidityRange = f.humidity_min && f.humidity_max ? `${f.humidity_min}-${f.humidity_max}` : "N/A";
      markdown += `| ${f.date || "N/A"} | ${f.temperature_max || "N/A"} | ${f.temperature_min || "N/A"} | ${f.weather_description || "N/A"} ${f.emoji || ""} | ${f.wind_speed_max || "N/A"} | ${f.precipitation || "N/A"} | ${humidityRange} |\n`;
    });
    markdown += `\n`;
  }

  markdown += `**Source**: [${source}](https://open-meteo.com/)`;
  return markdown;
}

function formatNewsResponse(data) {
  if (data.error) {
    return `⚠️ Error: ${data.error}`;
  }

  const { top_summary, articles } = data;

  let markdown = `### News Summary\n`;
  markdown += `${top_summary || "No summary available."}\n\n`;

  if (articles && articles.length > 0) {
    markdown += `**Recent Articles**\n`;
    articles.forEach((article, idx) => {
      if (article.site) {
        try {
          const hostname = new URL(article.site).hostname;
          markdown += `- **Article ${idx + 1}**: [${hostname}](${article.site})\n`;
        } catch (e) {
          markdown += `- **Article ${idx + 1}**: [Invalid URL](${article.site})\n`;
        }
        markdown += `  ${article.summary || "No summary available."}\n`;
        if (article.images && article.images.length > 0) {
          markdown += `  **Images**:\n`;
          article.images.forEach((img, imgIdx) => {
            markdown += `  - ![Image ${imgIdx + 1}](${img})\n`;
          });
        }
      } else {
        markdown += `- **Article ${idx + 1}**: No URL available\n`;
        markdown += `  ${article.summary || "No summary available."}\n`;
        if (article.images && Array.isArray(article.images) && article.images.length > 0) {
          markdown += `  **Images**:\n`;
          article.images.forEach((img, imgIdx) => {
            markdown += `  - ![Image ${imgIdx + 1}](${img})\n`;
          });
        }
      }
    });
    markdown += `\n`;
  } else {
    markdown += `No articles found.\n\n`;
  }

  markdown += `**Source**: SearxNG News Search`;
  return markdown;
}

let abortController = null;

async function sendMessage(isRetry = false) {
  const text = (inputEl.value || "").trim();
  if (!text && !isRetry) return;

  let messageId = null;
  let displayText = text;
  let pdfSourceUrl = "";
  let pdfSourceContent = "";
  let pdfMetadata = null;

  if (pendingPdf && !isRetry) {
    displayText = `**~${pendingPdf.filename}**\n\n${text}`;
    pdfSourceUrl = pendingPdf.filename;
    pdfSourceContent = pendingPdf.text;
    pdfMetadata = { fromPDF: true };
  }

  if (isRetry) {
    const lastUserMessageIndex = [...currentChat].reverse().findIndex(m => m.role === "user");
    if (lastUserMessageIndex !== -1) {
      messageId = currentChat[currentChat.length - 1 - lastUserMessageIndex].id;
    }
  } else {
    const bubble = addBubble(displayText, "user");
    messageId = bubble.wrapper.dataset.messageId;
    currentChat.push({ role: "user", content: text, id: messageId });
  }

  inputEl.value = "";
  inputEl.placeholder = pendingPdf ? `Ask about ${pendingPdf.filename}...` : "Ask anything...";
  setSending(true);

  const thinkingBubble = addBubble("Thinking", "thinking");

  if (pendingPdf && !isRetry) {
    pendingPdf = null;
    currentChat = currentChat.filter(m => m.role !== "system");
  }

  abortController = new AbortController();

  const originalSendHandler = () => sendMessage(false);
  sendBtn.removeEventListener("click", originalSendHandler);
  const stopHandler = () => {
    if (abortController) {
      abortController.abort();
      abortController = null;
      setSending(false);
      thinkingBubble.wrapper.remove();
      sendBtn.removeEventListener("click", stopHandler);
      sendBtn.addEventListener("click", originalSendHandler);
      inputEl.focus();
    }
  };
  sendBtn.addEventListener("click", stopHandler);

  try {
    let augmentedMessages = [...currentChat];
    let sourceUrl = "";
    let crawledText = "";
    let metadata = null;
    let images = [];
    const detectedUrl = extractUrl(text);
    const youtubeId = detectedUrl ? extractYouTubeId(detectedUrl) : null;
    let embedUrl = youtubeId ? `https://www.youtube.com/embed/${youtubeId}` : "";

    const weatherRegex = /(?:weather|forecast|whather|wheather)\s+(?:in|at|for)\s+([\w\s]+)/i;
    const weatherMatch = text.match(weatherRegex);
    const newsRegex = /news\s+(?:about|on|in|regarding)\s+([\w\s]+)/i;
    const newsMatch = text.match(newsRegex);
    const searchRegex = /search\s+(?:for|about)\s+([\w\s]+)/i;
    const searchMatch = text.match(searchRegex);

    if (weatherMatch) {
      const city = weatherMatch[1].trim();
      const weatherBubble = addBubble("Searching weather...", "bot");
      let weatherText = "";
      try {
        const weatherRes = await fetch(WEATHER_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ city }),
          signal: abortController.signal
        });
        const weatherData = await weatherRes.json();

        if (weatherData.error) {
          weatherBubble.wrapper.remove();
          thinkingBubble.wrapper.remove();
          addBubble(`⚠️ Weather Error: ${weatherData.error}`, "bot");
          return;
        }

        weatherText = formatWeatherResponse(weatherData);
        augmentedMessages = [
          ...currentChat.slice(0, -1),
          {
            role: "system",
            content: systemPrompts.weather.replace("{weather_data}", weatherText)
          },
          currentChat[currentChat.length - 1]
        ];
        sourceUrl = "https://open-meteo.com/";
        crawledText = weatherText;
        metadata = { fromWeather: true };
      } catch (err) {
        if (err.name === "AbortError") {
          return;
        }
        weatherBubble.wrapper.remove();
        thinkingBubble.wrapper.remove();
        addBubble(`⚠️ Weather Error: ${err.message}`, "bot");
        setSending(false);
        inputEl.focus();
        return;
      } finally {
        try { weatherBubble.wrapper.remove(); } catch (e) {}
      }
    } else if (newsMatch) {
      const topic = newsMatch[1].trim();
      const newsBubble = addBubble("Searching News...", "bot");
      let newsText = "";
      try {
        const newsRes = await fetch(NEWS_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: topic }),
          signal: abortController.signal
        });
        const newsData = await newsRes.json();

        if (newsData.error) {
          newsBubble.wrapper.remove();
          thinkingBubble.wrapper.remove();
          addBubble(`⚠️ News Error: ${newsData.error}`, "bot");
          return;
        }

        if (!newsData.articles || !Array.isArray(newsData.articles)) {
          newsBubble.wrapper.remove();
          thinkingBubble.wrapper.remove();
          addBubble(`⚠️ News Error: Invalid or empty articles data`, "bot");
          return;
        }

        images = newsData.articles.reduce((acc, article) => {
          if (article.images && Array.isArray(article.images)) {
            return [...acc, ...article.images];
          }
          return acc;
        }, []);

        newsText = formatNewsResponse(newsData);
        augmentedMessages = [
          ...currentChat.slice(0, -1),
          {
            role: "system",
            content: systemPrompts.news.replace("{news_data}", JSON.stringify(newsData))
          },
          currentChat[currentChat.length - 1]
        ];
        sourceUrl = "SearxNG News Search";
        crawledText = JSON.stringify(newsData);
        metadata = { fromNews: true };
      } catch (err) {
        if (err.name === "AbortError") {
          return;
        }
        newsBubble.wrapper.remove();
        thinkingBubble.wrapper.remove();
        addBubble(`⚠️ News Error: ${err.message}`, "bot");
        setSending(false);
        inputEl.focus();
        return;
      } finally {
        try { newsBubble.wrapper.remove(); } catch (e) {}
      }
    } else if (searchMatch) {
      const query = searchMatch[1].trim();
      const searchBubble = addBubble("Searching...", "bot");
      let searchText = "";
      try {
        const searchRes = await fetch(WEBSEARCH_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
          signal: abortController.signal
        });
        const searchData = await searchRes.json();

        if (searchData.error) {
          searchBubble.wrapper.remove();
          thinkingBubble.wrapper.remove();
          addBubble(`⚠️ Search Error: ${searchData.error}`, "bot");
          return;
        }

        if (!Array.isArray(searchData)) {
          searchBubble.wrapper.remove();
          thinkingBubble.wrapper.remove();
          addBubble(`⚠️ Search Error: Invalid or empty search data`, "bot");
          return;
        }

        images = searchData.reduce((acc, result) => {
          if (result.images && Array.isArray(result.images)) {
            return [...acc, ...result.images];
          }
          return acc;
        }, []);

        searchText = formatWebsearchResponse(searchData);
        augmentedMessages = [
          ...currentChat.slice(0, -1),
          {
            role: "system",
            content: systemPrompts.websearch.replace("{search_data}", JSON.stringify(searchData))
          },
          currentChat[currentChat.length - 1]
        ];
        sourceUrl = "SearxNG Web Search";
        crawledText = JSON.stringify(searchData);
        metadata = { fromWebSearch: true, resultCount: searchData.length };
      } catch (err) {
        if (err.name === "AbortError") {
          return;
        }
        searchBubble.wrapper.remove();
        thinkingBubble.wrapper.remove();
        addBubble(`⚠️ Search Error: ${err.message}`, "bot");
        setSending(false);
        inputEl.focus();
        return;
      } finally {
        try { searchBubble.wrapper.remove(); } catch (e) {}
      }
    } else if (websearchEnabled && !detectedUrl) {
      const searchBubble = addBubble("Searching...", "bot");
      try {
        const searchRes = await fetch(WEBSEARCH_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: text }),
          signal: abortController.signal
        });
        let searchData = await searchRes.json();
        if (searchRes.ok && Array.isArray(searchData) && searchData.length > 0) {
          images = searchData.reduce((acc, result) => {
            if (result.images && Array.isArray(result.images)) {
              return [...acc, ...result.images];
            }
            return acc;
          }, []);

          const searchContext = formatWebsearchResponse(searchData);
          crawledText = JSON.stringify(searchData);
          sourceUrl = "Web search results";
          metadata = { fromWebSearch: true, resultCount: searchData.length };
          augmentedMessages = [
            ...currentChat.slice(0, -1),
            {
              role: "system",
              content: systemPrompts.websearch.replace("{search_data}", searchContext)
            },
            currentChat[currentChat.length - 1]
          ];
        }
      } catch (err) {
        if (err.name === "AbortError") {
          return;
        }
        console.error("Websearch error:", err?.message || err);
      } finally {
        try { searchBubble.wrapper.remove(); } catch (e) {}
      }
    } else if (detectedUrl) {
      const crawlBubble = addBubble("Searching...", "bot");
      try {
        let endpoint = CRAWL_ENDPOINT;
        let isYouTube = false;
        if (detectedUrl.includes("youtube.com/watch?v=") || detectedUrl.includes("youtu.be/")) {
          endpoint = YOUTUBE_ENDPOINT;
          isYouTube = true;
        }

        const crawlRes = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: detectedUrl }),
          signal: abortController.signal
        });
        let crawlData = await crawlRes.json();
        console.log("Crawl response:", crawlData);
        if (crawlRes.ok && crawlData && crawlData.content) {
          crawledText = String(crawlData.content).slice(0, 100000);
          sourceUrl = crawlData.url || detectedUrl;
          metadata = crawlData.metadata || null;
          images = crawlData.images || [];
          console.log("Images extracted:", images);
          augmentedMessages = [
            ...currentChat.slice(0, -1),
            {
              role: "system",
              content: isYouTube
                ? systemPrompts.youtube.replace("{content}", crawledText).replace("{metadata}", JSON.stringify(metadata))
                : systemPrompts.crawl.replace("{content}", crawledText).replace("{metadata}", JSON.stringify(metadata))
            },
            currentChat[currentChat.length - 1]
          ];
          if (isYouTube && metadata) {
            metadata.fromYouTube = true;
          }
        } else {
          throw new Error(crawlData.error || "No content returned from crawl");
        }
      } catch (err) {
        if (err.name === "AbortError") {
          return;
        }
        console.error("Crawl error:", err?.message || err);
        crawlBubble.wrapper.remove();
        thinkingBubble.wrapper.remove();
        addBubble(`⚠️ Crawl Error: ${err.message || "Failed to crawl URL"}`, "bot");
        setSending(false);
        inputEl.focus();
        return;
      } finally {
        try { crawlBubble.wrapper.remove(); } catch (e) {}
      }
    }

    const hasSources = !!(crawledText || sourceUrl || (pdfSourceUrl && pdfSourceContent));
    const finalSourceUrl = pdfSourceUrl || sourceUrl;
    const finalSourceContent = pdfSourceContent || crawledText;
    const finalMetadata = pdfMetadata || metadata;

    let botBubble = null;

    const streamResponse = await fetch(LM_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: currentModel,
        messages: augmentedMessages,
        stream: true
      }),
      signal: abortController.signal
    });

    if (!streamResponse.ok) {
      thinkingBubble.wrapper.remove();
      addBubble("⚠️ Error: Could not reach LM Studio.", "bot");
      setSending(false);
      inputEl.focus();
      sendBtn.removeEventListener("click", stopHandler);
      sendBtn.addEventListener("click", originalSendHandler);
      return;
    }

    const reader = streamResponse.body.getReader();
    const decoder = new TextDecoder();
    let accumulatedText = "";

    const handleStream = async (chunk) => {
      if (!botBubble && chunk && chunk.trim()) {
        botBubble = addBubble("", "bot", hasSources, finalSourceUrl, finalSourceContent, finalMetadata, embedUrl, youtubeId, detectedUrl, images);
        botBubble.wrapper.style.display = "block";
        thinkingBubble.wrapper.remove();
      }
      if (chunk) {
        accumulatedText += chunk;
        if (botBubble) {
          botBubble.textContainer.innerHTML = sanitizeAndRenderMarkdown(accumulatedText);
          botBubble.textContainer.querySelectorAll("a").forEach(a => {
            a.setAttribute("target", "_blank");
            a.setAttribute("rel", "noopener noreferrer");
          });
          highlightCodeBlocks(botBubble.textContainer);
          addPreCopyButtons(botBubble.bubble);
          if (autoScroll) scrollToBottom();
        }
      }
      if (!chunk && botBubble) {
        currentChat.push({ role: "assistant", content: accumulatedText, id: botBubble.wrapper.dataset.messageId });
        addPreCopyButtons(botBubble.bubble);
        if (images && images.length > 0 && !youtubeId) {
          const imageContainer = document.createElement("div");
          imageContainer.className = "image-container";
          images.forEach(src => {
            const img = document.createElement("img");
            img.src = src;
            img.alt = finalMetadata && finalMetadata.fromWebSearch ? "Thumbnail from web search result" : finalMetadata && finalMetadata.fromNews ? "Thumbnail from news article" : "Thumbnail from crawled page";
            img.className = "image-thumbnail";
            img.setAttribute("loading", "lazy");
            img.addEventListener("click", () => {
              expandedImage.src = src;
              imageModal.classList.add("active");
            });
            img.onerror = () => {
              console.warn(`Failed to load image: ${src}`);
              img.style.display = "none";
            };
            imageContainer.appendChild(img);
          });
          botBubble.bubble.appendChild(imageContainer);
        }
      }
      if (!chunk && !botBubble) {
        thinkingBubble.wrapper.remove();
      }
    };

    let done = false;
    while (!done) {
      const { value, done: streamDone } = await reader.read();
      done = streamDone;
      if (value) {
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              done = true;
              break;
            }
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || "";
              if (content) {
                await handleStream(content);
              }
            } catch (e) {
              console.error("Error parsing stream chunk:", e);
            }
          }
        }
      }
    }

    await handleStream("");
  } catch (err) {
    if (err.name === "AbortError") {
      return;
    }
    console.error("LM call error:", err?.message || err);
    thinkingBubble.wrapper.remove();
    addBubble("⚠️ Error: Could not reach LM Studio. Details: " + (err?.message || String(err)), "bot");
  } finally {
    setSending(false);
    inputEl.focus();
    sendBtn.removeEventListener("click", stopHandler);
    sendBtn.addEventListener("click", originalSendHandler);
    abortController = null;
  }
}

const modelBtn = document.getElementById("modelBtn");
const modelList = document.getElementById("modelList");

let currentModel = LM_MODEL;

async function fetchModels() {
  try {
    const res = await fetch("http://localhost:1234/v1/models");
    const data = await res.json();
    const models = data.data || [];
    modelList.innerHTML = "";

    if (models.length === 0) {
      const li = document.createElement("li");
      li.textContent = "No models available";
      li.style.cursor = "default";
      li.style.color = "var(--muted)";
      modelList.appendChild(li);
      return;
    }

    models.forEach(m => {
      const li = document.createElement("li");
      li.textContent = m.id;
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", m.id === currentModel);
      li.classList.toggle("active", m.id === currentModel);
      li.addEventListener("click", () => {
        currentModel = m.id;
        modelBtn.textContent = m.id;
        modelBtn.setAttribute("aria-expanded", "false");
        modelList.classList.remove("active");
        modelList.querySelectorAll("li").forEach(d => {
          d.classList.remove("active");
          d.setAttribute("aria-selected", "false");
        });
        li.classList.add("active");
        li.setAttribute("aria-selected", "true");
      });
      modelList.appendChild(li);
    });

    if (!currentModel && models.length > 0) {
      currentModel = models[0].id;
    }
    modelBtn.textContent = currentModel || "Select Model";
  } catch (err) {
    console.error("Failed to fetch models:", err);
    modelList.innerHTML = '<li style="color: var(--muted); cursor: default;">Error loading models</li>';
  }
}

modelBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  const isExpanded = modelList.classList.toggle("active");
  modelBtn.setAttribute("aria-expanded", isExpanded);
});

document.addEventListener("click", (e) => {
  if (!modelBtn.contains(e.target) && !modelList.contains(e.target)) {
    modelList.classList.remove("active");
    modelBtn.setAttribute("aria-expanded", "false");
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modelList.classList.contains("active")) {
    modelList.classList.remove("active");
    modelBtn.setAttribute("aria-expanded", "false");
    modelBtn.focus();
  }
});

fetchModels();
loadSettings();

const messages = document.querySelector('.messages');
const scrollBtn = document.getElementById('scrollBtn');

function checkScroll() {
  if (messagesEl.scrollTop + messagesEl.clientHeight < messagesEl.scrollHeight - 1) {
    scrollBtn.style.display = 'flex';
  } else {
    scrollBtn.style.display = 'none';
  }
}

messagesEl.addEventListener('scroll', () => {
  const isAtBottom = messagesEl.scrollTop + messagesEl.clientHeight >= messagesEl.scrollHeight - 1;
  autoScroll = isAtBottom;
  checkScroll();
});

scrollBtn.addEventListener("click", () => {
  autoScroll = true;
  messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: "smooth" });
});

function onNewMessage() {
  checkScroll();
}

const pdfBtn = document.getElementById("pdfBtn");
const pdfInput = document.getElementById("pdfInput");

pdfBtn.addEventListener("click", () => {
  pdfInput.click();
});

pdfInput.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  if (file.type !== "application/pdf") {
    addBubble("⚠️ Please select a valid PDF file.", "bot");
    return;
  }

  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await fetch("http://localhost:5000/pdf", {
      method: "POST",
      body: formData
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      addBubble(`⚠️ PDF Error: ${data.error || "Failed to process PDF."}`, "bot");
      return;
    }

    const pdfText = data.content;
    if (!pdfText) {
      addBubble("⚠️ No text could be extracted from the PDF.", "bot");
      return;
    }

    pendingPdf = { filename: file.name, text: pdfText };

    const systemPrompt = `You are an AI assistant with access to the following PDF document:\n\n----- PDF CONTENT START -----\n${pdfText}\n----- PDF CONTENT END -----\n\nYour task:\n- Answer questions strictly based on this document.\n- Provide detailed explanations and well-structured responses.\n- Include relevant sections or quotes when needed.\n- If asked something outside the PDF, politely say you don’t know.`;

    currentChat = currentChat.filter(m => m.role !== "system");
    currentChat.push({ role: "system", content: systemPrompt, id: `system-${Date.now()}` });

    inputEl.placeholder = `Ask about ${file.name}...`;
    inputEl.value = "";
    inputEl.focus();
  } catch (err) {
    console.error("PDF upload error:", err);
    addBubble(`⚠️ PDF Error: ${err.message || "Failed to upload or process PDF."}`, "bot");
  }
});
