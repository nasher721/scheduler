import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import toast from 'react-hot-toast';
import { useToast } from '@/hooks/useToast';

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    promise: vi.fn(),
    dismiss: vi.fn(),
  },
}));

describe('useToast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show success toast', () => {
    const { result } = renderHook(() => useToast());
    result.current.success('Operation successful');
    
    expect(toast.success).toHaveBeenCalledWith('Operation successful', {
      duration: 4000,
      position: 'bottom-right',
    });
  });

  it('should show error toast', () => {
    const { result } = renderHook(() => useToast());
    result.current.error('Something went wrong');
    
    expect(toast.error).toHaveBeenCalledWith('Something went wrong', {
      duration: 4000,
      position: 'bottom-right',
    });
  });

  it('should allow custom options to override defaults', () => {
    const { result } = renderHook(() => useToast());
    result.current.success('Success', { duration: 2000, position: 'top-center' });
    
    expect(toast.success).toHaveBeenCalledWith('Success', {
      duration: 2000,
      position: 'top-center',
    });
  });
});
