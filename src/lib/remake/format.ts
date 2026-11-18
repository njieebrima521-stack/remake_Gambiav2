import { format, parseISO } from "date-fns";

export const fmtNum = (n: number) => n.toLocaleString("en-GB");
export const fmtKg = (n: number) => `${n.toLocaleString("en-GB", { maximumFractionDigits: 1 })} kg`;
export const fmtGmd = (n: number) =>
  `GMD ${n.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
export const fmtDate = (iso: string) => format(parseISO(iso), "EEE, d MMM yyyy");
export const fmtShortDate = (iso: string) => format(parseISO(iso), "d MMM");
