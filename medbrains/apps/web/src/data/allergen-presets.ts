/**
 * Curated common allergens, grouped by `allergy_type`, for structured allergen
 * entry. Drug allergens come from the live pharmacy catalogue (DrugSearchSelect);
 * the lists here cover the non-drug types so clinicians pick a normalised name
 * (fewer typos → better allergy cross-checks) while still being able to type a
 * free value that isn't listed. Reference data only — universal, not
 * tenant-specific. Not exhaustive; extend as needed.
 */

export const ALLERGEN_PRESETS: Record<string, string[]> = {
  food: [
    "Peanuts",
    "Tree nuts (almond, walnut, cashew)",
    "Milk / dairy",
    "Eggs",
    "Fish",
    "Shellfish (prawn, crab, lobster)",
    "Soy",
    "Wheat / gluten",
    "Sesame",
    "Mustard",
    "Banana",
    "Mango",
    "Brinjal (eggplant)",
    "Chicken",
    "Mutton",
    "Food colouring / additives",
    "Monosodium glutamate (MSG)",
  ],
  environmental: [
    "House dust mites",
    "Pollen (grass)",
    "Pollen (tree)",
    "Pollen (weed)",
    "Mould spores",
    "Pet dander (cat)",
    "Pet dander (dog)",
    "Cockroach",
    "Smoke",
    "Cold air",
    "Grass",
  ],
  latex: ["Natural rubber latex", "Latex gloves", "Latex catheter / tubing"],
  contrast_dye: [
    "Iodinated contrast media",
    "Gadolinium-based contrast",
    "Barium sulphate",
    "Fluorescein dye",
  ],
  biological: [
    "Bee sting / venom",
    "Wasp / hornet sting",
    "Ant bite",
    "Mosquito",
    "Egg-based vaccines",
    "Anti-sera / antitoxin",
    "Blood products",
  ],
  // The enum has no dedicated "chemical" value, so chemical and miscellaneous
  // sensitisers live under "other".
  other: [
    "Nickel (jewellery / metal)",
    "Formaldehyde",
    "Fragrances / perfumes",
    "Para-phenylenediamine (hair dye / PPD)",
    "Cosmetics",
    "Adhesive / plaster tape",
    "Chlorhexidine",
    "Povidone-iodine (Betadine)",
    "Soap / detergent",
    "Preservatives (parabens)",
    "Sunscreen",
    "Henna",
  ],
};

/** Suggestion list for a given allergy type, empty for unknown types. */
export function allergenPresetsFor(allergyType: string): string[] {
  return ALLERGEN_PRESETS[allergyType] ?? [];
}
