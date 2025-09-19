## **Ideas & Fixes**

### **File & Media Handling**

*  Allow **image uploads** **only** for image-based models.
*  Support **code and text file uploads** (HTML, CSS, Python, etc.).
*  Implement **file size limits** and optional **syntax highlighting** for code files.

### **Chat History & Context Management**

*  Store **complete chat history** in a JSON file, including:

  * Web searches
  * News articles
  * YouTube references
  * Other relevant contextual data
*  Implement **context tiers** to optimize token usage:

  * **Tier 1:** Most recent messages (keep full detail)
  * **Tier 2:** Older messages (summarized, references only)
*  Separate older context messages (e.g., websearch/news) from newer ones to avoid overusing context length.

### **Backend & UX Enhancements**

* Optimize image fetching/validation to maintain rich output without slowing responses.
* Add **preview for uploaded files/images** before sending to the model.
* Ensure caching is leveraged to reduce redundant API calls (web, YouTube, weather).

