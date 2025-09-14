# lmstudio-webui

- This is an experimental WebUI chat alternative that works with LM Studio.

- I created this UI because I didn’t like OpenWebUI (in terms of web search and other tools).

- It was easier(and faster) for me to integrate tools (weather, web search, etc.) directly into user prompts.

- This is an unofficial project and is not affiliated with or endorsed by LM Studio.
  
![Alt text](screenshots/screen1.png)

---

## Features

* **Streaming Chat** – Receive responses from LM Studio’s API at `http://localhost:1234`.
* **Web Search** – Perform text and image searches using a local SearXNG instance.
* **Single URL** – Process a single, user-provided URL for data extraction.
* **YouTube Transcripts** – Extract transcript text from YouTube videos.
* **PDF Extraction** – Upload PDFs and extract their text for use in the UI.
* **Weather Data** – Get forecasts, air quality, and UV index from Open-Meteo.
* **Custom Prompts** – Edit system prompts directly in the settings.

---

## Using the Built-in Tools

This WebUI integrates several tools directly into the chat.  
You activate them simply by writing prompts in plain English — no special commands or syntax required.  
Below are examples of how to use each tool.

### Weather
Ask for current conditions, forecasts, air quality, or UV index.

**Examples:**
- `weather at Paris`
- `weather in New York tomorrow`

### News
Get recent news about a topic.

**Examples:**
- `news about AI`
- `latest news about space exploration`

### Web Search
Search the web or images using your local SearXNG instance.

**Examples:**
- `search for Michael Jordan`

### Single URL Extraction
Extract information from a specific URL.

**Example:**
- `summarize https://example.com/article`

### YouTube Transcripts
Retrieve the transcript of a YouTube video.

**Examples:**
- `transcript of https://www.youtube.com/watch?v=dQw4w9WgXcQ`
- `summarise of https://www.youtube.com/watch?v=dQw4w9WgXcQ`
### PDF Extraction
Upload PDFs in the interface to extract text.

**Examples:**
- After uploading a PDF file, prompt:
  - `summarize the uploaded PDF`
  - `extract key points from the PDF`

---

## Requirements

- **LM Studio** API enabled at `http://localhost:1234/v1` (CORS enabled)
- **Python 3.13+** (tested with 3.13.7)
- **SearXNG** local instance at `http://127.0.0.1:8888/search` (JSON enabled in `settings.yml`)

---

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/blasterprivate/lmstudio-webui.git
cd lmstudio-webui
````

### 2. Create and Activate a Virtual Environment

```bash
# Create virtual environment
python -m venv venv

# Activate
source venv/bin/activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

---

## How to Use

### 1. Start the Backend

```bash
python server.py
```

The backend will run at `http://0.0.0.0:5000`.

### 2. Start the Frontend

You can either open the HTML file directly in your browser or run a simple HTTP server:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

---
## Security

This Project is designed for local use only. Do not expose your LM Studio server or Backend server to the public internet without proper security measures.

---
## Contributing

This is a personal project. Although the code is publicly available for learning and use, I am not accepting pull requests for new features or bug fixes. If you encounter an issue or have a suggestion, please open an issue to discuss it. Any pull requests submitted will be automatically closed.
