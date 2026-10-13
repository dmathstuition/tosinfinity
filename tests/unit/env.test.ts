import { describe, expect, it } from 'vitest';
import { normaliseSiteUrl } from '@/lib/env';

describe('site URL', () => {
  it('accepts a host name without a scheme (the mistake that broke the first Vercel build)', () => {
    expect(normaliseSiteUrl('tosinfinity.vercel.app')).toBe('https://tosinfinity.vercel.app');
    expect(() => new URL(normaliseSiteUrl('tosinfinity.vercel.app'))).not.toThrow();
  });
  it('strips trailing slashes, paths and spaces', () => {
    expect(normaliseSiteUrl(' https://www.example.com/ ')).toBe('https://www.example.com');
    expect(normaliseSiteUrl('https://www.example.com/some/page')).toBe('https://www.example.com');
  });
  it('keeps http for local development and falls back when unset or unusable', () => {
    expect(normaliseSiteUrl('localhost:3000')).toBe('http://localhost:3000');
    expect(normaliseSiteUrl('http://localhost:3000')).toBe('http://localhost:3000');
    expect(normaliseSiteUrl(undefined)).toBe('http://localhost:3000');
    expect(normaliseSiteUrl('')).toBe('http://localhost:3000');
    expect(normaliseSiteUrl('http://')).toBe('http://localhost:3000');
  });
});
