import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetricCard } from '@/components/MetricCard';

describe('MetricCard', () => {
  it('renderiza el titulo y el valor', () => {
    render(<MetricCard title="Total Tareas" value={150} />);

    expect(screen.getByText('Total Tareas')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();
  });

  it('renderiza el valor como string', () => {
    render(<MetricCard title="Tasa" value="85%" />);

    expect(screen.getByText('Tasa')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
  });

  it('renderiza el subtitulo cuando se proporciona', () => {
    render(<MetricCard title="Puntos" value={180} subtitle="de 300 totales" />);

    expect(screen.getByText('de 300 totales')).toBeInTheDocument();
  });

  it('no renderiza subtitulo cuando no se proporciona', () => {
    const { container } = render(<MetricCard title="Tareas" value={10} />);

    const subtitles = container.querySelectorAll('.text-xs.text-slate-400');
    expect(subtitles).toHaveLength(0);
  });

  it('renderiza el icono cuando se proporciona', () => {
    render(
      <MetricCard
        title="Bugs"
        value={12}
        icon={<span data-testid="test-icon">icon</span>}
      />,
    );

    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });

  it('renderiza cambio positivo con prefijo + y color emerald', () => {
    render(
      <MetricCard
        title="Tareas"
        value={95}
        change={15}
        changeType="positive"
      />,
    );

    const changeElement = screen.getByText(/\+15%.*anterior/);
    expect(changeElement).toBeInTheDocument();
    expect(changeElement).toHaveClass('text-emerald-600');
  });

  it('renderiza cambio negativo sin prefijo + y color rojo', () => {
    render(
      <MetricCard
        title="Tareas"
        value={80}
        change={-10}
        changeType="negative"
      />,
    );

    const changeElement = screen.getByText(/-10%.*anterior/);
    expect(changeElement).toBeInTheDocument();
    expect(changeElement).toHaveClass('text-red-500');
  });

  it('renderiza cambio neutral con color slate', () => {
    render(
      <MetricCard title="Tareas" value={80} change={0} changeType="neutral" />
    );

    const changeElement = screen.getByText(/0%.*anterior/);
    expect(changeElement).toBeInTheDocument();
    expect(changeElement).toHaveClass('text-slate-500');
  });

  it('no renderiza seccion de cambio cuando change es undefined', () => {
    const { container } = render(<MetricCard title="Tareas" value={80} />);

    // The change text contains "vs período anterior" - find elements with that text
    const changeElements = container.querySelectorAll('p');
    const hasChangeText = Array.from(changeElements).some(
      (el) => el.textContent?.includes('anterior'),
    );
    expect(hasChangeText).toBe(false);
  });
});
