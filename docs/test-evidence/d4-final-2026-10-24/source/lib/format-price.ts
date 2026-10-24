export function formatPrice(value: number) {
  return `$${value.toFixed(2)}`;
}

export function formatAud(value: number) {
  return `A${formatPrice(value)}`;
}
