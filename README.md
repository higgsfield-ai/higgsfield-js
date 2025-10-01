# Higgsfield SDK for Node.js and TypeScript

Official SDK for interacting with Higgsfield AI's video and image generation APIs.

## Installation

```bash
npm install @higgsfield/client
```

## Quick Start

```typescript
import { HiggsfieldClient } from '@higgsfield/client';
import { InputImage, InputAudio, inputMotion, soulQuality, SoulSize, BatchSize, DoPModel, SpeakQuality, SpeakDuration, webhook, strength, seed } from '@higgsfield/client/helpers';

// Initialize the client
const client = new HiggsfieldClient({
  apiKey: 'YOUR_API_KEY',
  apiSecret: 'YOUR_API_SECRET'
});
```

## Authentication

The SDK supports multiple authentication methods:

### Option 1: Pass credentials directly

```typescript
const client = new HiggsfieldClient({
  apiKey: 'YOUR_API_KEY',
  apiSecret: 'YOUR_API_SECRET'
});
```

### Option 2: Use environment variables

Set the following environment variables:
```bash
export HF_API_KEY="YOUR_API_KEY"
export HF_SECRET="YOUR_API_SECRET"
```

Then initialize without credentials:
```typescript
const client = new HiggsfieldClient();
```

## API Endpoints

### Image-to-Video Generation (DoP Model)

Generate 5-second videos from static images using the DoP (Director of Photography) model with optional motion presets.

#### Basic Usage (without motion)

```typescript
// Generate video from image (no motion applied)
const jobSet = await client.generate('/v1/image2video/dop', {
  model: DoPModel.TURBO, // Options: DoPModel.LITE, DoPModel.STANDARD, DoPModel.TURBO
  prompt: 'Cinematic camera movement around the subject',
  input_images: [InputImage.fromUrl('https://example.com/image.jpg')]
});

// The generate method automatically polls for completion by default
// Access results directly from jobSet.jobs
if (jobSet.isCompleted) {
  console.log('Video URL:', jobSet.jobs[0].results?.raw.url);
}
```

#### Using Predefined Motions

First, fetch available motions:

```typescript
// Get available motions (returns Motion[])
const motions: Motion[] = await client.getMotions();

// Motion type structure:
// {
//   id: string;
//   name: string;
//   description?: string;
//   preview_url?: string;
//   start_end_frame?: boolean;
// }

// Find a specific motion
const zoomMotion = motions.find(m => m.name === 'Zoom In');
console.log('Motion preview:', zoomMotion.preview_url);
console.log('Supports start/end frame:', zoomMotion.start_end_frame);
```

Then use a motion in your generation:

```typescript
// Generate video with specific motion
const jobSet = await client.generate('/v1/image2video/dop', {
  model: DoPModel.TURBO,
  prompt: 'Apply zoom motion to the subject',
  input_images: [InputImage.fromUrl('https://example.com/image.jpg')],
  motions: [
    inputMotion(zoomMotion.id, 0.8) // Motion UUID from getMotions() with strength (0.0 to 1.0)
  ]
});

// Check completion status
if (jobSet.isCompleted) {
  console.log('Video generated successfully');
  console.log('Video URL:', jobSet.jobs[0].results?.raw.url);
}
```

#### Advanced Example with Upload

```typescript
import fs from 'fs';

// Read local image
const imageBuffer = fs.readFileSync('path/to/your/image.jpg');

// Upload image to Higgsfield CDN
const imageUrl = await client.uploadImage(imageBuffer, 'jpeg');

// Generate video with multiple motions and webhook
const jobSet = await client.generate('/v1/image2video/dop', {
  model: DoPModel.STANDARD, // Highest quality model
  prompt: 'Cinematic dolly zoom with dramatic lighting',
  input_images: [InputImage.fromUrl(imageUrl)],
  motions: [
    inputMotion('motion-uuid-1', 0.7),
    inputMotion('motion-uuid-2', 0.5)
  ], // Can have up to 2 motions
  seed: seed(42), // For reproducible results
  enhance_prompt: true // AI-enhanced prompt
}, {
  webhook: webhook('https://your-webhook-url.com/callback', 'your-webhook-secret')
});

// Handle results (polling happens automatically)
for (const job of jobSet.jobs) {
  if (job.status === 'completed') {
    console.log('Video URL:', job.results?.raw.url);
    console.log('Preview URL:', job.results?.min.url);
  } else if (job.status === 'failed') {
    console.error('Job failed');
  }
}
```

### Speech-to-Video Generation (Speak v2)

Generate videos with talking avatars from audio input. **Note: Only WAV audio files are supported.**

#### Basic Usage

```typescript
// Generate talking avatar video from audio and image
// Note: Audio must be in WAV format
const jobSet = await client.generate('/v1/speak/higgsfield', {
  params: {
    input_image: InputImage.fromUrl('https://example.com/avatar.jpg'),
    input_audio: InputAudio.fromUrl('https://example.com/speech.wav'), // Only WAV files supported
    prompt: 'Professional presentation style',
    quality: SpeakQuality.MID, // Options: SpeakQuality.MID or SpeakQuality.HIGH
    duration: SpeakDuration.SHORT, // Options: SpeakDuration.SHORT (5s), MEDIUM (10s), or LONG (15s)
    seed: seed() // Random seed for varied results
  }
});

// Check results
if (jobSet.isCompleted) {
  console.log('Video URL:', jobSet.jobs[0].results?.raw.url);
}
```

### Text-to-Image Generation (Soul)

Generate artistic images from text descriptions using the Soul model.

#### Basic Usage

```typescript
// Generate image from text
const jobSet = await client.generate('/v1/text2image/soul', {
  prompt: 'A majestic mountain landscape at sunset, oil painting style',
  width_and_height: SoulSize.SQUARE_1536x1536, // See SoulSize for all 13 available sizes
  quality: soulQuality('720p'), // Options: '480p', '720p', '1080p'
  batch_size: BatchSize.SINGLE, // Options: BatchSize.SINGLE (1) or BatchSize.QUAD (4)
  enhance_prompt: true // AI-enhanced prompt optimization
});

// Access generated image
if (jobSet.isCompleted) {
  console.log('Image URL:', jobSet.jobs[0].results?.raw.url);
}
```

#### Using Style Presets

First, fetch available styles:

```typescript
// Get available Soul styles (returns SoulStyle[])
const styles: SoulStyle[] = await client.getSoulStyles();

// SoulStyle type structure:
// {
//   id: string;
//   name: string;
//   description: string;
//   preview_url: string;
// }

// Find a specific style
const oilPaintingStyle = styles.find(s => s.name === 'Oil Painting');
```

Then use a style in your generation:

```typescript
// Generate with specific style
const jobSet = await client.generate('/v1/text2image/soul', {
  params: {
    prompt: 'Portrait of a wise elderly person',
    style_id: oilPaintingStyle.id, // Use style from getSoulStyles()
    style_strength: strength(0.8), // Style intensity (0.0 to 1.0)
    width_and_height: SoulSize.PORTRAIT_1536x2048,
    quality: soulQuality('1080p'),
    batch_size: BatchSize.QUAD,
    enhance_prompt: false,
    seed: seed(12345) // For reproducible results
  }
});

// Get all generated images
jobSet.jobs.forEach((job, index) => {
  if (job.status === 'completed') {
    console.log(`Image ${index + 1}:`, job.results?.raw.url);
  }
});
```

#### Advanced Example with Parameters

```typescript
// Generate with advanced parameters and character consistency
const jobSet = await client.generate('/v1/text2image/soul', {
  params: {
    prompt: 'Futuristic city with flying cars, cyberpunk aesthetic',
    width_and_height: SoulSize.LANDSCAPE_2048x1152, // Landscape format
    quality: soulQuality('1080p'),
    batch_size: BatchSize.QUAD,
    style_id: 'cyberpunk-style-uuid', // From getSoulStyles()
    style_strength: strength(0.9),
    custom_reference_id: 'character-uuid', // Character from custom references
    custom_reference_strength: strength(0.7),
    image_reference: InputImage.fromUrl('https://example.com/reference.jpg'),
    enhance_prompt: true,
    seed: seed(999) // Fixed seed for consistency
  },
  webhook: webhook('https://your-webhook-url.com/callback', 'your-webhook-secret')
});

// Download generated images
for (const job of jobSet.jobs) {
  if (job.status === 'completed' && job.results) {
    console.log('Full resolution:', job.results.raw.url);
    console.log('Thumbnail:', job.results.min.url);
    
    // You can download the images
    const response = await fetch(job.results.raw.url);
    const buffer = await response.arrayBuffer();
    fs.writeFileSync(`output-${job.id}.jpg`, Buffer.from(buffer));
  }
}
```

## API Methods

### Core Methods

- `generate(endpoint: string, params: object, options?: { webhook?: WebhookPayload, withPolling?: boolean }): Promise<JobSet>` - Generate content using any Higgsfield API endpoint
- `getMotions(): Promise<Motion[]>` - Get available motions for image-to-video generation
- `getSoulStyles(): Promise<SoulStyle[]>` - Get available Soul styles for text-to-image generation
- `uploadImage(imageBuffer: Buffer, format?: 'jpeg' | 'png' | 'webp'): Promise<string>` - Upload an image and get its URL
- `upload(data: Buffer | Uint8Array, contentType: string): Promise<string>` - Upload any data with specific content type

## Working with Jobs

### Job Status Monitoring

```typescript
// Create a job without automatic polling
const jobSet = await client.generate('/v1/text2image/soul', {
  prompt: 'Beautiful landscape',
  width_and_height: '1536x1536'
}, {
  withPolling: false // Disable automatic polling
});

// Check status
console.log('JobSet ID:', jobSet.id);

// Manual polling (requires access to client's internal axios instance and config)
// Note: The client's internal properties are private, so this is for demonstration
// In practice, use withPolling: true (default) for automatic polling
while (!jobSet.isCompleted && !jobSet.isFailed && !jobSet.isCanceled) {
  // await jobSet.poll(axiosClient, configObject);
  console.log('Jobs status:', jobSet.jobs.map(j => j.status));
  await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
  break; // Exit for demo purposes
}

// Access results
for (const job of jobSet.jobs) {
  if (job.results) {
    console.log('Result:', job.results.raw.url);
  }
}
```

### Error Handling

```typescript
try {
  const jobSet = await client.generate('/v1/image2video/dop', {
    params: {
      model: DoPModel.TURBO,
      prompt: 'Dynamic camera movement',
      input_images: [InputImage.fromUrl('https://example.com/image.jpg')],
      motions: [inputMotion('motion-uuid', 0.8)]
    }
  });

  // The generate method polls automatically by default
  
  // Check for specific job failures
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
} catch (error) {
  if (error.name === 'AuthenticationError') {
    console.error('Invalid API credentials');
  } else if (error.name === 'APIError') {
    console.error('API Error:', error.statusCode, error.data);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Configuration Options

```typescript
const client = new HiggsfieldClient({
  // Authentication
  apiKey: 'YOUR_API_KEY',
  apiSecret: 'YOUR_API_SECRET',
  
  // API Configuration
  baseURL: 'https://platform.higgsfield.ai', // Default
  timeout: 120000, // 2 minutes default
  
  // Retry Configuration
  maxRetries: 3, // Maximum 5 retries allowed
  retryBackoff: 1000, // Start with 1 second
  retryMaxBackoff: 60000, // Max 60 seconds
  
  // Polling Configuration
  pollInterval: 2000, // Check every 2 seconds
  maxPollTime: 300000, // Timeout after 5 minutes
  
  // Custom Headers
  headers: {
    'X-Custom-Header': 'value'
  }
});
```

## TypeScript Support

The SDK is written in TypeScript and provides full type definitions:

```typescript
import { 
  HiggsfieldClient, 
  ClientConfig,
  JobStatus,
  JobSet,
  Job,
  GenerateParams,
  SoulStyle,
  Motion
} from '@higgsfield/client';

// All parameters are fully typed
const params: GenerateParams = {
  prompt: 'A beautiful sunset',
  width: 1024,
  height: 1024
};

// JobStatus enum for status checking
if (jobSet.isCompleted) {
  // All jobs completed
}
// Or check individual job status
if (jobSet.jobs[0].status === JobStatus.COMPLETED) {
  // Handle completed job
}
```

## Best Practices

1. **Upload large files**: For better performance, upload large image/audio files to the CDN first:
   ```typescript
   const imageUrl = await client.uploadImage(localImageBuffer, 'jpeg');
   ```

2. **Handle rate limits**: Implement exponential backoff for retries:
   ```typescript
   const client = new HiggsfieldClient({
     maxRetries: 5,
     retryBackoff: 2000,
     retryMaxBackoff: 30000
   });
   ```

3. **Use webhooks for long operations**: For production, consider implementing webhooks instead of polling.

4. **Cache motion and style IDs**: Fetch and cache available motions/styles at startup:
   ```typescript
   const motions = await client.getMotions();
   const styles = await client.getSoulStyles();
   
   // Cache these for reuse
   const motionMap = new Map(motions.map(m => [m.id, m]));
   const styleMap = new Map(styles.map(s => [s.id, s]));
   ```

5. **Clean up resources**: Always close the client when done:
   ```typescript
   client.close();
   ```

## Support

- Documentation: https://docs.higgsfield.ai
- API Status: https://status.higgsfield.ai

## License

MIT