import { PageHeader } from '@/components/PageHeader';

export default function PersonPage() {
  return (
    <div className="p-6">
      <PageHeader
        title="Personas"
        subtitle="Métricas individuales por miembro del equipo"
      />
      <div className="mt-8 p-8 bg-white rounded-xl border border-slate-200 text-center">
        <p className="text-slate-500 text-sm">Coming soon — métricas por persona</p>
      </div>
    </div>
  );
}
