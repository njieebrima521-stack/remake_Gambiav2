import type { MaterialId } from "./types";
import plasticImg from "@/assets/cat-plastic.jpg";
import metalImg from "@/assets/cat-metal.jpg";
import glassImg from "@/assets/cat-glass.jpg";
import paperImg from "@/assets/cat-paper.jpg";
import ewasteImg from "@/assets/cat-ewaste.jpg";
import organicImg from "@/assets/cat-organic.jpg";

/**
 * Fine-grained material types used for institution specialisations, routing and scanner results.
 * Each maps to a coarse `MaterialId` that carries the Green Coins rate and batch stream.
 */
export type MaterialTypeId =
  | "plastic_general"
  | "pet"
  | "hdpe"
  | "metal_other"
  | "aluminium"
  | "glass"
  | "paper"
  | "cardboard"
  | "ewaste"
  | "organic";

export interface MaterialTypeInfo {
  id: MaterialTypeId;
  name: string;
  parent: MaterialId;
  image: string;
  examples: string;
  accepted: string[];
  notAccepted: string[];
  prep: string[];
  warnings: string[];
}

export const MATERIAL_TYPES: MaterialTypeInfo[] = [
  {
    id: "plastic_general",
    name: "General plastics",
    parent: "plastic",
    image: plasticImg,
    examples: "Buckets, chairs, crates, food tubs",
    accepted: ["Rigid plastic buckets and bowls", "Plastic chairs and crates", "Rinsed food tubs"],
    notAccepted: [
      "Styrofoam / foam takeaway packs",
      "Food-soiled pure-water sachets",
      "Plastics fused with metal parts",
    ],
    prep: [
      "Empty and rinse containers",
      "Keep dry and free of food residue",
      "Separate from PET bottles if booking separately",
    ],
    warnings: ["Mixed or oily plastics may be rejected at collection."],
  },
  {
    id: "pet",
    name: "PET plastic bottles",
    parent: "plastic",
    image: plasticImg,
    examples: "Water and soft-drink bottles",
    accepted: ["Clear and coloured PET water bottles", "Soft-drink and juice bottles"],
    notAccepted: ["Oil-soaked bottles", "Chemical or pesticide bottles", "Plastic film wraps"],
    prep: [
      "Empty liquids completely and rinse",
      "Crush bottles to reduce bag volume",
      "Keep caps inside the same bag",
    ],
    warnings: ["Bottles containing leftover liquid or fuel residue will be rejected."],
  },
  {
    id: "hdpe",
    name: "HDPE plastics",
    parent: "plastic",
    image: plasticImg,
    examples: "Jerrycans, detergent bottles, thick jugs",
    accepted: ["Clean HDPE jerrycans", "Milk, shampoo and detergent bottles"],
    notAccepted: ["Containers that held motor oil or toxic chemicals", "Foam packaging"],
    prep: [
      "Rinse thoroughly",
      "Drain completely before bagging",
      "Remove metal handles if detachable",
    ],
    warnings: ["Never include chemical or engine oil containers."],
  },
  {
    id: "metal_other",
    name: "Metals",
    parent: "metal",
    image: metalImg,
    examples: "Tin cans, metal frames, scrap iron",
    accepted: ["Tin food cans", "Steel frames and fittings", "Empty depressurised gas cylinders"],
    notAccepted: ["Pressurised or leaking gas bottles", "Paint-soaked tins", "Aerosol cans"],
    prep: [
      "Rinse food tins",
      "Confirm gas containers are fully empty with valve open",
      "Separate wood or plastic attachments",
    ],
    warnings: ["Pressurised cylinders are unsafe and cannot be collected."],
  },
  {
    id: "aluminium",
    name: "Aluminium cans",
    parent: "metal",
    image: metalImg,
    examples: "Soda, malt and beverage cans",
    accepted: ["Clean aluminium drink cans", "Foil trays free of food"],
    notAccepted: [
      "Cans filled with liquid or cigarette ash",
      "Steel food tins (book under Metals)",
    ],
    prep: [
      "Empty and rinse cans",
      "Flatten to save space",
      "Bag separately from plastics and glass",
    ],
    warnings: ["Keep sharp crushed edges contained in a sturdy bag."],
  },
  {
    id: "glass",
    name: "Glass",
    parent: "glass",
    image: glassImg,
    examples: "Bottles, jars, intact mirrors",
    accepted: ["Clear, green and brown bottles", "Food jars", "Wrapped intact mirrors"],
    notAccepted: ["Light bulbs and fluorescent tubes", "Window panes", "Ceramic plates or mugs"],
    prep: [
      "Remove metal or plastic lids",
      "Rinse jars clean",
      "Wrap broken glass in thick paper and label clearly",
    ],
    warnings: ["Do not mix ceramics with glass — it spoils the entire batch."],
  },
  {
    id: "paper",
    name: "Paper",
    parent: "paper",
    image: paperImg,
    examples: "Office sheets, newspapers, exercise books",
    accepted: ["Clean office paper", "Newspapers and magazines", "Old school exercise books"],
    notAccepted: ["Wet, mouldy or greasy paper", "Tissue paper or napkins", "Plastic-lined cups"],
    prep: [
      "Keep completely dry",
      "Tie loose stacks or place in a dry bag",
      "Remove plastic folders",
    ],
    warnings: ["Wet or food-stained paper cannot be recycled."],
  },
  {
    id: "cardboard",
    name: "Cardboard",
    parent: "paper",
    image: paperImg,
    examples: "Shipping cartons, corrugated boxes",
    accepted: ["Clean corrugated cardboard boxes", "Dry cereal and packaging cartons"],
    notAccepted: ["Grease-soaked pizza boxes", "Waxed cold-storage cartons", "Wet cardboard"],
    prep: ["Flatten all boxes", "Remove heavy packing tape where easy", "Bundle flat and keep dry"],
    warnings: ["Oily or water-damaged cardboard will be rejected."],
  },
  {
    id: "ewaste",
    name: "Electronic waste",
    parent: "ewaste",
    image: ewasteImg,
    examples: "Phones, chargers, cables, small radios",
    accepted: [
      "Mobile phones and tablets",
      "Chargers and power cables",
      "Radios and computer parts",
    ],
    notAccepted: [
      "Swollen or leaking lithium batteries",
      "Broken CRT screens",
      "Large fridges (special booking)",
    ],
    prep: [
      "Wipe personal data and remove SIM/memory cards",
      "Keep intact devices dry",
      "Bundle cables together",
    ],
    warnings: ["Do not crush or puncture batteries; hand over damaged batteries separately."],
  },
  {
    id: "organic",
    name: "Organic waste",
    parent: "organic",
    image: organicImg,
    examples: "Fruit peels, kitchen scraps, garden clippings",
    accepted: ["Fruit and vegetable peels", "Coconut husks", "Leaves and garden trimmings"],
    notAccepted: ["Meat, fish bones or dairy", "Plastic bags or wrappers", "Pet or animal waste"],
    prep: [
      "Drain excess water",
      "Store in a covered bucket before handover",
      "Ensure zero plastic or glass contamination",
    ],
    warnings: ["Even small amounts of plastic contamination ruin compost batches."],
  },
];

export const materialTypeById = (id: string) => MATERIAL_TYPES.find((m) => m.id === id);
export const materialTypeName = (id: string) => materialTypeById(id)?.name ?? id;

/** Categories a resident picks in the booking wizard; each books one separate material stream. */
export interface BookingCategory {
  id: string;
  name: string;
  /** Material type the stream is booked and routed as. */
  type: MaterialTypeId;
  hint: string;
}

export const BOOKING_CATEGORIES: BookingCategory[] = MATERIAL_TYPES.map((m) => ({
  id: m.id,
  name: m.name,
  type: m.id,
  hint: m.examples,
}));

/** Scanner categories the AI may return (superset of material types plus "other"). */
export type ScanCategory = MaterialTypeId | "other";
