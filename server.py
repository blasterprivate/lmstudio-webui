from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
from bs4 import BeautifulSoup
import re
import logging
import json
from pathlib import Path
from youtube_transcript_api import YouTubeTranscriptApi
from datetime import datetime
from urllib.parse import urlparse
from requests.adapters import HTTPAdapter
from requests.packages.urllib3.util.retry import Retry
from pytube import YouTube
import yt_dlp
import time
import random
from timezonefinder import TimezoneFinder
import pytz
import pdfplumber
import io
from io import BytesIO
from PIL import Image
from concurrent.futures import ThreadPoolExecutor, as_completed

# Constants
CACHE_DIR = Path("./webui_cache/")
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/109.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
]
TOP_LANGUAGES = ['en', 'iw', 'ar', 'es', 'fr', 'ru']
BLACKLISTED_DOMAINS = {
    "facebook.com", "x.com", "twitter.com", "instagram.com",
    "youtube.com", "tiktok.com", "snapchat.com", "reddit.com",
    "linkedin.com", "discord.com", "pinterest.com", "telegram.org",
    "whatsapp.com", "tumblr.com", "twitch.tv", "yahoo.com",
    "netflix.com", "hulu.com", "vimeo.com", "dailymotion.com",
    "bilibili.com", "peertube.tv", "rumble.com", "triller.co",
    "clashapp.co", "wechat.com", "line.me", "kakao.com", "viber.com",
    "signal.org", "messenger.com", "ok.ru", "vk.ru", "weibo.com", "douyin.com",
    "baidu.tieba.com", "xiaohongshu.com", "kuaishou.com", "mixi.jp", "renren.com", "cyworld.com",
    "deviantart.com", "dribbble.com", "behance.net", "medium.com", "soundcloud.com", "bandcamp.com",
    "goodreads.com", "last.fm", "wattpad.com", "flickr.com", "vsco.co", "500px.com", "smugmug.com",
    "tinder.com", "bumble.com", "okcupid.com", "match.com", "hinge.co", "grindr.com", "plentyoffish.com", "zoosk.com",
    "mastodon.social", "pleroma.social", "gab.com", "truthsocial.com", "gettr.com", "parler.com", "blueskyweb.xyz", "post.news",
    "cohost.org", "ello.co", "mewe.com", "minds.com", "quora.com", "4chan.org", "8kun.top", "kbin.social", "lemmy.ml",
    "couchsurfing.com", "nextdoor.com", "gaiaonline.com", "secondlife.com", "houseparty.com", "yolo.com", "crazygames.com",
    "miniclip.com", "addictinggames.com", "pogo.com", "omegle.com", "chatroulette.com", "tinychat.com",
    "fbcdn.net", "fbstatic-a.akamaihd.net", "cdninstagram.com", "licdn.com", "pinimg.com", "redditmedia.com",
    "quantcount.com", "insightexpressai.com", "redditstatic.com", "moatads.com", "redd.it", "tiktokcdn.com",
    "tiktokv.com", "byteoversea.com", "twimg.com", "twtr.cm", "ytimg.com", "googlevideo.com", "youtu.be",
    "youtube-nocookie.com", "vimeocdn.com", "pornhub.com", "pornhub.org", "pornhub.xxx", "xvideos.com",
    "xhamster.com", "redtube.com", "youjizz.com", "tube8.com", "xnxx.com", "spankbang.com", "youporn.com",
    "chaturbate.com", "camsoda.com", "stripchat.com", "bongacams.com", "myfreecams.com", "onlyfans.com",
    "fansly.com", "adultfriendfinder.com", "fetlife.com", "erome.com", "javhd.com", "hclips.com", "porntrex.com",
    "porn.com", "extremetube.com", "aljazeera.com", "reuters.com", "wikinews.org"
}
BLOCKED_TLDS = [
    ".ae", ".am", ".ao", ".ar", ".az", ".bd", ".bg", ".bh", ".bo", ".br", ".bt", ".by",
    ".cl", ".cn", ".cr", ".cz", ".de", ".dk", ".do", ".dz", ".ec", ".eg", ".es",
    ".et", ".fi", ".fr", ".ge", ".gl", ".gr", ".gt", ".hk", ".hn", ".hu", ".id", ".in",
    ".iq", ".ir", ".it", ".jo", ".jp", ".ke", ".kg", ".kr", ".kw", ".kz", ".lb", ".lk",
    ".ly", ".ma", ".mo", ".mr", ".mx", ".my", ".mz", ".na", ".ng", ".ni", ".nl", ".no",
    ".np", ".om", ".pa", ".pe", ".ph", ".pk", ".pl", ".pr", ".ps", ".pt", ".py", ".qa",
    ".ro", ".ru", ".sa", ".sd", ".se", ".sv", ".sy", ".th", ".tj", ".tm", ".tn", ".tr",
    ".tw", ".ua", ".uy", ".uz", ".ve", ".vn", ".ye", ".za", ".zm", ".zw"
]
SEARXNG_URL = "http://127.0.0.1:8888/search"
max_sources = 10
MAX_LOGO_WIDTH = 150
MAX_LOGO_HEIGHT = 150
REQUEST_TIMEOUT = 5
IMAGE_TIMEOUT = 5
WEATHER_TIMEOUT = 5
SEARCH_TIMEOUT = 10
MAX_RETRIES = 1
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
SESSION = requests.Session()
app = Flask(__name__)
CORS(app)
CACHE_DIR.mkdir(parents=True, exist_ok=True)
_TRANSCRIPT_CACHE = {}
_METADATA_CACHE = {}
_WEATHER_CACHE = {}
def _load_cache(name: str) -> dict:
    path = CACHE_DIR / f"{name}.json"
    try:
        with path.open("r", encoding="utf-8") as fp:
            data = json.load(fp)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}
def _save_cache(name: str, data: dict) -> None:
    path = CACHE_DIR / f"{name}.json"
    try:
        with path.open("w", encoding="utf-8") as fp:
            json.dump(data, fp, ensure_ascii=False)
    except Exception as exc:
        logging.warning(f"Failed to save cache {path}: {exc}")
_TRANSCRIPT_CACHE = _load_cache("transcripts")
_METADATA_CACHE = _load_cache("metadata")
_WEATHER_CACHE = _load_cache("weather")
def _safe_json_dumps(data):
    try:
        return json.dumps(data, ensure_ascii=False)
    except Exception:
        return json.dumps({"error": "Failed to serialize JSON"})
def _extract_video_id(url_or_id: str) -> str:
    if url_or_id.startswith("http"):
        if "youtube.com/watch?v=" in url_or_id:
            return url_or_id.split("v=")[1].split("&")[0]
        elif "youtu.be/" in url_or_id:
            return url_or_id.split("youtu.be/")[1].split("?")[0]
    return url_or_id
def make_session():
    session = requests.Session()
    retry = Retry(total=MAX_RETRIES, backoff_factor=0.1, status_forcelist=[500, 502, 503, 504])
    adapter = HTTPAdapter(max_retries=retry)
    session.mount('http://', adapter)
    session.mount('https://', adapter)
    return session
def weather_code_to_description(code: int) -> str:
    weather_codes = {
        0: "Clear sky",
        1: "Mainly clear",
        2: "Partly cloudy",
        3: "Overcast",
        45: "Fog",
        48: "Depositing rime fog",
        51: "Light drizzle",
        53: "Moderate drizzle",
        55: "Dense drizzle",
        61: "Light rain",
        63: "Moderate rain",
        65: "Heavy rain",
        71: "Light snow",
        73: "Moderate snow",
        75: "Heavy snow",
        95: "Thunderstorm",
        96: "Thunderstorm with light hail",
        99: "Thunderstorm with heavy hail"
    }
    return weather_codes.get(code, "Unknown")
def get_weather_emoji(code: int, current_time: datetime = None, sunrise: str = None, sunset: str = None) -> str:
    day_emojis = {
        0: "☀️", 1: "☀️", 2: "⛅", 3: "☁️",
        45: "🌫️", 48: "🌫️",
        51: "🌧️", 53: "🌧️", 55: "🌧️",
        61: "🌧️", 63: "🌧️", 65: "🌧️",
        71: "❄️", 73: "❄️", 75: "❄️",
        95: "⛈️", 96: "⛈️", 99: "⛈️"
    }
    night_emojis = {
        0: "🌙", 1: "🌙", 2: "🌙", 3: "☁️",
        45: "🌫️", 48: "🌫️",
        51: "🌧️", 53: "🌧️", 55: "🌧️",
        61: "🌧️", 63: "🌧️", 65: "🌧️",
        71: "❄️", 73: "❄️", 75: "❄️",
        95: "⛈️", 96: "⛈️", 99: "⛈️"
    }
    if current_time and sunrise and sunset:
        try:
            sunrise_dt = datetime.fromisoformat(sunrise)
            sunset_dt = datetime.fromisoformat(sunset)
            if sunrise_dt.time() <= current_time.time() <= sunset_dt.time():
                return day_emojis.get(code, "")
            else:
                return night_emojis.get(code, "")
        except Exception:
            pass
    return day_emojis.get(code, "")
def get_air_quality_advisory(pm25: float) -> dict:
    if pm25 <= 10:
        return {"level": "Good", "message": "Air quality is good. No precautions necessary."}
    elif pm25 <= 25:
        return {"level": "Moderate", "message": "Air quality is acceptable; sensitive groups may need precautions."}
    elif pm25 <= 50:
        return {"level": "Unhealthy for Sensitive Groups", "message": "Sensitive groups should reduce outdoor activity."}
    elif pm25 <= 75:
        return {"level": "Unhealthy", "message": "Everyone may experience health effects; sensitive groups should avoid outdoor activity."}
    else:
        return {"level": "Hazardous", "message": "Health alert: everyone should avoid outdoor activity."}
def get_uv_band(uv_index: float) -> dict:
    if uv_index <= 2:
        return {"band": "Low", "advice": "Minimal protection required. Wear sunglasses on bright days."}
    elif uv_index <= 5:
        return {"band": "Moderate", "advice": "Wear sunscreen and a hat during midday hours."}
    elif uv_index <= 7:
        return {"band": "High", "advice": "Use sunscreen SPF 30+, wear protective clothing, and avoid midday sun."}
    elif uv_index <= 10:
        return {"band": "Very High", "advice": "Take extra precautions: use SPF 50+, seek shade, and avoid sun from 10 AM to 4 PM."}
    else:
        return {"band": "Extreme", "advice": "Avoid sun exposure; use maximum protection if outdoors."}
def get_timezone_from_coords(lat: float, lon: float) -> str:
    try:
        tf = TimezoneFinder()
        tz_name = tf.timezone_at(lat=lat, lng=lon)
        return tz_name or "UTC"
    except Exception:
        return "UTC"
def fetch_coordinates(city: str) -> tuple:
    try:
        session = make_session()
        headers = {"User-Agent": random.choice(USER_AGENTS)}
        resp = session.get(f"https://nominatim.openstreetmap.org/search?q={city}&format=json&limit=1", headers=headers, timeout=WEATHER_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
        if not data:
            return None, None, None, f"No coordinates found for {city}"
        lat = float(data[0]["lat"])
        lon = float(data[0]["lon"])
        display_name = data[0].get("display_name", city)
        return lat, lon, display_name, None
    except Exception as e:
        return None, None, None, f"Failed to fetch coordinates: {str(e)}"
def weather_assistant(city: str) -> dict:
    cache_key = f"{city}:{datetime.now().strftime('%Y-%m-%d')}"
    cached = _WEATHER_CACHE.get(cache_key)
    if cached and time.time() - cached["timestamp"] < 3600:
        return cached["data"]
    lat, lon, display_name, error = fetch_coordinates(city)
    if error:
        return {"error": error}
    city_name_clean = display_name.split(",")[0]
    try:
        session = make_session()
        headers = {"User-Agent": random.choice(USER_AGENTS)}
        weather_url = (
            f"https://api.open-meteo.com/v1/forecast?"
            f"latitude={lat}&longitude={lon}"
            f"&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code"
            f"&daily=temperature_2m_max,temperature_2m_min,weather_code,"
            f"wind_speed_10m_max,precipitation_sum,relative_humidity_2m_max,"
            f"relative_humidity_2m_min,sunrise,sunset"
            f"&hourly=uv_index"
        )
        resp = session.get(weather_url, headers=headers, timeout=WEATHER_TIMEOUT)
        resp.raise_for_status()
        weather_data = resp.json()
        air_quality_url = (
            f"https://air-quality-api.open-meteo.com/v1/air-quality?"
            f"latitude={lat}&longitude={lon}"
            f"&current=pm10,pm2_5,ozone,nitrogen_dioxide,sulphur_dioxide,european_aqi"
        )
        air_resp = session.get(air_quality_url, headers=headers, timeout=WEATHER_TIMEOUT)
        air_resp.raise_for_status()
        air_quality_data = air_resp.json()
        timezone = get_timezone_from_coords(lat, lon)
        city_time = datetime.now(pytz.timezone(timezone)).strftime("%Y-%m-%d %H:%M:%S %Z")
        current_time_obj = datetime.now(pytz.timezone(timezone))
        current_hour = current_time_obj.hour
        current = {
            "temperature": round(weather_data["current"]["temperature_2m"], 1),
            "humidity": weather_data["current"]["relative_humidity_2m"],
            "wind_speed": round(weather_data["current"]["wind_speed_10m"], 1),
            "weather_code": weather_data["current"]["weather_code"],
            "weather_description": weather_code_to_description(weather_data["current"]["weather_code"]),
            "sunrise": weather_data["daily"]["sunrise"][0],
            "sunset": weather_data["daily"]["sunset"][0],
        }
        current["emoji"] = get_weather_emoji(
            current["weather_code"],
            current_time=current_time_obj,
            sunrise=current["sunrise"],
            sunset=current["sunset"]
        )
        air_quality = {
            "pm2_5": round(air_quality_data["current"]["pm2_5"], 1),
            "pm10": round(air_quality_data["current"]["pm10"], 1),
            "ozone": round(air_quality_data["current"]["ozone"], 1),
            "nitrogen_dioxide": round(air_quality_data["current"]["nitrogen_dioxide"], 1),
            "sulphur_dioxide": round(air_quality_data["current"]["sulphur_dioxide"], 1),
            "european_aqi": air_quality_data["current"]["european_aqi"],
            "advisory": get_air_quality_advisory(air_quality_data["current"]["pm2_5"]),
        }
        uv = {
            "current_uv": round(weather_data["hourly"]["uv_index"][current_hour], 1) if weather_data["hourly"]["uv_index"] else "N/A",
            "uv_index_max": round(max(weather_data["hourly"]["uv_index"][:24]), 1) if weather_data["hourly"]["uv_index"] else "N/A",
            "uv_band": get_uv_band(max(weather_data["hourly"]["uv_index"][:24])) if weather_data["hourly"]["uv_index"] else {"band": "N/A", "advice": "No UV data available"},
        }
        forecast = []
        for i in range(7):
            forecast.append({
                "date": weather_data["daily"]["time"][i],
                "temperature_max": round(weather_data["daily"]["temperature_2m_max"][i], 1),
                "temperature_min": round(weather_data["daily"]["temperature_2m_min"][i], 1),
                "weather_code": weather_data["daily"]["weather_code"][i],
                "weather_description": weather_code_to_description(weather_data["daily"]["weather_code"][i]),
                "emoji": get_weather_emoji(weather_data["daily"]["weather_code"][i]),
                "wind_speed_max": round(weather_data["daily"]["wind_speed_10m_max"][i], 1),
                "precipitation": round(weather_data["daily"]["precipitation_sum"][i], 1)
                                if weather_data["daily"]["precipitation_sum"][i] else "0.0",
                "humidity_max": weather_data["daily"]["relative_humidity_2m_max"][i],
                "humidity_min": weather_data["daily"]["relative_humidity_2m_min"][i],
            })
        city_display = display_name or city or "Unknown"
        response = {
            "city_display": display_name,
            "city": city,
            "timezone": timezone,
            "city_time": city_time,
            "current": current,
            "forecast": forecast,
            "uv": uv,
            "air_quality": air_quality,
            "source": "Open-Meteo",
        }
        _WEATHER_CACHE[cache_key] = {
            "timestamp": time.time(),
            "data": response
        }
        _save_cache("weather", _WEATHER_CACHE)
        return response
    except Exception as e:
        return {"error": f"Failed to fetch weather data: {str(e)}"}
def is_valid_image_size(url: str, min_width: int = 600, min_height: int = 400, headers=None) -> bool:
    try:
        resp = requests.get(url, stream=True, timeout=IMAGE_TIMEOUT, headers=headers)
        resp.raise_for_status()
        resp.raw.decode_content = True
        img = Image.open(BytesIO(resp.content))
        width, height = img.size
        logging.info(f"Image {url} dimensions: {width}x{height}")
        return width >= min_width and height >= min_height
    except Exception as e:
        logging.warning(f"Failed to validate image size for {url}: {str(e)}")
        return False
def safe_to_int(value, default=0):
    if not value:
        return default
    try:
        cleaned_value = re.sub(r'[^\d]', '', str(value))
        return int(cleaned_value) if cleaned_value else default
    except (ValueError, TypeError):
        logging.debug(f"Invalid dimension value: {value}, using default: {default}")
        return default
def fetch_and_clean_webpage(url: str, chunk_size: int = 30000, min_words: int = 100,
                            min_width: int = 600, min_height: int = 400,
                            include_images: bool = True) -> dict:
    headers = {
        "User-Agent": random.choice(USER_AGENTS),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Referer": "https://www.google.com/",
        "Connection": "keep-alive",
    }
    try:
        time.sleep(random.uniform(0.5, 1.0))
        resp = requests.get(url, headers=headers, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        html = resp.text
    except requests.RequestException as e:
        logging.warning(f"Failed to fetch {url}: {str(e)}")
        return {"site": url, "images": [], "content": "", "error": str(e)}
    soup = BeautifulSoup(html, "html.parser")
    for el in soup(["script", "style", "noscript", "iframe", "footer", "nav", "aside"]):
        el.extract()
    main_text = ""
    title = soup.find("title").get_text(strip=True) if soup.find("title") else ""
    meta_desc = soup.find("meta", attrs={"name": "description"})["content"] if soup.find("meta", attrs={"name": "description"}) else ""
    article = soup.find("article")
    main_container = soup.find("main") if not article else None
    content_div = soup.find("div", class_=['content', 'post', 'article-body', 'main-content']) if not article and not main_container else None
    body = soup.find("body") if not article and not main_container and not content_div else None
    container = article or main_container or content_div or body
    if container:
        main_text = " ".join(
            p.get_text(" ", strip=True) for p in container.find_all(
                ['p', 'h1', 'h2', 'h3', 'li', 'span', 'article', 'blockquote', 'section', 'strong', 'em', 'figcaption'],
                recursive=True,
                class_=lambda x: x not in ['advertisement', 'sidebar', 'menu', 'widget']
            )
        )
        main_text = re.sub(r'\s+', ' ', main_text.strip())
        main_text = re.sub(
            r'(Read more|Share this|Click here|Subscribe now|Advertisement|Sponsored|Continue reading|Sign up)',
            '', main_text, flags=re.IGNORECASE
        )
        if len(main_text.split()) < min_words:
            logging.info(f"Initial extraction too short for {url}, trying divs")
            main_text = " ".join(
                p.get_text(" ", strip=True) for p in container.find_all(
                    'div',
                    class_=['content', 'post', 'article-body', 'main-content'],
                    recursive=True
                )
            )
            main_text = re.sub(r'\s+', ' ', main_text.strip())
            main_text = re.sub(
                r'(Read more|Share this|Click here|Subscribe now|Advertisement|Sponsored|Continue reading|Sign up)',
                '', main_text, flags=re.IGNORECASE
            )
        if len(main_text.split()) < min_words:
            logging.info(f"No content extracted for {url}: word count below {min_words}")
            return {"site": url, "images": [], "content": "", "error": "Not enough words"}
    image_urls = []
    if include_images:
        img_tags = container.find_all("img")
        logging.info(f"Found {len(img_tags)} <img> tags for {url}")
        for img in img_tags:
            src = img.get("src") or img.get("data-src")
            if not src:
                continue
            if src.startswith("//"):
                src = "https:" + src
            elif src.startswith("/"):
                parsed_url = urlparse(url)
                src = f"{parsed_url.scheme}://{parsed_url.netloc}{src}"
            ext = src.lower().split("?")[0].split(".")[-1]
            if ext not in ('jpg', 'jpeg', 'png'):
                continue
            alt_text = (img.get("alt") or "").lower()
            title_text = (img.get("title") or "").lower()
            if any(keyword in alt_text + title_text for keyword in ["logo", "brand", "icon", "thumbnail"]):
                logging.info(f"Skipping logo by alt/title: {src}")
                continue
            if re.search(r'logo|icon|brand|thumbnail', src, re.IGNORECASE):
                logging.info(f"Skipping logo or thumbnail by filename: {src}")
                continue
            if img.find_parent(["header", "nav"]):
                logging.info(f"Skipping logo inside header/nav: {src}")
                continue
            width = safe_to_int(img.get("width"), 0)
            height = safe_to_int(img.get("height"), 0)
            if width <= MAX_LOGO_WIDTH and height <= MAX_LOGO_HEIGHT:
                logging.info(f"Skipping small image (likely logo): {src}")
                continue
            if width >= min_width and height >= min_height:
                logging.info(f"Image {src} passed attribute size check: {width}x{height}")
                image_urls.append(src)
            else:
                if ext != 'svg' and is_valid_image_size(src, min_width, min_height, headers=headers):
                    image_urls.append(src)
                elif ext == 'svg':
                    logging.info(f"SVG detected, adding without size check: {src}")
                    image_urls.append(src)
            if len(image_urls) >= 10:
                logging.info(f"Reached 10 valid images for {url}, stopping image collection")
                break
    return {"site": url, "images": image_urls, "content": main_text[:chunk_size], "title": title, "meta_description": meta_desc}
def summarize_webpage(urls, max_words=500, target_count=max_sources, min_words=100, include_images=True, max_images=10):
    summaries = []
    total_images = 0
    with ThreadPoolExecutor(max_workers=10) as executor:
        future_to_url = {
            executor.submit(fetch_and_clean_webpage, url, min_words=min_words, include_images=include_images): url
            for url in urls
        }
        for future in as_completed(future_to_url):
            try:
                data = future.result()
            except Exception as e:
                logging.warning(f"Summarization task failed: {str(e)}")
                continue
            if not data.get("content"):
                continue
            sentences = re.split(r'(?<=[.!?])\s+', data["content"])[:10]
            if include_images and total_images < max_images:
                images = data.get("images", [])[:max_images - total_images]
                total_images += len(images)
            else:
                images = []
            summary_data = {
                "site": data["site"],
                "summary": ' '.join(sentences),
                "title": data.get("title", ""),
                "meta_description": data.get("meta_description", ""),
                "images": images
            }
            summaries.append(summary_data)
            if len(summaries) >= target_count:
                break
    return _safe_json_dumps(summaries)
def fetch_youtube_content(video_url_or_id: str) -> dict:
    vid = _extract_video_id(video_url_or_id)
    transcript_data = get_youtube_transcript(vid)
    metadata = get_youtube_metadata(vid)
    transcript_dict = json.loads(transcript_data)
    if "error" in transcript_dict:
        return {"site": video_url_or_id, "content": "", "error": transcript_dict["error"]}
    return {
        "site": video_url_or_id,
        "content": transcript_dict["transcript"],
        "metadata": metadata
    }
def get_youtube_transcript(video_id: str) -> str:
    try:
        if video_id in _TRANSCRIPT_CACHE:
            transcript_text = _TRANSCRIPT_CACHE[video_id]
        else:
            api = YouTubeTranscriptApi()
            available = [t.language_code for t in api.list(video_id)]
            trans_obj = None
            for lang in TOP_LANGUAGES:
                if lang in available:
                    trans_obj = api.list(video_id).find_transcript([lang])
                    break
            if not trans_obj:
                return _safe_json_dumps({"error": "No transcript found"})
            entries = trans_obj.fetch().to_raw_data()
            transcript_text = " ".join(e["text"] for e in entries)
            _TRANSCRIPT_CACHE[video_id] = transcript_text
            _save_cache("transcripts", _TRANSCRIPT_CACHE)
        return _safe_json_dumps({"transcript": transcript_text})
    except Exception as e:
        return _safe_json_dumps({"error": str(e)})
def get_youtube_metadata(video_id: str) -> dict:
    try:
        if video_id in _METADATA_CACHE:
            return _METADATA_CACHE[video_id]
        url = f"https://www.youtube.com/watch?v={video_id}"
        try:
            ydl_opts = {"skip_download": True, "quiet": True}
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
            meta = {
                "title": info.get("title"),
                "channel_name": info.get("uploader"),
                "language": info.get("language", "Unknown"),
                "is_generated": False
            }
        except Exception:
            yt = YouTube(url)
            meta = {
                "title": yt.title,
                "channel_name": yt.author,
                "language": "Unknown",
                "is_generated": False
            }
        _METADATA_CACHE[video_id] = meta
        _save_cache("metadata", _METADATA_CACHE)
        return meta
    except Exception as e:
        return {"title": None, "channel_name": None, "language": "Unknown", "is_generated": False, "error": str(e)}
def extract_news_links(query: str, searxng_url=SEARXNG_URL, max_pages=3):
    results, seen = [], set()
    session = make_session()
    headers = {
        "User-Agent": random.choice(USER_AGENTS),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Referer": "https://www.google.com/",
    }
    for page in range(max_pages):
        params = {"q": query, "format": "json", "categories": "news", "language": "en", "p": page}
        try:
            time.sleep(random.uniform(0.5, 2.0))
            resp = session.get(searxng_url, params=params, headers=headers, timeout=SEARCH_TIMEOUT)
            resp.raise_for_status()
            data = resp.json()
        except Exception:
            continue
        for r in data.get("results", []):
            url = r.get("url")
            if not url or url in seen:
                continue
            seen.add(url)
            results.append({"site": url, "title": r.get("title"), "snippet": r.get("content") or r.get("snippet")})
    return results
def is_allowed_domain(url: str) -> bool:
    try:
        domain = urlparse(url).netloc.lower()
        domain = ".".join(domain.split('.')[-2:])
        if domain in BLACKLISTED_DOMAINS:
            logging.info(f"Blocked blacklisted domain: {domain}")
            return False
        if any(domain.endswith(tld) for tld in BLOCKED_TLDS):
            logging.info(f"Blocked restricted TLD: {domain}")
            return False
        return True
    except Exception as e:
        logging.warning(f"Failed to parse domain for {url}: {e}")
        return False
def get_valid_urls(candidates, min_words=100, target_count=max_sources, include_images=False):
    valid_urls = []
    used_domains = set()
    domain_to_candidate = {}
    for c in candidates:
        url = c.get("site")
        if not url:
            continue
        domain = urlparse(url).netloc.lower()
        domain = ".".join(domain.split('.')[-2:])
        if domain in used_domains or domain in domain_to_candidate:
            continue
        if not is_allowed_domain(url):
            continue
        domain_to_candidate[domain] = c
    def process_url(candidate):
        url = candidate.get("site")
        if not url:
            return None, None
        domain = urlparse(url).netloc.lower()
        domain = ".".join(domain.split('.')[-2:])
        data = fetch_and_clean_webpage(url, min_words=min_words, include_images=include_images)
        if "error" in data or not data.get("content"):
            return None, None
        return url, domain
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(process_url, c) for c in domain_to_candidate.values()]
        for future in as_completed(futures):
            try:
                url, domain = future.result()
                if url and domain:
                    valid_urls.append(url)
                    used_domains.add(domain)
                if len(valid_urls) >= target_count:
                    break
            except Exception as e:
                logging.warning(f"URL validation failed: {str(e)}")
    return valid_urls
def news_assistant(topic: str):
    links_raw = extract_news_links(topic)
    if not links_raw:
        return _safe_json_dumps({"error": "No news articles found"})
    valid_urls = get_valid_urls(links_raw, min_words=100, target_count=max_sources, include_images=True)
    summaries = json.loads(summarize_webpage(valid_urls, target_count=max_sources, min_words=100, include_images=True))
    output = {
        "top_summary": ". ".join(s.get("summary", "") for s in summaries)[:500] + ".",
        "articles": summaries
    }
    return _safe_json_dumps(output)
def websearch_assistant(topic: str):
    session = make_session()
    results = []
    seen = set()
    headers = {
        "User-Agent": random.choice(USER_AGENTS),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Referer": "https://www.google.com/",
    }
    for page in range(3):
        params = {"q": topic, "format": "json", "categories": "general", "language": "en", "p": page}
        try:
            time.sleep(random.uniform(0.5, 2.0))
            resp = session.get(SEARXNG_URL, params=params, headers=headers, timeout=SEARCH_TIMEOUT)
            resp.raise_for_status()
            data = resp.json()
        except Exception:
            continue
        for r in data.get("results", []):
            url = r.get("url")
            if not url or url in seen:
                continue
            seen.add(url)
            results.append({"site": url, "title": r.get("title"), "snippet": r.get("content") or r.get("snippet")})
    valid_urls = get_valid_urls(results, min_words=100, target_count=max_sources, include_images=True)
    summaries = json.loads(summarize_webpage(valid_urls, target_count=max_sources, min_words=100, include_images=True))
    return _safe_json_dumps(summaries)
@app.route("/pdf", methods=["POST"])
def pdf():
    try:
        if 'file' not in request.files:
            logging.warning("No file provided in PDF request")
            return jsonify({"error": "No PDF file provided"}), 400
        file = request.files['file']
        if not file.filename.lower().endswith('.pdf'):
            logging.warning(f"Invalid file type uploaded: {file.filename}")
            return jsonify({"error": "File is not a PDF"}), 400
        logging.debug(f"Processing PDF file: {file.filename}")
        pdf_bytes = io.BytesIO(file.read())
        text = ""
        try:
            with pdfplumber.open(pdf_bytes) as pdf:
                for i, page in enumerate(pdf.pages, 1):
                    page_text = page.extract_text()
                    if page_text:
                        page_text = "\n".join(line.strip() for line in page_text.splitlines() if line.strip())
                        text += page_text + "\n\n"
                        logging.debug(f"Page {i}: Extracted {len(page_text)} characters")
                    else:
                        logging.debug(f"Page {i}: No text extracted")
            text = text.strip()
            if not text:
                logging.warning(f"No text extracted from PDF: {file.filename}")
                return jsonify({"error": "No text could be extracted from the PDF"}), 400
            logging.info(f"Extracted text from PDF (length: {len(text)})")
            return jsonify({"content": text})
        except Exception as e:
            logging.error(f"Failed to process PDF {file.filename}: {str(e)}")
            return jsonify({"error": f"Failed to process PDF: {str(e)}"}), 500
    except Exception as e:
        logging.error(f"PDF endpoint error: {str(e)}")
        return jsonify({"error": str(e)}), 500
@app.route("/crawl", methods=["POST"])
def crawl():
    data = request.get_json()
    query = data.get("query")
    if not query:
        return jsonify({"content": "", "site": "", "images": []}), 200

    if not query.startswith(("http://", "https://")):
        query = f"https://{query}"

    # Check if URL is localhost or likely invalid
    parsed_url = urlparse(query)
    if parsed_url.hostname in ("localhost", "127.0.0.1", "::1"):
        logging.info(f"Skipping crawl for localhost URL: {query}")
        return jsonify({
            "site": query,
            "content": "",  # Empty content as requested
            "images": []
        }), 200

    try:
        if "youtube.com/watch?v=" in query or "youtu.be/" in query:
            return jsonify({
                "site": query,
                "content": "",
                "images": []
            }), 200  # Avoid error for YouTube URLs
        result = fetch_and_clean_webpage(query, include_images=True)
        return jsonify(result), 200
    except Exception as e:
        logging.warning(f"Crawl failed for {query}: {str(e)}")
        return jsonify({
            "site": query,
            "content": "",  # Empty content for failed crawls
            "images": []
        }), 200
@app.route("/youtube", methods=["POST"])
def youtube():
    data = request.get_json()
    query = data.get("query")
    if not query:
        return jsonify({"error": "No query provided"}), 400
    try:
        return jsonify(fetch_youtube_content(query))
    except Exception as e:
        return jsonify({"error": str(e)}), 500
@app.route("/news", methods=["POST"])
def news():
    data = request.get_json()
    query = data.get("query")
    if not query:
        return jsonify({"error": "No query provided"}), 400
    try:
        return jsonify(json.loads(news_assistant(query)))
    except Exception as e:
        return jsonify({"error": str(e)}), 500
@app.route("/websearch", methods=["POST"])
def websearch():
    data = request.get_json()
    query = data.get("query")
    if not query:
        return jsonify({"error": "No query provided"}), 400
    try:
        return jsonify(json.loads(websearch_assistant(query)))
    except Exception as e:
        return jsonify({"error": str(e)}), 500
@app.route("/weather", methods=["POST"])
def weather():
    data = request.get_json()
    city = data.get("city")
    if not city:
        return jsonify({"error": "No city provided"}), 400
    try:
        return jsonify(weather_assistant(city))
    except Exception as e:
        return jsonify({"error": str(e)}), 500
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
