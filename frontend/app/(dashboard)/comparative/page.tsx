import { PageHeader } from '@/components/PageHeader';

export default function ComparativePage() {
  return (
    <div className="p-6">
      <PageHeader
        title="Comparativa"
        subtitle="Comparación entre ciclos y períodos"
      />
      <div className="mt-8 p-8 bg-white rounded-xl border border-slate-200 text-center">
        <p className="text-slate-500 text-sm">Coming soon — análisis comparativo</p>
      </div>
    </div>
  );
}
