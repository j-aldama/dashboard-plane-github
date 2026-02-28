import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataTable, TableColumn } from '@/components/DataTable';

interface TestRow extends Record<string, unknown> {
  name: string;
  score: number;
  status: string;
}

const columns: TableColumn<TestRow>[] = [
  { key: 'name', label: 'Nombre', sortable: true },
  { key: 'score', label: 'Puntaje', sortable: true },
  { key: 'status', label: 'Estado' },
];

const testData: TestRow[] = [
  { name: 'Alice', score: 90, status: 'activo' },
  { name: 'Bob', score: 75, status: 'inactivo' },
  { name: 'Carol', score: 85, status: 'activo' },
];

describe('DataTable', () => {
  it('renderiza los encabezados de columna', () => {
    render(<DataTable columns={columns} data={testData} />);

    expect(screen.getByText('Nombre')).toBeInTheDocument();
    expect(screen.getByText('Puntaje')).toBeInTheDocument();
    expect(screen.getByText('Estado')).toBeInTheDocument();
  });

  it('renderiza todas las filas de datos', () => {
    render(<DataTable columns={columns} data={testData} />);

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Carol')).toBeInTheDocument();
    expect(screen.getByText('90')).toBeInTheDocument();
    expect(screen.getByText('75')).toBeInTheDocument();
    expect(screen.getByText('85')).toBeInTheDocument();
  });

  it('muestra mensaje de vacio cuando no hay datos', () => {
    render(<DataTable columns={columns} data={[]} />);

    expect(screen.getByText('No hay datos disponibles')).toBeInTheDocument();
  });

  it('muestra mensaje personalizado de vacio', () => {
    render(
      <DataTable
        columns={columns}
        data={[]}
        emptyMessage="Sin resultados para el filtro seleccionado"
      />,
    );

    expect(
      screen.getByText('Sin resultados para el filtro seleccionado'),
    ).toBeInTheDocument();
  });

  it('renderiza skeleton cuando isLoading es true', () => {
    const { container } = render(
      <DataTable columns={columns} data={[]} isLoading />,
    );

    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('muestra indicador de ordenamiento en columnas sortable', () => {
    render(<DataTable columns={columns} data={testData} />);

    // Sortable columns should show the sort indicator
    const sortIndicators = screen.getAllByText(/[↕↑↓]/);
    // name and score are sortable, status is not
    expect(sortIndicators.length).toBeGreaterThanOrEqual(2);
  });

  it('llama a onSort al hacer click en columna sortable', async () => {
    const user = userEvent.setup();
    const onSort = vi.fn();

    render(
      <DataTable columns={columns} data={testData} onSort={onSort} />,
    );

    await user.click(screen.getByText('Nombre'));

    expect(onSort).toHaveBeenCalledWith('name', 'asc');
  });

  it('alterna direccion de ordenamiento al hacer click repetido', async () => {
    const user = userEvent.setup();
    const onSort = vi.fn();

    render(
      <DataTable columns={columns} data={testData} onSort={onSort} />,
    );

    // First click: asc
    await user.click(screen.getByText('Nombre'));
    expect(onSort).toHaveBeenCalledWith('name', 'asc');

    // Second click on same column: desc
    await user.click(screen.getByText('Nombre'));
    expect(onSort).toHaveBeenCalledWith('name', 'desc');
  });

  it('no llama a onSort en columna no sortable', async () => {
    const user = userEvent.setup();
    const onSort = vi.fn();

    render(
      <DataTable columns={columns} data={testData} onSort={onSort} />,
    );

    await user.click(screen.getByText('Estado'));

    expect(onSort).not.toHaveBeenCalled();
  });

  it('renderiza con render personalizado de columna', () => {
    const customColumns: TableColumn<TestRow>[] = [
      {
        key: 'name',
        label: 'Nombre',
        render: (value) => <strong data-testid="custom-render">{String(value)}</strong>,
      },
      { key: 'score', label: 'Puntaje' },
    ];

    render(<DataTable columns={customColumns} data={testData} />);

    const customElements = screen.getAllByTestId('custom-render');
    expect(customElements).toHaveLength(3);
    expect(customElements[0]).toHaveTextContent('Alice');
  });
});
