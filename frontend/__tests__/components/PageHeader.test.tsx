import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageHeader } from '@/components/PageHeader';

describe('PageHeader', () => {
  it('renderiza el titulo', () => {
    render(<PageHeader title="Overview" />);

    expect(screen.getByText('Overview')).toBeInTheDocument();
  });

  it('renderiza el titulo como h2', () => {
    render(<PageHeader title="Overview" />);

    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toHaveTextContent('Overview');
  });

  it('renderiza el subtitulo cuando se proporciona', () => {
    render(
      <PageHeader
        title="Overview"
        subtitle="Resumen de metricas del equipo"
      />,
    );

    expect(screen.getByText('Resumen de metricas del equipo')).toBeInTheDocument();
  });

  it('no renderiza subtitulo cuando no se proporciona', () => {
    const { container } = render(<PageHeader title="Overview" />);

    const subtitle = container.querySelector('.text-sm.text-slate-500');
    expect(subtitle).toBeNull();
  });

  it('renderiza children como acciones', () => {
    render(
      <PageHeader title="Proyectos">
        <button data-testid="action-btn">Sincronizar</button>
      </PageHeader>,
    );

    expect(screen.getByTestId('action-btn')).toBeInTheDocument();
    expect(screen.getByText('Sincronizar')).toBeInTheDocument();
  });

  it('no renderiza seccion de acciones cuando no hay children', () => {
    const { container } = render(<PageHeader title="Test" />);

    const actionsContainer = container.querySelector('.flex.items-center.gap-3');
    expect(actionsContainer).toBeNull();
  });

  it('renderiza titulo, subtitulo y acciones juntos', () => {
    render(
      <PageHeader title="Dashboard" subtitle="Vista general">
        <button>Exportar</button>
        <button>Filtrar</button>
      </PageHeader>,
    );

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Vista general')).toBeInTheDocument();
    expect(screen.getByText('Exportar')).toBeInTheDocument();
    expect(screen.getByText('Filtrar')).toBeInTheDocument();
  });
});
