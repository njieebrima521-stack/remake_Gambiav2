import { db, rpc, rows } from "./db";
import type { ScanCategory } from "../material-types";

export interface ScanDetection {
  /** e.g. "Water bottles" */
  label: string;
  category: ScanCategory;
  /** Approximate visible item count (0 when not countable). */
  count: number;
  /** 0..1 */
  confidence: number;
  explanation: string;
  /** Set when the resident confirms or corrects the detection. */
  status: "detected" | "confirmed" | "corrected" | "removed";
  /** Corrected category, when status = corrected. */
  correctedCategory?: ScanCategory | undefined;
}

export interface ScanRecord {
  id: string;
  imageUrl: string | null;
  detections: ScanDetection[];
  mixed: boolean;
  contaminated: boolean;
  advice: string;
  confirmed: boolean;
  createdAt: string;
}

type Row = {
  id: string;
  image_path: string | null;
  items: unknown;
  contaminated: boolean;
  advice: string | null;
  confirmed_at: string | null;
  created_at: string;
};

function toDetections(items: unknown): ScanDetection[] {
  if (!Array.isArray(items)) return [];
  return items.map((i: Record<string, unknown>) => ({
    label: String(i["label"] ?? "Item"),
    category: (i["category"] ?? i["material"] ?? "other") as ScanCategory,
    count: Number(i["count"] ?? 0),
    confidence: Number(i["confidence"] ?? 0),
    explanation: String(i["explanation"] ?? ""),
    status: (i["status"] ?? "detected") as ScanDetection["status"],
    correctedCategory: (i["correctedCategory"] ?? undefined) as ScanCategory | undefined,
  }));
}

export async function scanFromRow(r: Row): Promise<ScanRecord> {
  let imageUrl: string | null = null;
  if (r.image_path) {
    const { data } = await db.storage.from("scan-images").createSignedUrl(r.image_path, 3600);
    imageUrl = data?.signedUrl ?? null;
  }
  const detections = toDetections(r.items);
  const cats = new Set(
    detections.filter((d) => d.status !== "removed").map((d) => d.correctedCategory ?? d.category),
  );
  return {
    id: r.id,
    imageUrl,
    detections,
    mixed: cats.size > 1,
    contaminated: r.contaminated,
    advice: r.advice ?? "",
    confirmed: !!r.confirmed_at,
    createdAt: r.created_at,
  };
}

export async function listScanHistory(limit = 20): Promise<ScanRecord[]> {
  const data = await rows<Row>(
    db
      .from("scans")
      .select("id,image_path,items,contaminated,advice,confirmed_at,created_at")
      .order("created_at", { ascending: false })
      .limit(limit),
  );
  return Promise.all(data.map(scanFromRow));
}

/** Save the resident's confirmation/corrections. Detection list is re-validated on the server. */
export async function confirmScan(id: string, detections: ScanDetection[]): Promise<void> {
  await rpc("confirm_scan", {
    _scan: id,
    _items: detections.map((d) => ({
      label: d.label,
      category: d.category,
      count: d.count,
      confidence: d.confidence,
      explanation: d.explanation,
      status: d.status,
      correctedCategory: d.correctedCategory ?? null,
    })),
  });
}
