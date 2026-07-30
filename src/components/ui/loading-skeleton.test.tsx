// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { LoadingSkeleton } from './loading-skeleton';

describe('LoadingSkeleton', () => {
  it('renders the specified number of skeleton rows', () => {
    const { container } = render(<LoadingSkeleton rows={3} />);
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons).toHaveLength(3);
  });

  it('applies className to each skeleton row', () => {
    const { container } = render(<LoadingSkeleton rows={2} className='rounded-full' />);
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons).toHaveLength(2);
    skeletons.forEach((el) => {
      expect(el.className).toContain('rounded-full');
      expect(el.className).toContain('h-12');
    });
  });

  it('accepts an array of classNames for per-row styling', () => {
    const { container } = render(<LoadingSkeleton rows={['h-10', 'h-96', 'h-10']} />);
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons).toHaveLength(3);
    expect(skeletons[0].className).toContain('h-10');
    expect(skeletons[1].className).toContain('h-96');
    expect(skeletons[2].className).toContain('h-10');
  });

  it('merges array classNames with the className prop', () => {
    const { container } = render(
      <LoadingSkeleton rows={['h-10', 'h-20']} className='rounded-lg' />
    );
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons[0].className).toContain('h-10');
    expect(skeletons[0].className).toContain('rounded-lg');
    expect(skeletons[1].className).toContain('h-20');
    expect(skeletons[1].className).toContain('rounded-lg');
  });
});
