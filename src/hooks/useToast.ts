import { useCallback } from 'react';
import toast from 'react-hot-toast';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  duration?: number;
  position?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
}

const defaultOptions: ToastOptions = {
  duration: 4000,
  position: 'bottom-right',
};

/**
 * Hook for displaying toast notifications
 */
export function useToast() {
  const show = useCallback((
    message: string,
    type: ToastType = 'info',
    options: ToastOptions = {}
  ) => {
    const mergedOptions = { ...defaultOptions, ...options };

    switch (type) {
      case 'success':
        return toast.success(message, mergedOptions);
      case 'error':
        return toast.error(message, mergedOptions);
      case 'warning':
        return toast(message, {
          ...mergedOptions,
          icon: '⚠️',
          style: {
            background: '#fef3c7',
            color: '#92400e',
          },
        });
      case 'info':
      default:
        return toast(message, {
          ...mergedOptions,
          icon: 'ℹ️',
          style: {
            background: '#dbeafe',
            color: '#1e40af',
          },
        });
    }
  }, []);

  const dismiss = useCallback((toastId?: string) => {
    if (toastId) {
      toast.dismiss(toastId);
    } else {
      toast.dismiss();
    }
  }, []);

  const loading = useCallback((message: string, options?: ToastOptions) => {
    return toast.loading(message, { ...defaultOptions, ...options });
  }, []);

  const promise = useCallback(<T,>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string;
      error: string;
    },
    options?: ToastOptions
  ) => {
    return toast.promise(
      promise,
      {
        loading: messages.loading,
        success: messages.success,
        error: messages.error,
      },
      { ...defaultOptions, ...options }
    );
  }, []);

  return {
    show,
    dismiss,
    loading,
    promise,
    success: (message: string, options?: ToastOptions) => show(message, 'success', options),
    error: (message: string, options?: ToastOptions) => show(message, 'error', options),
    warning: (message: string, options?: ToastOptions) => show(message, 'warning', options),
    info: (message: string, options?: ToastOptions) => show(message, 'info', options),
  };
}

export default useToast;
