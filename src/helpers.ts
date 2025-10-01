import { BadInputError } from './errors';

/**
 * Helper class for creating image input references
 */
export class InputImage {
    /**
     * Creates an image reference from a URL
     * @param url - The URL of the image
     * @returns An object with image_url type and the provided URL
     * @throws BadInputError if URL is empty or invalid
     * @example
     * const imageRef = InputImage.fromUrl('https://example.com/image.jpg');
     */
    static fromUrl(url: string) {
        if (!url || typeof url !== 'string' || url.trim() === '') {
            throw new BadInputError('Image URL must be a non-empty string');
        }
        return {
            type: 'image_url',
            image_url: url
        }
    }
}

/**
 * Helper class for creating audio input references
 */
export class InputAudio {
    /**
     * Creates an audio reference from a URL
     * @param url - The URL of the audio file (must be WAV format)
     * @returns An object with audio_url type and the provided URL
     * @throws BadInputError if URL is empty or invalid
     * @example
     * const audioRef = InputAudio.fromUrl('https://example.com/audio.wav');
     */
    static fromUrl(url: string) {
        if (!url || typeof url !== 'string' || url.trim() === '') {
            throw new BadInputError('Audio URL must be a non-empty string');
        }
        return {
            type: 'audio_url',
            audio_url: url
        }
    }
}

/**
 * Creates a motion input object for video generation
 * @param motionId - The UUID of the motion from getMotions()
 * @param inputStrength - The strength of the motion effect (0.0 to 1.0), defaults to 1.0
 * @returns A motion object with validated strength
 * @throws BadInputError if motionId is empty or strength is invalid
 * @example
 * const motion = inputMotion('motion-uuid-123', 0.8);
 */
export function inputMotion(motionId: string, inputStrength: number = 1.0) {
    if (!motionId || typeof motionId !== 'string' || motionId.trim() === '') {
        throw new BadInputError('Motion ID must be a non-empty string');
    }
    return {
        id: motionId,
        strength: strength(inputStrength)
    }
}

type Quality = '720p' | '1080p'

/**
 * Validates and returns a Soul quality setting
 * @param quality - The quality setting ('720p' or '1080p')
 * @returns The validated quality string
 * @example
 * const quality = soulQuality('1080p');
 */
export function soulQuality(quality: Quality): string {
    return quality
}

/**
 * Batch size options for Soul image generation
 * @example
 * batch_size: BatchSize.SINGLE // Generate 1 image
 * batch_size: BatchSize.QUAD   // Generate 4 images
 */
export const BatchSize = {
    /** Generate a single image */
    SINGLE: 1,
    /** Generate 4 images in one request */
    QUAD: 4
} as const;

/**
 * Acceptable image sizes for Soul text-to-image generation
 * All 13 supported resolutions categorized by aspect ratio
 * @example
 * width_and_height: SoulSize.LANDSCAPE_2048x1152
 * width_and_height: SoulSize.PORTRAIT_1536x2048
 * width_and_height: SoulSize.SQUARE_1536x1536
 */
export const SoulSize = {
    // Landscape formats
    /** 2048x1152 - Wide landscape format */
    LANDSCAPE_2048x1152: '2048x1152',
    /** 2048x1536 - Standard landscape format */
    LANDSCAPE_2048x1536: '2048x1536',
    /** 2016x1344 - Medium landscape format */
    LANDSCAPE_2016x1344: '2016x1344',
    /** 1696x960 - Compact landscape format */
    LANDSCAPE_1696x960: '1696x960',
    /** 1632x1088 - Small landscape format */
    LANDSCAPE_1632x1088: '1632x1088',
    // Portrait formats
    /** 1152x2048 - Tall portrait format */
    PORTRAIT_1152x2048: '1152x2048',
    /** 1536x2048 - Standard portrait format */
    PORTRAIT_1536x2048: '1536x2048',
    /** 1344x2016 - Medium portrait format */
    PORTRAIT_1344x2016: '1344x2016',
    /** 960x1696 - Compact portrait format */
    PORTRAIT_960x1696: '960x1696',
    /** 1088x1632 - Small portrait format */
    PORTRAIT_1088x1632: '1088x1632',
    // Square and mixed formats
    /** 1536x1536 - Square format */
    SQUARE_1536x1536: '1536x1536',
    /** 1536x1152 - Mixed landscape-leaning format */
    MIXED_1536x1152: '1536x1152',
    /** 1152x1536 - Mixed portrait-leaning format */
    MIXED_1152x1536: '1152x1536'
} as const;

/**
 * DoP (Director of Photography) model options for image-to-video generation
 * @example
 * model: DoPModel.TURBO // Fast generation with good quality
 * model: DoPModel.STANDARD // Best quality
 */
export const DoPModel = {
    /** Basic speed and quality */
    LITE: 'dop-lite',
    /** 2x speed with priority queue */
    TURBO: 'dop-turbo',
    /** Highest quality with priority queue */
    STANDARD: 'dop-standard'
} as const;

/**
 * Quality options for Speak speech-to-video generation
 * @example
 * quality: SpeakQuality.HIGH // Best quality output
 */
export const SpeakQuality = {
    /** Medium quality - faster generation */
    MID: 'mid',
    /** High quality - best results */
    HIGH: 'high'
} as const;

/**
 * Duration options for Speak speech-to-video generation (in seconds)
 * @example
 * duration: SpeakDuration.MEDIUM // 10 second video
 */
export const SpeakDuration = {
    /** 5 second video */
    SHORT: 5,
    /** 10 second video */
    MEDIUM: 10,
    /** 15 second video */
    LONG: 15
} as const;

/**
 * Creates a webhook configuration object
 * @param url - The webhook endpoint URL
 * @param secret - The secret key for webhook authentication (sent as X-Webhook-Secret-Key header)
 * @returns A webhook configuration object
 * @throws BadInputError if URL or secret is empty
 * @example
 * const webhookConfig = webhook('https://api.example.com/callback', 'my-secret-key');
 */
export function webhook(url: string, secret: string) {
    if (!url || typeof url !== 'string' || url.trim() === '') {
        throw new BadInputError('Webhook URL must be a non-empty string');
    }
    if (!secret || typeof secret !== 'string' || secret.trim() === '') {
        throw new BadInputError('Webhook secret must be a non-empty string');
    }
    return {
        url,
        secret
    };
}

/**
 * Validates and returns a strength value for image/style references
 * @param value - The strength value (must be between 0.0 and 1.0)
 * @returns The validated strength value
 * @throws BadInputError if value is not between 0 and 1
 * @example
 * const validStrength = strength(0.8); // Returns 0.8
 * const invalidStrength = strength(1.5); // Throws BadInputError
 */
export function strength(value: number): number {
    if (value < 0 || value > 1) {
        throw new BadInputError('Strength must be between 0 and 1');
    }
    return value;
}

/**
 * Validates or generates a seed value for reproducible generation
 * @param value - The seed value (0 to 1,000,000) or null for random generation
 * @returns A valid seed number between 0 and 1,000,000
 * @throws BadInputError if value is not between 0 and 1,000,000
 * @example
 * const fixedSeed = seed(42); // Returns 42
 * const randomSeed = seed(null); // Returns random number between 0-1,000,000
 * const randomSeed2 = seed(); // Returns random number between 0-1,000,000
 */
export function seed(value: number | null = null): number {
    if (value === null) {
        // Generate random seed between 0 and 1,000,000
        return Math.floor(Math.random() * 1000001);
    }
    
    if (!Number.isInteger(value) || value < 0 || value > 1000000) {
        throw new BadInputError('Seed must be an integer between 0 and 1,000,000');
    }
    
    return value;
}
