export function parsePlayerRecoveryCode(value: string): string | null {
  const match = value.trim().match(/^(?:[^#]+#)?(\d{6})$/);
  return match?.[1] ?? null;
}
