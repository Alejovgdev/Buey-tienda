export function formatAllergenLabel(raw: string): string {
  const withSpaces = raw.replace(/_/g, ' ');
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}
