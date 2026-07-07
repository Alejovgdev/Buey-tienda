import { formatAllergenLabel } from '@/lib/format-allergen';

interface AllergensBadgeProps {
  allergens: string[];
  allergensNotes?: string | null;
}

export default function AllergensBadge({ allergens, allergensNotes }: AllergensBadgeProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-white/60">Alérgenos</h3>

      {allergens.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {allergens.map((allergen) => (
            <li
              key={allergen}
              className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-sm font-medium text-amber-300"
            >
              {formatAllergenLabel(allergen)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-white/70">
          Sin alérgenos de declaración obligatoria.
        </p>
      )}

      {allergensNotes && <p className="mt-3 text-sm text-white/50">{allergensNotes}</p>}
    </div>
  );
}
