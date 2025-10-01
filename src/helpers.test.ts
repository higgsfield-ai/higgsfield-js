import {
  InputImage,
  InputAudio,
  inputMotion,
  soulQuality,
  SoulSize,
  BatchSize,
  DoPModel,
  SpeakQuality,
  SpeakDuration,
  webhook,
  strength,
  seed
} from './helpers';
import { BadInputError } from './errors';

describe('Helper Functions', () => {
  describe('InputImage', () => {
    it('should create image reference from valid URL', () => {
      const url = 'https://example.com/image.jpg';
      const result = InputImage.fromUrl(url);
      
      expect(result).toEqual({
        type: 'image_url',
        image_url: url
      });
    });

    it('should throw BadInputError for empty URL', () => {
      expect(() => InputImage.fromUrl('')).toThrow(BadInputError);
      expect(() => InputImage.fromUrl('')).toThrow('Image URL must be a non-empty string');
    });

    it('should throw BadInputError for whitespace-only URL', () => {
      expect(() => InputImage.fromUrl('   ')).toThrow(BadInputError);
    });
  });

  describe('InputAudio', () => {
    it('should create audio reference from valid URL', () => {
      const url = 'https://example.com/audio.wav';
      const result = InputAudio.fromUrl(url);
      
      expect(result).toEqual({
        type: 'audio_url',
        audio_url: url
      });
    });

    it('should throw BadInputError for empty URL', () => {
      expect(() => InputAudio.fromUrl('')).toThrow(BadInputError);
      expect(() => InputAudio.fromUrl('')).toThrow('Audio URL must be a non-empty string');
    });
  });

  describe('inputMotion', () => {
    it('should create motion object with valid inputs', () => {
      const motionId = 'motion-uuid-123';
      const motionStrength = 0.8;
      const result = inputMotion(motionId, motionStrength);
      
      expect(result).toEqual({
        id: motionId,
        strength: motionStrength
      });
    });

    it('should use default strength of 1.0', () => {
      const motionId = 'motion-uuid-123';
      const result = inputMotion(motionId);
      
      expect(result.strength).toBe(1.0);
    });

    it('should throw BadInputError for empty motion ID', () => {
      expect(() => inputMotion('')).toThrow(BadInputError);
      expect(() => inputMotion('')).toThrow('Motion ID must be a non-empty string');
    });

    it('should throw BadInputError for invalid strength', () => {
      expect(() => inputMotion('valid-id', 1.5)).toThrow(BadInputError);
      expect(() => inputMotion('valid-id', -0.1)).toThrow(BadInputError);
    });
  });

  describe('soulQuality', () => {
    it('should return valid quality strings', () => {
      expect(soulQuality('720p')).toBe('720p');
      expect(soulQuality('1080p')).toBe('1080p');
    });
  });

  describe('strength', () => {
    it('should return valid strength values', () => {
      expect(strength(0)).toBe(0);
      expect(strength(0.5)).toBe(0.5);
      expect(strength(1)).toBe(1);
    });

    it('should throw BadInputError for values outside 0-1 range', () => {
      expect(() => strength(-0.1)).toThrow(BadInputError);
      expect(() => strength(1.1)).toThrow(BadInputError);
      expect(() => strength(-1)).toThrow(BadInputError);
      expect(() => strength(2)).toThrow(BadInputError);
    });
  });

  describe('seed', () => {
    it('should return the same seed when provided', () => {
      expect(seed(42)).toBe(42);
      expect(seed(0)).toBe(0);
      expect(seed(1000000)).toBe(1000000);
    });

    it('should generate random seed when null or undefined', () => {
      const randomSeed1 = seed(null);
      const randomSeed2 = seed();
      
      expect(randomSeed1).toBeGreaterThanOrEqual(0);
      expect(randomSeed1).toBeLessThanOrEqual(1000000);
      expect(Number.isInteger(randomSeed1)).toBe(true);
      
      expect(randomSeed2).toBeGreaterThanOrEqual(0);
      expect(randomSeed2).toBeLessThanOrEqual(1000000);
      expect(Number.isInteger(randomSeed2)).toBe(true);
    });

    it('should throw BadInputError for invalid seeds', () => {
      expect(() => seed(-1)).toThrow(BadInputError);
      expect(() => seed(1000001)).toThrow(BadInputError);
      expect(() => seed(3.14)).toThrow(BadInputError);
      expect(() => seed(NaN)).toThrow(BadInputError);
    });
  });

  describe('webhook', () => {
    it('should create webhook configuration with valid inputs', () => {
      const url = 'https://api.example.com/webhook';
      const secret = 'my-secret-key';
      const result = webhook(url, secret);
      
      expect(result).toEqual({ url, secret });
    });

    it('should throw BadInputError for empty URL', () => {
      expect(() => webhook('', 'secret')).toThrow(BadInputError);
      expect(() => webhook('', 'secret')).toThrow('Webhook URL must be a non-empty string');
    });

    it('should throw BadInputError for empty secret', () => {
      expect(() => webhook('https://example.com', '')).toThrow(BadInputError);
      expect(() => webhook('https://example.com', '')).toThrow('Webhook secret must be a non-empty string');
    });
  });

  describe('Constants', () => {
    it('should have correct BatchSize values', () => {
      expect(BatchSize.SINGLE).toBe(1);
      expect(BatchSize.QUAD).toBe(4);
    });

    it('should have correct DoPModel values', () => {
      expect(DoPModel.LITE).toBe('dop-lite');
      expect(DoPModel.TURBO).toBe('dop-turbo');
      expect(DoPModel.STANDARD).toBe('dop-standard');
    });

    it('should have correct SpeakQuality values', () => {
      expect(SpeakQuality.MID).toBe('mid');
      expect(SpeakQuality.HIGH).toBe('high');
    });

    it('should have correct SpeakDuration values', () => {
      expect(SpeakDuration.SHORT).toBe(5);
      expect(SpeakDuration.MEDIUM).toBe(10);
      expect(SpeakDuration.LONG).toBe(15);
    });

    it('should have all 13 SoulSize values', () => {
      const soulSizes = Object.values(SoulSize);
      expect(soulSizes).toHaveLength(13);
      
      // Test specific sizes
      expect(SoulSize.LANDSCAPE_2048x1152).toBe('2048x1152');
      expect(SoulSize.PORTRAIT_1536x2048).toBe('1536x2048');
      expect(SoulSize.SQUARE_1536x1536).toBe('1536x1536');
    });
  });
});