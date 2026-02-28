import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Skeleton, MetricCardSkeleton, TableSkeleton } from '@/components/Skeleton';

describe('Skeleton', () => {
  it('renderiza un elemento por defecto', () => {
    const { container } = render(<Skeleton />);

    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons).toHaveLength(1);
  });

  it('renderiza multiples elementos segun count', () => {
    const { container } = render(<Skeleton count={3} />);

    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons).toHaveLength(3);
  });

  it('aplica className personalizado', () => {
    const { container } = render(<Skeleton className="h-4 w-24" />);

    const skeleton = container.querySelector('.animate-pulse');
    expect(skeleton).toHaveClass('h-4');
    expect(skeleton).toHaveClass('w-24');
  });

  it('tiene aria-hidden para accesibilidad', () => {
    const { container } = render(<Skeleton />);

    const skeleton = container.querySelector('.animate-pulse');
    expect(skeleton).toHaveAttribute('aria-hidden', 'true');
  });

  it('tiene clases base (bg-slate-200, rounded)', () => {
    const { container } = render(<Skeleton />);

    const skeleton = container.querySelector('.animate-pulse');
    expect(skeleton).toHaveClass('bg-slate-200');
    expect(skeleton).toHaveClass('rounded');
  });
});

describe('MetricCardSkeleton', () => {
  it('renderiza estructura de card', () => {
    const { container } = render(<MetricCardSkeleton />);

    const card = container.querySelector('.card');
    expect(card).toBeInTheDocument();
  });

  it('contiene elementos animate-pulse', () => {
    const { container } = render(<MetricCardSkeleton />);

    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});

describe('TableSkeleton', () => {
  it('renderiza con valores por defecto (5 filas, 4 columnas)', () => {
    const { container } = render(<TableSkeleton />);

    const card = container.querySelector('.card');
    expect(card).toBeInTheDocument();

    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renderiza con filas y columnas personalizadas', () => {
    const { container } = render(<TableSkeleton rows={3} cols={2} />);

    const card = container.querySelector('.card');
    expect(card).toBeInTheDocument();

    // Header row + 3 data rows
    const rowDivs = container.querySelectorAll('.border-b');
    expect(rowDivs.length).toBeGreaterThanOrEqual(3);
  });

  it('tiene estructura de header con bg-slate-50', () => {
    const { container } = render(<TableSkeleton />);

    const header = container.querySelector('.bg-slate-50');
    expect(header).toBeInTheDocument();
  });
});
