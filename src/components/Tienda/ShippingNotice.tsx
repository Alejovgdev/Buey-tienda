import type { IconType } from 'react-icons';
import { TbCalendarCheck, TbClockHour4, TbMapPin } from 'react-icons/tb';
import { SHIPPING_INFO } from '@/lib/shipping';

type ShippingNoticeVariant = 'full' | 'compact';

interface ShippingNoticeProps {
  variant?: ShippingNoticeVariant;
  className?: string;
}

const shippingItems: Array<{
  icon: IconType;
  title: string;
  text: string;
}> = [
  { icon: TbMapPin, ...SHIPPING_INFO.area },
  { icon: TbClockHour4, ...SHIPPING_INFO.eta },
  { icon: TbCalendarCheck, ...SHIPPING_INFO.days },
];

export default function ShippingNotice({
  variant = 'full',
  className = '',
}: ShippingNoticeProps) {
  const isCompact = variant === 'compact';

  return (
    <section
      aria-label="Información de envíos"
      className={[
        'rounded-2xl border border-amber-500/20 bg-amber-500/[0.08]',
        isCompact ? 'p-4' : 'p-4 md:p-5',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className={isCompact ? 'space-y-3' : 'grid gap-4 sm:grid-cols-3'}>
        {shippingItems.map((item) => {
          const Icon = item.icon;

          return (
            <div key={item.title} className="flex gap-3">
              <span
                aria-hidden="true"
                className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-amber-400/25 bg-black/25 text-amber-300"
              >
                <Icon className="text-xl" />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">{item.title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-white/65">{item.text}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
