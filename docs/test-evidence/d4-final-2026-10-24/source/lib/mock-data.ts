export type Product = {
  id: string;
  name: string;
  price: number;
  image: string;
  href: string;
};

export const featuredProducts: Product[] = [
  {
    id: "silk-blend-blouse",
    name: "Silk Blend Blouse",
    price: 129,
    image: "/images/product-blouse.jpg",
    href: "/products/silk-blend-blouse",
  },
  {
    id: "tailored-trouser",
    name: "Tailored Trouser",
    price: 159,
    image: "/images/product-trousers.jpg",
    href: "/products/tailored-trouser",
  },
  {
    id: "silver-chain",
    name: "Silver Chain, Long Drop",
    price: 79,
    image: "/images/product-necklace.jpg",
    href: "/products/silver-chain",
  },
  {
    id: "structured-blazer",
    name: "Structured Blazer",
    price: 289,
    image: "/images/product-blazer.jpg",
    href: "/products/structured-blazer",
  },
  {
    id: "leather-jacket",
    name: "Leather Biker Jacket",
    price: 349,
    image: "/images/product-jacket.jpg",
    href: "/products/leather-jacket",
  },
  {
    id: "work-shirt",
    name: "Relaxed Work Shirt",
    price: 119,
    image: "/images/product-shirts.jpg",
    href: "/products/work-shirt",
  },
];
