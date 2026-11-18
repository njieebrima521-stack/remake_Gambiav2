import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { materialTypeById } from "./material-types";
import { analyzeWasteImage } from "./scan.server";
import type { ScanDetection, ScanRecord } from "./services/scans";

const MAX_DATA_URL = 7_500_000; // ~5.5 MB image

/**
 * Analyse a waste photo and save the scan for the signed-in user.
 * AI detection is indicative only: it never establishes exact weight, guaranteed acceptance, or Green Coins.
 */
export const analyzeWaste = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        imageDataUrl: z
          .string()
          .max(MAX_DATA_URL)
          .regex(/^data:image\/(png|jpe?g|webp|gif);base64,/),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<ScanRecord> => {
    const { supabase, userId } = context;
    const analysis = await analyzeWasteImage(data.imageDataUrl);

    let imagePath: string | null = null;
    const match = /^data:(image\/[a-z]+);base64,(.*)$/s.exec(data.imageDataUrl);
    if (match) {
      const bytes = Uint8Array.from(atob(match[2]!), (c) => c.charCodeAt(0));
      const ext = match[1]!.split("/")[1]!.replace("jpeg", "jpg");
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("scan-images")
        .upload(path, bytes, { contentType: match[1]! });
      if (!error) imagePath = path;
    }

    const detections: ScanDetection[] = analysis.items.slice(0, 8).map((i) => ({
      label: i.label.slice(0, 80),
      category: i.category,
      count: Math.max(0, Math.round(i.count)),
      confidence: Math.min(1, Math.max(0, i.confidence)),
      explanation: i.explanation.slice(0, 200),
      status: "detected",
    }));
    const cats = new Set(detections.map((d) => d.category));
    const firstCat = detections.find((d) => d.category !== "other")?.category;
    const primaryParent =
      firstCat && firstCat !== "other" ? (materialTypeById(firstCat)?.parent ?? null) : null;

    const { data: row, error } = await supabase
      .from("scans")
      .insert({
        user_id: userId,
        image_path: imagePath,
        items: detections as unknown as Json,
        primary_material: primaryParent,
        accepted: false,
        contaminated: analysis.contaminated,
        estimated_kg: 0,
        advice: analysis.advice.slice(0, 300),
        source: "ai",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    return {
      id: row.id,
      imageUrl: null,
      detections,
      mixed: cats.size > 1,
      contaminated: analysis.contaminated,
      advice: row.advice ?? "",
      confirmed: false,
      createdAt: row.created_at,
    };
  });
