import { PageHeader } from '@/components/PageHeader';

export default function GitHubPage() {
  return (
    <div className="p-6">
      <PageHeader
        title="GitHub"
        subtitle="Actividad y métricas de repositorios"
      />
      <div className="mt-8 p-8 bg-white rounded-xl border border-slate-200 text-center">
        <p className="text-slate-500 text-sm">Coming soon — métricas de GitHub</p>
      </div>
    </div>
  );
}
