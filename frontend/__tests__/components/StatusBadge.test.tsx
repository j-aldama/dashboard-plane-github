import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '@/components/StatusBadge';

describe('StatusBadge', () => {
  it('renderiza el label', () => {
    render(<StatusBadge label="Activo" />);

    expect(screen.getByText('Activo')).toBeInTheDocument();
  });

  it('usa variant neutral por defecto', () => {
    render(<StatusBadge label="Default" />);

    const badge = screen.getByText('Default');
    expect(badge).toHaveClass('bg-slate-100');
    expect(badge).toHaveClass('text-slate-600');
  });

  it('renderiza variant success con colores emerald', () => {
    render(<StatusBadge label="Completado" variant="success" />);

    const badge = screen.getByText('Completado');
    expect(badge).toHaveClass('bg-emerald-100');
    expect(badge).toHaveClass('text-emerald-700');
  });

  it('renderiza variant warning con colores amber', () => {
    render(<StatusBadge label="Advertencia" variant="warning" />);

    const badge = screen.getByText('Advertencia');
    expect(badge).toHaveClass('bg-amber-100');
    expect(badge).toHaveClass('text-amber-700');
  });

  it('renderiza variant error con colores red', () => {
    render(<StatusBadge label="Error" variant="error" />);

    const badge = screen.getByText('Error');
    expect(badge).toHaveClass('bg-red-100');
    expect(badge).toHaveClass('text-red-700');
  });

  it('renderiza variant info con colores blue', () => {
    render(<StatusBadge label="Info" variant="info" />);

    const badge = screen.getByText('Info');
    expect(badge).toHaveClass('bg-blue-100');
    expect(badge).toHaveClass('text-blue-700');
  });

  it('renderiza variant pending con colores slate claros', () => {
    render(<StatusBadge label="Pendiente" variant="pending" />);

    const badge = screen.getByText('Pendiente');
    expect(badge).toHaveClass('bg-slate-100');
    expect(badge).toHaveClass('text-slate-500');
  });

  it('renderiza variant in-progress con colores blue', () => {
    render(<StatusBadge label="En progreso" variant="in-progress" />);

    const badge = screen.getByText('En progreso');
    expect(badge).toHaveClass('bg-blue-100');
    expect(badge).toHaveClass('text-blue-700');
  });

  it('renderiza variant done con colores emerald', () => {
    render(<StatusBadge label="Hecho" variant="done" />);

    const badge = screen.getByText('Hecho');
    expect(badge).toHaveClass('bg-emerald-100');
    expect(badge).toHaveClass('text-emerald-700');
  });

  it('renderiza variant cancelled con line-through', () => {
    render(<StatusBadge label="Cancelado" variant="cancelled" />);

    const badge = screen.getByText('Cancelado');
    expect(badge).toHaveClass('line-through');
    expect(badge).toHaveClass('bg-slate-100');
    expect(badge).toHaveClass('text-slate-400');
  });

  it('tiene clases base de badge (rounded-full, text-xs)', () => {
    render(<StatusBadge label="Test" />);

    const badge = screen.getByText('Test');
    expect(badge).toHaveClass('rounded-full');
    expect(badge).toHaveClass('text-xs');
    expect(badge).toHaveClass('font-medium');
  });
});
