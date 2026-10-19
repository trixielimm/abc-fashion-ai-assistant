export const navLinks = [
  { label: "Shop", href: "/search" },
  { label: "Collections", href: "/#featured-categories" },
  { label: "For him", href: "/search?gender=men" },
  { label: "For her", href: "/search?gender=women" },
] as const;

export const footerShopLinks = [
  { label: "All products", href: "/search" },
  { label: "Women's collection", href: "/search?gender=women" },
  { label: "Men's collection", href: "/search?gender=men" },
  { label: "Accessories", href: "/search?category=accessories" },
] as const;

export const footerHelpLinks = [
  { label: "Shopping help", href: "/help" },
  { label: "Sizes & fit", href: "/help#sizes-fit" },
  { label: "Orders & delivery", href: "/help#orders" },
  { label: "Using the AI Stylist", href: "/help#ai-stylist" },
] as const;
