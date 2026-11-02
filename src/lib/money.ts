/** Format integer satang as Thai baht, e.g. 12050 -> "฿120.50". */
export function formatBaht(satang: number): string {
  const baht = satang / 100;
  return `฿${baht.toLocaleString("th-TH", {
    minimumFractionDigits: satang % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Parse a baht string typed by an admin ("120.5") into integer satang. */
export function parseBahtToSatang(input: string): number | null {
  const trimmed = input.trim();
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(trimmed)) return null;
  const [whole, frac = ""] = trimmed.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

export function lineTotal(unitPriceSatang: number, quantity: number): number {
  return unitPriceSatang * quantity;
}

export function sumLines(lines: { unitPriceSatang: number; quantity: number }[]): number {
  return lines.reduce((acc, l) => acc + lineTotal(l.unitPriceSatang, l.quantity), 0);
}
