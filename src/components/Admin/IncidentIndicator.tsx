import type { IncidentSeverity } from '@/lib/admin/incidents';

// Fase 7, Unidad 4. Señal compacta para el listado — "de un vistazo, sin
// entrar al detalle". El texto completo va en el banner del detalle de
// pedido (ver IncidentBanner), aquí solo el aviso mínimo con tooltip.
const SEVERITY_CONFIG: Record<IncidentSeverity, { classes: string; icon: string; shortLabel: string; title: string }> = {
  critical: {
    classes: 'bg-red-600 text-white',
    icon: '⚠',
    shortLabel: 'Revisar pago',
    title: 'Importe incoherente — requiere revisión manual antes de dar el pedido por bueno',
  },
  action_required: {
    classes: 'bg-amber-500 text-white',
    icon: '🎁',
    shortLabel: 'Regalo pendiente',
    title: 'Acción obligatoria: hay que hacer llegar al cliente un regalo prometido que no había en stock',
  },
  info: {
    classes: 'bg-sky-100 text-sky-800',
    icon: 'ℹ',
    shortLabel: 'Regalo extra',
    title: 'Informativo: se entregó un regalo que no contó dentro del cupo oficial de la promoción',
  },
};

export default function IncidentIndicator({
  severity,
  className = '',
}: {
  severity: IncidentSeverity;
  className?: string;
}) {
  const config = SEVERITY_CONFIG[severity];

  return (
    <span
      title={config.title}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${config.classes} ${className}`}
    >
      <span aria-hidden="true">{config.icon}</span>
      {config.shortLabel}
    </span>
  );
}
