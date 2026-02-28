import { PageHeader } from '@/components/PageHeader';

export default function SettingsPage() {
  return (
    <div className="p-6">
      <PageHeader
        title="Configuración"
        subtitle="Configuración del dashboard y preferencias"
      />
      <div className="mt-8 p-8 bg-white rounded-xl border border-slate-200 text-center">
        <p className="text-slate-500 text-sm">Coming soon — configuración del sistema</p>
      </div>
    </div>
  );
}
