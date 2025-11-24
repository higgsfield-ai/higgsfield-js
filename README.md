# Higgsfield SDK for Node.js and TypeScript

Official SDK for interacting with Higgsfield AI's video and image generation APIs.

## Installation

```bash
npm install @higgsfield/client
```

---

## V2 Client (Recommended)

The v2 client is the modern, recommended way to use the Higgsfield SDK. It features:
- Single `credentials` field (`KEY_ID:KEY_SECRET` format)
- `Authorization: Key KEY_ID:KEY_SECRET` authentication header
- Automatic obfuscated `User-Agent: higgsfield-server-js/2.0` header
- Server-side only (browser usage blocked for security)
- Simplified API with `subscribe()` method
- Automatic polling via `/requests/{request_id}/status` endpoint

### Quick Start

```typescript
import { higgsfield, config } from '@higgsfield/client/v2';

// Configure credentials
config({
  credentials: 'YOUR_KEY_ID:YOUR_KEY_SECRET'
});

// Generate content
const jobSet = await higgsfield.subscribe('flux-pro/kontext/max/text-to-image', {
  input: {
    aspect_ratio: '9:16',
    prompt: 'A beautiful sunset',
    safety_tolerance: 2,
    seed: 1234
  },
  withPolling: true
});

if (jobSet.isCompleted) {
  console.log('Image URL:', jobSet.jobs[0].results?.raw.url);
}
```

### Authentication

The v2 client supports multiple authentication methods:

**Option 1: Single credentials field (recommended)**
```typescript
import { config } from '@higgsfield/client/v2';

config({
  credentials: 'YOUR_KEY_ID:YOUR_KEY_SECRET'
});
```

**Option 2: Separate fields (backward compatibility)**
```typescript
config({
  apiKey: 'YOUR_KEY_ID',
  apiSecret: 'YOUR_KEY_SECRET'
});
```

**Option 3: Environment variables**
```bash
# Preferred: Single variable
export HF_CREDENTIALS="YOUR_KEY_ID:YOUR_KEY_SECRET"

# Or separate variables
export HF_API_KEY="YOUR_KEY_ID"
export HF_API_SECRET="YOUR_KEY_SECRET"
```

```typescript
// No config needed - automatically reads from environment
import { higgsfield } from '@higgsfield/client/v2';
```

### Creating a Client Instance

```typescript
import { createHiggsfieldClient } from '@higgsfield/client/v2';

const client = createHiggsfieldClient({
  credentials: 'YOUR_KEY_ID:YOUR_KEY_SECRET'
});
```

### API Methods

#### `subscribe(endpoint, options)`

Subscribe to an endpoint for content generation:

```typescript
const jobSet = await higgsfield.subscribe('flux-pro/kontext/max/text-to-image', {
  input: {
    aspect_ratio: '9:16',
    prompt: 'A beautiful sunset',
    safety_tolerance: 2,
    seed: 1234
  },
  withPolling: true,  // Automatically poll for completion (default: true)
  webhook: {           // Optional webhook
    url: 'https://your-webhook-url.com/callback',
    secret: 'your-webhook-secret'
  }
});
```

**Parameters:**
- `endpoint` (string): The API endpoint (e.g., `'flux-pro/kontext/max/text-to-image'`)
- `options.input` (object): Input parameters for the endpoint
- `options.withPolling` (boolean, default: `true`): Automatically poll for job completion
- `options.webhook` (object, optional): Webhook configuration
  - `url` (string): Webhook URL
  - `secret` (string): Webhook secret

**Note:** When a webhook is provided, the SDK automatically appends `?hf_webhook=<url>` to the endpoint URL.

### Examples

#### Text-to-Image Generation

```typescript
import { higgsfield, config } from '@higgsfield/client/v2';

config({
  credentials: 'YOUR_KEY_ID:YOUR_KEY_SECRET'
});

const jobSet = await higgsfield.subscribe('flux-pro/kontext/max/text-to-image', {
  input: {
    aspect_ratio: '9:16',
    prompt: 'A majestic mountain landscape at sunset',
    safety_tolerance: 2,
    seed: 1234
  },
  withPolling: true
});

if (jobSet.isCompleted) {
  console.log('Image URL:', jobSet.jobs[0].results?.raw.url);
}
```

#### Image-to-Video Generation

```typescript
const jobSet = await higgsfield.subscribe('/v1/image2video/dop', {
  input: {
    model: 'dop-turbo',
    prompt: 'Cinematic camera movement',
    input_images: [{ 
      type: 'image_url', 
      image_url: 'https://example.com/image.jpg' 
    }]
  },
  withPolling: true
});

if (jobSet.isCompleted) {
  console.log('Video URL:', jobSet.jobs[0].results?.raw.url);
}
```

### Polling & Status Lifecycle

The v2 client automatically polls `/requests/{request_id}/status` when `withPolling` is `true`. The API returns responses with the following structure:

**Status Values:**
- `queued` – Request accepted and waiting for execution
- `in_progress` – Generation currently running (cannot cancel)
- `nsfw` – Content rejected by moderation, credits refunded
- `failed` – Generation errored, credits refunded
- `completed` – Generation finished and media URLs are returned

**API Response Format:**
```json
{
  "status": "completed",
  "request_id": "d7e6c0f3-6699-4f6c-bb45-2ad7fd9158ff",
  "status_url": "https://platform.higgsfield.ai/requests/d7e6c0f3-6699-4f6c-bb45-2ad7fd9158ff/status",
  "cancel_url": "https://platform.higgsfield.ai/requests/d7e6c0f3-6699-4f6c-bb45-2ad7fd9158ff/cancel",
  "images": [{ "url": "https://image.url/example.jpg" }],
  "video": { "url": "https://video.url/example.mp4" }
}
```

The SDK automatically converts this response into a `JobSet` with a single job, mapping `images`/`video` to `results.raw` and `results.min` for compatibility with existing code.

### Working with JobSet

```typescript
const jobSet = await higgsfield.subscribe('flux-pro/kontext/max/text-to-image', {
  input: { prompt: 'Test' },
  withPolling: true
});

// Check status
console.log('JobSet ID:', jobSet.id);
console.log('Is completed:', jobSet.isCompleted);
console.log('Is queued:', jobSet.isQueued);
console.log('Is in progress:', jobSet.isInProgress);
console.log('Is failed:', jobSet.isFailed);
console.log('Is NSFW:', jobSet.isNsfw);

// Access results
for (const job of jobSet.jobs) {
  if (job.results) {
    console.log('Result URL:', job.results.raw.url);
    console.log('Thumbnail URL:', job.results.min.url);
  }
}
```

### Configuration

```typescript
import { createHiggsfieldClient } from '@higgsfield/client/v2';

const client = createHiggsfieldClient({
  credentials: 'YOUR_KEY_ID:YOUR_KEY_SECRET',
  
  // Optional configuration
  baseURL: 'https://platform.higgsfield.ai', // Default
  timeout: 120000, // 2 minutes default
  maxRetries: 3,
  retryBackoff: 1000,
  retryMaxBackoff: 60000,
  pollInterval: 2000, // Check every 2 seconds
  maxPollTime: 300000, // Timeout after 5 minutes
  headers: {
    'X-Custom-Header': 'value'
  }
});
```

### TypeScript Support

```typescript
import { 
  createHiggsfieldClient,
  HiggsfieldClient,
  JobSet
} from '@higgsfield/client/v2';

const client: HiggsfieldClient = createHiggsfieldClient({
  credentials: 'YOUR_KEY_ID:YOUR_KEY_SECRET'
});

const jobSet: JobSet = await client.subscribe('flux-pro/kontext/max/text-to-image', {
  input: {
    prompt: 'Test',
    aspect_ratio: '1:1'
  }
});
```

---

## V1 Client (Deprecated)

> **⚠️ Deprecated:** The v1 client is deprecated. Please use the [V2 Client](#v2-client-recommended) for new projects. The v1 client will continue to work but will not receive new features or updates.

The v1 client uses the traditional `generate()` method and supports both browser and Node.js environments.

### Quick Start

```typescript
import { HiggsfieldClient } from '@higgsfield/client';
import { InputImage, SoulQuality, SoulSize, BatchSize, DoPModel } from '@higgsfield/client/helpers';

// Initialize the client
const client = new HiggsfieldClient({
  apiKey: 'YOUR_API_KEY',
  apiSecret: 'YOUR_API_SECRET'
});
```

### Authentication

**Option 1: Pass credentials directly**
```typescript
const client = new HiggsfieldClient({
  apiKey: 'YOUR_API_KEY',
  apiSecret: 'YOUR_API_SECRET'
});
```

**Option 2: Use environment variables**
```bash
export HF_API_KEY="YOUR_API_KEY"
export HF_SECRET="YOUR_API_SECRET"
```

```typescript
const client = new HiggsfieldClient();
```

### API Methods

#### `generate(endpoint, params, options?)`

Generate content using any Higgsfield API endpoint:

```typescript
const jobSet = await client.generate('/v1/text2image/soul', {
  prompt: 'A beautiful landscape',
  width_and_height: SoulSize.SQUARE_1536x1536,
  quality: SoulQuality.HD,
  batch_size: BatchSize.SINGLE
}, {
  withPolling: true, // Default: true
  webhook: {
    url: 'https://your-webhook-url.com/callback',
    secret: 'your-webhook-secret'
  }
});
```

#### Other Methods

- `getMotions(): Promise<Motion[]>` - Get available motions for image-to-video generation
- `getSoulStyles(): Promise<SoulStyle[]>` - Get available Soul styles for text-to-image generation
- `uploadImage(imageBuffer: Buffer, format?: 'jpeg' | 'png' | 'webp'): Promise<string>` - Upload an image
- `upload(data: Buffer | Uint8Array, contentType: string): Promise<string>` - Upload any data
- `createSoulId(data: SoulIdCreateData, withPolling?: boolean): Promise<SoulId>` - Create a custom character reference
- `listSoulIds(page?: number, pageSize?: number): Promise<SoulIdListResponse>` - List all your SoulIds

### Examples

#### Image-to-Video Generation (DoP Model)

```typescript
import { InputImage, DoPModel, inputMotion } from '@higgsfield/client/helpers';

// Basic usage
const jobSet = await client.generate('/v1/image2video/dop', {
  model: DoPModel.TURBO,
  prompt: 'Cinematic camera movement around the subject',
  input_images: [InputImage.fromUrl('https://example.com/image.jpg')]
});

// With motions
const motions = await client.getMotions();
const zoomMotion = motions.find(m => m.name === 'Zoom In');

const jobSet = await client.generate('/v1/image2video/dop', {
  model: DoPModel.TURBO,
  prompt: 'Apply zoom motion to the subject',
  input_images: [InputImage.fromUrl('https://example.com/image.jpg')],
  motions: [inputMotion(zoomMotion.id, 0.8)]
});
```

#### Text-to-Image Generation (Soul)

```typescript
import { SoulQuality, SoulSize, BatchSize, strength, seed } from '@higgsfield/client/helpers';

// Basic usage
const jobSet = await client.generate('/v1/text2image/soul', {
  prompt: 'A majestic mountain landscape at sunset',
  width_and_height: SoulSize.SQUARE_1536x1536,
  quality: SoulQuality.HD,
  batch_size: BatchSize.SINGLE
});

// With style presets
const styles = await client.getSoulStyles();
const oilPaintingStyle = styles.find(s => s.name === 'Oil Painting');

const jobSet = await client.generate('/v1/text2image/soul', {
  prompt: 'Portrait of a wise elderly person',
  style_id: oilPaintingStyle.id,
  style_strength: strength(0.8),
  width_and_height: SoulSize.PORTRAIT_1536x2048,
  quality: SoulQuality.HD,
  batch_size: BatchSize.QUAD,
  seed: seed(12345)
});
```

#### Speech-to-Video Generation (Speak v2)

```typescript
import { InputImage, InputAudio, SpeakVideoQuality, SpeakDuration } from '@higgsfield/client/helpers';

const jobSet = await client.generate('/v1/speak/higgsfield', {
  input_image: InputImage.fromUrl('https://example.com/avatar.jpg'),
  input_audio: InputAudio.fromUrl('https://example.com/speech.wav'), // Only WAV files
  prompt: 'Professional presentation style',
  quality: SpeakVideoQuality.MID,
  duration: SpeakDuration.SHORT
});
```

#### Custom Character References (SoulIds)

```typescript
import { InputImageType } from '@higgsfield/client';

// List existing SoulIds
const soulIdList = await client.listSoulIds(1, 10);

// Create a new SoulId
const newSoulId = await client.createSoulId({
  name: 'My Character',
  input_images: [
    { type: InputImageType.IMAGE_URL, image_url: 'https://example.com/ref1.jpg' },
    { type: InputImageType.IMAGE_URL, image_url: 'https://example.com/ref2.jpg' }
  ]
}, true); // with polling

// Use in generation
if (newSoulId.isCompleted) {
  const jobSet = await client.generate('/v1/text2image/soul', {
    prompt: 'Portrait in professional attire',
    custom_reference_id: newSoulId.id,
    custom_reference_strength: strength(1),
    width_and_height: SoulSize.PORTRAIT_1536x2048,
    quality: SoulQuality.HD
  });
}
```

### Configuration

```typescript
const client = new HiggsfieldClient({
  // Authentication
  apiKey: 'YOUR_API_KEY',
  apiSecret: 'YOUR_API_SECRET',
  
  // API Configuration
  baseURL: 'https://platform.higgsfield.ai', // Default
  timeout: 120000, // 2 minutes default
  
  // Retry Configuration
  maxRetries: 3,
  retryBackoff: 1000,
  retryMaxBackoff: 60000,
  
  // Polling Configuration
  pollInterval: 2000, // Check every 2 seconds
  maxPollTime: 300000, // Timeout after 5 minutes
  
  // Custom Headers
  headers: {
    'X-Custom-Header': 'value'
  }
});
```

---

## Error Handling

The SDK provides comprehensive error handling with specific error types:

```typescript
import { 
  AuthenticationError, 
  BadInputError, 
  ValidationError, 
  NotEnoughCreditsError, 
  APIError,
  BrowserNotSupportedError // V2 only
} from '@higgsfield/client';

try {
  const jobSet = await higgsfield.subscribe('flux-pro/kontext/max/text-to-image', {
    input: { prompt: 'Test' }
  });
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('❌ Authentication failed - check your API credentials');
  } else if (error instanceof NotEnoughCreditsError) {
    console.error('💳 Insufficient credits - please top up your account');
  } else if (error instanceof BadInputError) {
    console.error('📋 Invalid input parameters:', error.message);
  } else if (error instanceof ValidationError) {
    console.error('⚠️  Validation error:', error.message);
  } else if (error instanceof APIError) {
    console.error('🌐 API Error:', error.statusCode, error.message);
  } else if (error instanceof BrowserNotSupportedError) {
    console.error('🚫 Browser usage not supported - use Node.js environment');
  } else {
    console.error('💥 Unexpected error:', error);
  }
}
```

### Job Status Handling

```typescript
for (const job of jobSet.jobs) {
  switch (job.status) {
    case 'completed':
      console.log('Success:', job.results?.raw.url);
      break;
    case 'failed':
      console.error('Generation failed');
      break;
    case 'nsfw':
      console.warn('Content flagged as NSFW');
      break;
    case 'canceled':
      console.warn('Job was canceled');
      break;
  }
}
```

---

## Best Practices

1. **Use V2 Client**: For new projects, always use the V2 client as it's actively maintained and includes security improvements.

2. **Upload large files**: For better performance, upload large image/audio files to the CDN first:
   ```typescript
   const imageUrl = await client.uploadImage(localImageBuffer, 'jpeg');
   ```

3. **Handle rate limits**: Configure exponential backoff for retries:
   ```typescript
   const client = createHiggsfieldClient({
     credentials: 'YOUR_KEY_ID:YOUR_KEY_SECRET',
     maxRetries: 5,
     retryBackoff: 2000,
     retryMaxBackoff: 30000
   });
   ```

4. **Use webhooks for long operations**: For production, consider implementing webhooks instead of polling to reduce server load.

5. **Cache motion and style IDs**: Fetch and cache available motions/styles at startup:
   ```typescript
   const motions = await client.getMotions();
   const styles = await client.getSoulStyles();
   const motionMap = new Map(motions.map(m => [m.id, m]));
   const styleMap = new Map(styles.map(s => [s.id, s]));
   ```

6. **Environment variables**: Store credentials in environment variables for security:
   ```bash
   export HF_CREDENTIALS="YOUR_KEY_ID:YOUR_KEY_SECRET"
   ```

---

## Support

- Documentation: https://docs.higgsfield.ai
- API Status: https://status.higgsfield.ai

## License

MIT
