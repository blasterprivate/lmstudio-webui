1. **Develop Main System Prompt:**

   * Create a primary system prompt that allows other tool prompts to remain smaller in token size, optimizing token usage when multiple tools are called.

2. **Implement Chat History Management:**

   * Store chat history in a JSON file, including all contextual information such as web searches, news, YouTube references, and other relevant data.

3. **Add Settings UI for Model Parameters:**

   * Introduce a settings button next to the model selector that allows adjustments for:

     * Temperature
     * Top-k sampling
     * Top-p sampling
     * Minimum probability sampling
     * Repeat penalty

4. **Update Fetch Logic for URLs in Scripts/Examples:**

   * Modify the system to detect URLs embedded in code snippets or examples.
   * Skip fetching or processing these URLs to avoid unnecessary requests or errors.
   * Ensure that only “live” URLs outside code blocks are fetched.

5. **Refine Image Size Checking:**

   * Implement stricter validation for image dimensions and file size.
   * Ensure images meet the required resolution or aspect ratio before processing.
   * Provide warnings or automatic adjustments for images that are too large, too small, or have incorrect dimensions.
