import { Config } from './config';

describe('Config', () => {
  it('uses the public API host by default while allowing overrides', () => {
    expect(new Config().baseURL).toBe('https://api.higgsfield.ai');
    expect(new Config({ baseURL: 'https://custom.example' }).baseURL).toBe(
      'https://custom.example'
    );
  });
});
