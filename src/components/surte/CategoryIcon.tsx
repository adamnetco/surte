import {
  Drumstick, Cherry, Droplets, Flame, Croissant, Package, Beef, Fish,
  IceCream, Milk, Cookie, Apple, Grape, Citrus, Wheat, Egg, Sandwich,
  Coffee, Wine, Beer, Candy, Leaf, Salad, Soup, Pizza, Cake, UtensilsCrossed,
  ShoppingBasket, Carrot, Ham, Popcorn, CupSoda, GlassWater, Refrigerator,
  Warehouse, Truck, Store, Heart, Sparkles, Zap, Tag, Star, Gift,
  Snowflake, Sun, Pepper, Vegan, Banana, Popsicle,
  type LucideIcon,
} from "lucide-react";

/**
 * Category icon resolver.
 * Supports:
 * 1. Lucide icon names (string like "Drumstick", "Cherry", etc.)
 * 2. Custom SVG URLs (string starting with http:// or https://)
 *
 * Library: lucide-react — https://lucide.dev/icons
 * All icons are fully customizable via size, color, strokeWidth props.
 */

const iconMap: Record<string, LucideIcon> = {
  Drumstick, Cherry, Droplets, Flame, Croissant, Package, Beef, Fish,
  IceCream, Milk, Cookie, Apple, Grape, Citrus, Wheat, Egg, Sandwich,
  Coffee, Wine, Beer, Candy, Leaf, Salad, Soup, Pizza, Cake, UtensilsCrossed,
  ShoppingBasket, Carrot, Ham, Popcorn, CupSoda, GlassWater, Refrigerator,
  Warehouse, Truck, Store, Heart, Sparkles, Zap, Tag, Star, Gift,
  Snowflake, Sun, Pepper, Vegan, Banana, Popsicle,
};

export const AVAILABLE_ICONS = Object.keys(iconMap);

export const isCustomSvgUrl = (icon: string) =>
  icon.startsWith("http://") || icon.startsWith("https://");

interface CategoryIconProps {
  icon?: string | null;
  size?: number;
  color?: string;
  className?: string;
}

const CategoryIcon = ({ icon, size = 26, color, className }: CategoryIconProps) => {
  if (!icon) {
    const Fallback = iconMap.Package;
    return <Fallback size={size} style={{ color }} className={className} />;
  }

  // Custom uploaded SVG
  if (isCustomSvgUrl(icon)) {
    return (
      <img
        src={icon}
        alt="category icon"
        width={size}
        height={size}
        className={className}
        style={{ filter: color ? undefined : undefined }}
      />
    );
  }

  // Lucide icon
  const Icon = iconMap[icon] || iconMap.Package;
  return <Icon size={size} style={{ color }} className={className} />;
};

export default CategoryIcon;
