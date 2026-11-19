const full = new Intl.NumberFormat("en-US");
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export const formatCount = (value: number) => full.format(value);
export const formatCompact = (value: number) => compact.format(value);

/** "gb" → 🇬🇧, built from the two regional indicator symbols. */
export const countryFlag = (countryId: string) =>
  String.fromCodePoint(...[...countryId.toUpperCase()].map((char) => 0x1f1a5 + char.charCodeAt(0)));

export const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
