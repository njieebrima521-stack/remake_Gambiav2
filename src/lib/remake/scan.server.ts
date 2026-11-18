import { z } from "zod";

const MATERIAL_CATEGORIES = [
  "plastic_general",
  "pet",
  "hdpe",
  "metal_other",
  "aluminium",
  "glass",
  "paper",
  "cardboard",
  "ewaste",
  "organic",
  "other",
] as const;

const scanSchema = z.object({
  items: z.array(
    z.object({
      label: z.string(),
      category: z.enum(MATERIAL_CATEGORIES),
      count: z.number(),
      confidence: z.number(),
      explanation: z.string(),
    }),
  ),
  contaminated: z.boolean(),
  advice: z.string(),
});

export type WasteAnalysis = z.infer<typeof scanSchema>;

export async function analyzeWasteImage(_imageDataUrl: string): Promise<WasteAnalysis> {
  // Stage 2 replaces this with server-side @google/genai (gemini-4-hydrogen) using GEMINI_API_KEY.
  // Never fabricate scan results when the AI service is unavailable.
  throw new Error("Analysis unavailable. Try again.");
}
