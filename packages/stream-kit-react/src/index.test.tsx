import { describe, it, expect } from 'vitest';
import { StreamProvider, StreamCanvas } from './index';

describe('stream-kit-react', () => {
  it('should export expected components and context', () => {
    expect(typeof StreamProvider).toBe('object');
    expect(typeof StreamCanvas).toBe('object');
  });
}); 