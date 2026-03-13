import { describe, it, expect } from 'vitest';
import { createStreamClient } from './index';

describe('stream-kit-web', () => {
  it('should pass placeholder test', () => {
    // Basic check that function exists
    expect(typeof createStreamClient).toBe('function');
    expect(true).toBe(true);
  });
}); 