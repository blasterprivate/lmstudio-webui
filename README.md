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

* **LM Studio** API enabled at `http://localhost:1234/v1`
* **Python 3.8+** (tested with 3.12.3)
* **SearXNG** local instance at `http://127.0.0.1:8888/search` (JSON enabled)

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

3. **Feautres**

| Feature                 | How to Use                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------- |
| **Chat**                | Select a model, type a prompt in the input box, and click **Send** for streaming responses. |
| **Web Search**          | Enable the globe icon to include text and image results from SearXNG.                       |
| **YouTube Transcripts** | Enable the YouTube icon and paste a video URL to extract transcripts.                       |
| **PDF Upload**          | Click the PDF icon to upload a file and extract its text.                                   |
| **Weather Queries**     | Ask “weather in \[city]” directly in the chat input to retrieve forecasts and conditions.   |
| **Custom Prompts**      | Use the settings icon to edit or replace system prompts.                                    |

---

## Contributing

Contributions, bug reports, and feature requests are welcome.
Please open an issue or submit a pull request.
