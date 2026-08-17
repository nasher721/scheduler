import { describe, it, expect } from 'vitest';
import { queryClient } from '@/lib/queryClient';

describe('queryClient', () => {
  it('is a QueryClient singleton with configured defaults', () => {
    expect(queryClient).toBeDefined();
    expect(queryClient.getDefaultOptions().queries).toMatchObject({
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    });
    expect(queryClient.getDefaultOptions().mutations).toMatchObject({
      retry: 0,
    });
  });
});
