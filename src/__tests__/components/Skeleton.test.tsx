import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Skeleton, SkeletonText, SkeletonCard } from '@/components/Skeleton';

describe('Skeleton', () => {
  it('renders with default props', () => {
    const { container } = render(<Skeleton />);
    const skeleton = container.firstChild as HTMLElement;
    
    expect(skeleton).toHaveClass('animate-pulse');
    expect(skeleton).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders different variants', () => {
    const { container: text } = render(<Skeleton variant="text" />);
    const { container: circular } = render(<Skeleton variant="circular" />);
    
    expect(text.firstChild).toHaveClass('rounded');
    expect(circular.firstChild).toHaveClass('rounded-full');
  });
});
