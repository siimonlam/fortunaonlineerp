export function toLocalDateTimeString(isoString: string | null | undefined): string {
  if (!isoString) return '';

  const date = new Date(isoString);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function fromLocalDateTimeString(localDateTimeString: string | null | undefined): string {
  if (!localDateTimeString) return '';

  return new Date(localDateTimeString).toISOString();
}

export function toLocalDateString(isoString: string | null | undefined): string {
  if (!isoString) return '';

  const date = new Date(isoString);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function fromLocalDateString(localDateString: string | null | undefined): string {
  if (!localDateString) return '';

  return new Date(localDateString).toISOString();
}
