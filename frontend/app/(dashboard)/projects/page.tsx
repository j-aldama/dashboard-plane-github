import { PageHeader } from '@/components/PageHeader';

export default function ProjectsPage() {
  return (
    <div className="p-6">
      <PageHeader
        title="Proyectos"
        subtitle="Estado y métricas por proyecto"
      />
      <div className="mt-8 p-8 bg-white rounded-xl border border-slate-200 text-center">
        <p className="text-slate-500 text-sm">Coming soon — métricas de proyectos</p>
      </div>
    </div>
  );
}
