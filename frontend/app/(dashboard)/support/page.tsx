import { PageHeader } from '@/components/PageHeader';

export default function SupportPage() {
  return (
    <div className="p-6">
      <PageHeader
        title="Soporte"
        subtitle="Tickets y métricas de soporte"
      />
      <div className="mt-8 p-8 bg-white rounded-xl border border-slate-200 text-center">
        <p className="text-slate-500 text-sm">Coming soon — métricas de soporte</p>
      </div>
    </div>
  );
}
