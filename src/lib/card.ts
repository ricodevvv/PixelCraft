import type { Product } from "./db/schema";

/**
 * Trims a product down to what the store cards need on the client.
 */
export function toCard(product: Product) {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    tagline: product.tagline,
    image: product.image,
    price: product.price,
    comparePrice: product.comparePrice,
    maxQuantity: product.maxQuantity,
  };
}
