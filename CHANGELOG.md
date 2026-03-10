## 1.0.12

- **Feature:** Added robust hierarchical `.env` file resolution support (from project root up to `~/.gemini/.env`) to load API keys securely without relying on global environment variables.
- **Fix:** Removed hardcoded local debug paths, unnecessary telemetry, and diagnostic logs from image generation flow for a cleaner production output (Fixes #18).

## 1.0.11

- Set Nano Banana 2 (`gemini-3.1-flash-image-preview`) as the default model.

## 1.0.1

- Fix `edit_file` tool to handle absolute file paths.

## 1.0.0

- Initial release.
