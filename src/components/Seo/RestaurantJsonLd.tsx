import { restaurantJsonLd } from '@/lib/structured-data';
import JsonLd from './JsonLd';

export default function RestaurantJsonLd() {
  return <JsonLd id="restaurant-jsonld" data={restaurantJsonLd()} />;
}
