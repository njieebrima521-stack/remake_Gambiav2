import { format } from "date-fns";
import type { MaterialId } from "./types";
import plasticImg from "@/assets/cat-plastic.jpg";
import metalImg from "@/assets/cat-metal.jpg";
import glassImg from "@/assets/cat-glass.jpg";
import paperImg from "@/assets/cat-paper.jpg";
import ewasteImg from "@/assets/cat-ewaste.jpg";
import organicImg from "@/assets/cat-organic.jpg";

/** Today as yyyy-mm-dd in the browser's time zone. */
export const todayIso = () => format(new Date(), "yyyy-MM-dd");

export interface MaterialInfo {
  id: MaterialId;
  name: string;
  examples: string;
  image: string;
  /** Default rate; live rates come from the backend (state.rates). */
  pointsPerKg: number;
  accepted: string[];
  notAccepted: string[];
  prep: string[];
}

export const MATERIALS: Record<MaterialId, MaterialInfo> = {
  plastic: {
    id: "plastic",
    name: "Plastics",
    examples: "Bottles, buckets, chairs, cups",
    image: plasticImg,
    pointsPerKg: 15,
    accepted: [
      "PET water & soft-drink bottles",
      "HDPE buckets and jerrycans",
      "Plastic chairs and crates",
      "Cups and food tubs (rinsed)",
    ],
    notAccepted: [
      "Pure-water sachets with food residue",
      "Styrofoam",
      "Plastic mixed with metal parts",
    ],
    prep: [
      "Empty and rinse containers",
      "Remove caps and keep them in the same bag",
      "Flatten bottles to save space",
      "Keep plastics dry and separate from food waste",
    ],
  },
  metal: {
    id: "metal",
    name: "Metals",
    examples: "Cans, tables, gas containers",
    image: metalImg,
    pointsPerKg: 20,
    accepted: [
      "Aluminium drink cans",
      "Tin food cans",
      "Old metal tables and frames",
      "Empty, depressurised gas containers",
    ],
    notAccepted: ["Cans with paint or oil residue", "Pressurised or leaking gas bottles"],
    prep: [
      "Rinse food cans",
      "Crush aluminium cans",
      "Ensure gas containers are fully empty and valve open",
      "Separate metal from wood or plastic parts",
    ],
  },
  glass: {
    id: "glass",
    name: "Glass",
    examples: "Bottles, jars, mirrors",
    image: glassImg,
    pointsPerKg: 8,
    accepted: ["Clear and green bottles", "Food jars", "Intact mirrors (wrapped)"],
    notAccepted: ["Light bulbs", "Window glass", "Ceramic plates and cups"],
    prep: [
      "Remove lids and corks",
      "Rinse jars",
      "Wrap broken pieces in paper and label them",
      "Do not mix with ceramics",
    ],
  },
  paper: {
    id: "paper",
    name: "Paper & Cardboard",
    examples: "Boxes, newspapers, exercise books",
    image: paperImg,
    pointsPerKg: 10,
    accepted: [
      "Cardboard boxes",
      "Newspapers and magazines",
      "Office paper and old exercise books",
    ],
    notAccepted: ["Wet or greasy paper", "Paper cups with plastic lining", "Tissue paper"],
    prep: ["Flatten boxes", "Tie paper in bundles", "Keep dry — wet paper is rejected"],
  },
  ewaste: {
    id: "ewaste",
    name: "Electronic Waste",
    examples: "Phones, chargers, cables, radios",
    image: ewasteImg,
    pointsPerKg: 30,
    accepted: [
      "Mobile phones and tablets",
      "Chargers and cables",
      "Radios, small appliances",
      "Computer parts",
    ],
    notAccepted: ["Leaking or swollen batteries", "Fridges (book a special collection)"],
    prep: [
      "Remove batteries and hand them over separately",
      "Erase personal data from phones",
      "Bundle cables together",
    ],
  },
  organic: {
    id: "organic",
    name: "Organic Waste",
    examples: "Food scraps, peels, garden waste",
    image: organicImg,
    pointsPerKg: 5,
    accepted: ["Fruit and vegetable peels", "Coconut husks", "Garden leaves and grass"],
    notAccepted: ["Meat and bones", "Plastic bags with food", "Animal waste"],
    prep: ["Drain liquids", "Use a covered bucket", "Keep free of plastic and glass"],
  },
};

export const MATERIAL_LIST = Object.values(MATERIALS);

export const TIME_SLOTS = [
  "07:00 – 09:00",
  "09:00 – 11:00",
  "11:00 – 13:00",
  "14:00 – 16:00",
  "16:00 – 18:00",
];

export const AREAS = [
  "Kanifing",
  "Serrekunda",
  "Bakau",
  "Banjul",
  "Brikama",
  "Brusubi",
  "Sukuta",
  "Kololi",
  "Lamin",
];

export const HUB_NAME = "Kanifing Recycling Hub";

/** Estimate used for CO₂e figures: kg CO₂e avoided per kg recycled (shown as an estimate in the UI). */
export const CO2_PER_KG = 1.5;
/** Estimate used for water figures: litres saved per kg recycled. */
export const WATER_L_PER_KG = 0.9;

export interface GuideCategory {
  id: string;
  name: string;
  parent: MaterialId;
  materialType:
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
  summary: string;
  image: string;
  accepted: string[];
  notAccepted: string[];
  prep: string[];
  warnings: string[];
}

export const GUIDE_CATEGORIES: GuideCategory[] = [
  {
    id: "pet",
    name: "PET plastic bottles",
    parent: "plastic",
    materialType: "pet",
    summary: "Clear and coloured water or soft-drink bottles",
    image: plasticImg,
    accepted: ["Water bottles", "Soft-drink bottles", "Cooking oil bottles (rinsed dry)"],
    notAccepted: ["Bottles with liquid or food inside", "Chemical or pesticide bottles"],
    prep: ["Empty completely and rinse", "Crush bottles and put caps back on"],
    warnings: ["Keep PET separate from food scraps and mixed rubbish."],
  },
  {
    id: "hdpe",
    name: "HDPE & hard plastics",
    parent: "plastic",
    materialType: "hdpe",
    summary: "Jerrycans, buckets, crates, detergent containers",
    image: plasticImg,
    accepted: [
      "Clean jerrycans and buckets",
      "Plastic crates and chairs",
      "Shampoo & detergent bottles",
    ],
    notAccepted: ["Containers with oil, paint, or solvent residue", "Styrofoam"],
    prep: ["Rinse containers and drain water", "Remove metal handles or hinges"],
    warnings: ["Containers that held fuel or toxic chemicals are rejected at pickup."],
  },
  {
    id: "plastic_general",
    name: "General plastics",
    parent: "plastic",
    materialType: "plastic_general",
    summary: "Food tubs, cups, clean plastic packaging",
    image: plasticImg,
    accepted: [
      "Clean plastic cups and bowls",
      "Rinsed food tubs",
      "Clean plastic bags tied together",
    ],
    notAccepted: ["Greasy takeaway containers", "Pure-water sachets with dirt or food"],
    prep: ["Rinse and dry before bagging", "Pack separately from paper, glass and metal"],
    warnings: ["Wet or food-soiled plastic contaminates the entire stream."],
  },
  {
    id: "aluminium",
    name: "Aluminium cans",
    parent: "metal",
    materialType: "aluminium",
    summary: "Beverage cans and clean aluminium foil trays",
    image: metalImg,
    accepted: ["Soft-drink and malt cans", "Clean aluminium food trays"],
    notAccepted: ["Pressurised aerosol cans", "Cans stuffed with cigarettes or rubbish"],
    prep: ["Empty and rinse cans", "Crush flat if possible to save bag space"],
    warnings: ["Keep aluminium cans separate from steel tins or general rubbish."],
  },
  {
    id: "metal_other",
    name: "Metals",
    parent: "metal",
    materialType: "metal_other",
    summary: "Tin cans, steel frames, metal furniture",
    image: metalImg,
    accepted: [
      "Tin food cans (rinsed)",
      "Metal frames, pots and scrap",
      "Empty, valve-open gas cylinders",
    ],
    notAccepted: ["Paint tins with wet paint", "Pressurised or leaking gas bottles"],
    prep: ["Rinse food tins", "Separate attached wood or plastic parts"],
    warnings: ["Never seal pressurised gas containers in a bag; valves must be open and empty."],
  },
  {
    id: "glass",
    name: "Glass",
    parent: "glass",
    materialType: "glass",
    summary: "Bottles, jars and intact mirrors",
    image: glassImg,
    accepted: ["Clear, green and brown bottles", "Food jars", "Intact mirrors (wrapped)"],
    notAccepted: ["Light bulbs and fluorescent tubes", "Window panes", "Ceramic plates or mugs"],
    prep: [
      "Remove metal lids and corks",
      "Rinse jars and drain dry",
      "Pack in a sturdy box or crate",
    ],
    warnings: ["Ceramics and light bulbs ruin recycled glass batches; wrap sharp edges safely."],
  },
  {
    id: "cardboard",
    name: "Cardboard",
    parent: "paper",
    materialType: "cardboard",
    summary: "Shipping cartons, corrugated boxes",
    image: paperImg,
    accepted: ["Corrugated shipping boxes", "Clean product cartons"],
    notAccepted: ["Oil-soaked pizza boxes", "Wet or mouldy cardboard"],
    prep: ["Remove tape and plastic liners", "Flatten boxes and tie in bundles"],
    warnings: ["Keep cardboard completely dry; wet cardboard cannot be accepted."],
  },
  {
    id: "paper",
    name: "Paper",
    parent: "paper",
    materialType: "paper",
    summary: "Newspapers, office paper, exercise books",
    image: paperImg,
    accepted: ["Newspapers and magazines", "Office paper", "Old school exercise books"],
    notAccepted: ["Tissue or paper towels", "Plastic-lined paper cups", "Wet or soiled paper"],
    prep: ["Stack and tie neatly or place in a dry bag", "Remove plastic spiral bindings"],
    warnings: ["Keep dry and separate from liquids or organic waste."],
  },
  {
    id: "ewaste",
    name: "Electronic waste",
    parent: "ewaste",
    materialType: "ewaste",
    summary: "Phones, chargers, cables, small appliances",
    image: ewasteImg,
    accepted: [
      "Mobile phones and tablets",
      "Chargers, power strips and cables",
      "Radios and computer parts",
    ],
    notAccepted: ["Swollen or leaking batteries", "Large fridges or AC units"],
    prep: ["Erase personal data from phones before handover", "Bundle cables together"],
    warnings: ["Handle batteries carefully and inform the collector if any battery is damaged."],
  },
  {
    id: "organic",
    name: "Organic waste",
    parent: "organic",
    materialType: "organic",
    summary: "Fruit peels, kitchen scraps, garden clippings",
    image: organicImg,
    accepted: ["Fruit and vegetable peels", "Coconut husks", "Leaves and grass trimmings"],
    notAccepted: ["Meat, fish bones and dairy", "Plastic wrappers", "Glass or metal"],
    prep: ["Drain excess liquid", "Store in a covered bucket or compostable liner"],
    warnings: ["Must be 100% free of plastic, glass and metal."],
  },
];
