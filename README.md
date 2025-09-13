# lmstudio-webui

A lightweight, browser-based WebUI for LM Studio.
Provides streaming chat, web search, YouTube transcript extraction, PDF processing, and weather queries.
Built with **Flask (Python)** and **JavaScript**
---

## Features

* **Streaming Chat** – responses from LM Studio’s API at `http://localhost:1234`.
* **Web Search** – Uses a local SearXNG instance to perform text and image searches.
* **YouTube Transcripts** – Extracts transcript text from YouTube videos (supports multiple languages).
* **PDF Extraction** – Upload PDFs to extract their text for use in the app.
* **Weather Data** – Retrieves forecasts, air quality, and UV index from Open-Meteo.
* **Custom Prompts** – Edit system prompts in the settings modal.

---

## Requirements

* **LM Studio** API enabled at `http://localhost:1234/v1` (CORS enabled)
* **Python 3.8+** (tested with 3.12.3)
* **SearXNG** local instance at `http://127.0.0.1:8888/search` (JSON enabled at settings.yml)

---

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/lmstudio-webui.git
cd lmstudio-webui
```

### 2. Create and Activate a Virtual Environment

```bash
# Create virtual environment
python -m venv venv

# Activate
# Linux/macOS:
source venv/bin/activate

# Windows:
venv\Scripts\activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

---

## How to Use

1. **Start the Backend**

```bash
python server.py
```

The backend serves at `http://0.0.0.0:5000`.

2. **Start the Frontend**

```bash
python -m http.server 8000
```

Open `http://localhost:8000` in your browser.

---

## Contributing

Contributions, bug reports, and feature requests are welcome.
Please open an issue or submit a pull request.
