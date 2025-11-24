# Release Notes - v0.2.0

## 🎉 Major Release: V2 Client Refactoring

This release introduces significant improvements to the V2 client, making it the recommended way to use the Higgsfield SDK. The V2 client now works directly with the API response format, providing a cleaner and more intuitive interface.

## ✨ New Features

### V2 Client Improvements

- **Direct API Response Handling**: The V2 client now returns `V2Response` objects directly instead of `JobSet`, matching the API response structure exactly
- **Simplified Authentication**: Single `credentials` field support (`KEY_ID:KEY_SECRET` format), similar to fal.ai SDK
- **Enhanced Security**: 
  - Browser environment detection and blocking (SDK is server-side only)
  - Obfuscated User-Agent header (`higgsfield-server-js/2.0`)
- **Improved Polling**: Uses `/requests/{request_id}/status` endpoint for status checking
- **Webhook Support**: Webhooks are now passed as query parameters (`?hf_webhook=<url>`)

## 🔄 Breaking Changes

### V2 Client API Changes

- **Return Type Changed**: `subscribe()` now returns `Promise<V2Response>` instead of `Promise<JobSet>`
- **Response Structure**: The response now matches the API format directly:
  ```typescript
  {
    status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'nsfw',
    request_id: string,
    status_url: string,
    cancel_url: string,
    images?: Array<{ url: string }>,
    video?: { url: string }
  }
  ```
- **Removed Methods**: `getModelSchemas()` method removed from V2 client (endpoint not available in v2)

## 📝 Migration Guide

### Before (v0.1.x)
```typescript
import { higgsfield, config } from '@higgsfield/client/v2';

config({ credentials: 'KEY_ID:KEY_SECRET' });

const jobSet = await higgsfield.subscribe('nano-banana-pro', {
  input: { prompt: 'Test' },
  withPolling: true
});

if (jobSet.isCompleted) {
  console.log(jobSet.jobs[0].results?.raw.url);
}
```

### After (v0.2.0)
```typescript
import { higgsfield, config, V2Response } from '@higgsfield/client/v2';

config({ credentials: 'KEY_ID:KEY_SECRET' });

const response: V2Response = await higgsfield.subscribe('nano-banana-pro', {
  input: { prompt: 'Test' },
  withPolling: true
});

if (response.status === 'completed') {
  response.images?.forEach(img => console.log(img.url));
  if (response.video) {
    console.log(response.video.url);
  }
}
```

## 🛠️ Improvements

- **Type Safety**: Better TypeScript types with `V2Response`, `V2Image`, `V2Video`, and `V2RequestStatus`
- **Documentation**: Updated README with V2 as recommended and V1 marked as deprecated
- **Error Handling**: Improved error messages and handling
- **Code Quality**: Removed unnecessary abstractions, cleaner codebase

## 📚 Documentation Updates

- Complete README reorganization with V2 client featured first
- V1 client marked as deprecated with clear migration path
- Added comprehensive examples for V2 client usage
- Updated authentication documentation

## 🔧 Technical Details

- **Polling Implementation**: New `pollV2Request()` function handles status polling directly
- **Response Transformation**: Removed JobSet transformation layer
- **Browser Detection**: Added `BrowserNotSupportedError` for browser environments
- **User-Agent Obfuscation**: Runtime string construction to avoid exposing in source

## ⚠️ Deprecations

- V1 client is now marked as deprecated (still functional but not recommended for new projects)
- Schema-related functionality removed from V2 (endpoint not available)

## 🐛 Bug Fixes

- Fixed webhook parameter handling (now uses query parameter)
- Fixed polling URL for V2 endpoints
- Improved error handling for missing credentials

## 📦 Dependencies

No dependency changes in this release.

---

**Full Changelog**: See git history for detailed changes.

**Migration Help**: If you need help migrating from v0.1.x to v0.2.0, please refer to the README or open an issue.

