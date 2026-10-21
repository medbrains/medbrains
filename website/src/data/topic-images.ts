// One soft 3D illustration per blog topic (generated in Figma, file
// "MedBrains blog covers"), keyed by topic slug.
import type { ImageMetadata } from "astro";
import type { CategorySlug } from "./blog-categories";

const files = import.meta.glob<{ default: ImageMetadata }>("../assets/topics/*.png", { eager: true });

export function topicImage(slug: CategorySlug): ImageMetadata {
  const file = files[`../assets/topics/${slug}.png`];
  if (!file) throw new Error(`No illustration for topic ${slug}`);
  return file.default;
}
