export type CategoryTile = {
  id: string;
  name: string;
  href: string;
  image: string;
  description: string;
};

export type Product = {
  id: string;
  name: string;
  price: number;
  image: string;
  href: string;
};

export const navLinks = [
  { label: "Shop", href: "#this-season" },
  { label: "Collections", href: "#featured-categories" },
  { label: "For him", href: "#this-season" },
  { label: "For her", href: "#this-season" },
] as const;

export const bagItemCount = 3;

export const categoryTiles: CategoryTile[] = [
  {
    id: "essentials",
    name: "The Essentials",
    href: "#this-season",
    image: "/images/category-essentials.jpg",
    description:
      "Timeless wardrobe foundations designed for effortless everyday dressing.",
  },
  {
    id: "accessories",
    name: "Accessories",
    href: "#this-season",
    image: "/images/category-accessories.jpg",
    description:
      "Considered finishing pieces that bring character and refinement to every look.",
  },
  {
    id: "outerwear",
    name: "Outerwear",
    href: "#this-season",
    image: "/images/category-outerwear.jpg",
    description:
      "Structured layers designed to balance warmth, form and understated elegance.",
  },
];

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

export const instagramImages = [
  { src: "/images/ig-1.jpg", alt: "Neutral knitwear on a rail" },
  { src: "/images/category-essentials.jpg", alt: "Stacked denim" },
  { src: "/images/ig-3.jpg", alt: "Jackets on a chrome rail" },
  { src: "/images/product-jacket.jpg", alt: "Black leather jacket" },
];

export const stylistSuggestions = [
  "Size & fit guide",
  "Complete the look",
  "Explore trousers",
  "Material inquiries",
];

export const stylistRecommendations = [
  {
    id: "sculpted-blazer",
    category: "Tailoring",
    name: "Sculpted Blazer",
    image: "/images/product-blazer.jpg",
    href: "/products/structured-blazer",
  },
  {
    id: "double-faced-coat",
    category: "Outerwear",
    name: "Double-Faced Coat",
    image: "/images/product-jacket.jpg",
    href: "/products/leather-jacket",
  },
];

export const stylistTerms = [
  {
    id: "01",
    title: "Personalized Recommendations",
    body: "Insights and fit advice are generated algorithmically to assist your shopping experience and do not guarantee stock reservation until checkout.",
  },
  {
    id: "02",
    title: "Data & Preference Use",
    body: "Your chat inquiries and size queries are utilized within this session to refine styling suggestions and elevate recommendation relevance.",
  },
  {
    id: "03",
    title: "Privacy & Protection",
    body: "We do not sell your personal styling data. Interactions are handled in accordance with the Australian Privacy Principles and ABC Fashion Privacy Policy.",
  },
  {
    id: "04",
    title: "Human Concierge Option",
    body: "You may opt out of automated styling at any time to connect with our Melbourne flagship human atelier team.",
  },
];

export const footerDepartments = [
  { label: "Women's Collection", href: "#this-season" },
  { label: "Men's Collection", href: "#this-season" },
  { label: "Accessories", href: "#featured-categories" },
];

export const footerConnect = [
  { label: "Shipping", href: "#" },
  { label: "Privacy Policy", href: "#" },
  { label: "Contact Us", href: "#" },
];

export const footerSocial = [
  { label: "Instagram", href: "#" },
  { label: "Facebook", href: "#" },
  { label: "Pinterest", href: "#" },
];

export function formatPrice(value: number) {
  return `$${value.toFixed(2)}`;
}
