import { ORDER_STATUS_BADGE_CLASSES, ORDER_STATUS_LABELS, isValidOrderStatus } from '@/lib/admin/order-status';

export default function OrderStatusBadge({ status }: { status: string }) {
  const label = isValidOrderStatus(status) ? ORDER_STATUS_LABELS[status] : status;
  const classes = isValidOrderStatus(status)
    ? ORDER_STATUS_BADGE_CLASSES[status]
    : 'bg-gray-200 text-gray-700';

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${classes}`}>
      {label}
    </span>
  );
}
