import { Link } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import JsonLd from "./JsonLd";
import { Home } from "lucide-react";

export interface BreadcrumbSegment {
  label: string;
  href?: string;
}

interface SeoBreadcrumbsProps {
  items: BreadcrumbSegment[];
  className?: string;
}

const BASE_URL = typeof window !== "undefined" ? window.location.origin : "";

const SeoBreadcrumbs = ({ items, className }: SeoBreadcrumbsProps) => {
  const allItems: BreadcrumbSegment[] = [{ label: "Inicio", href: "/" }, ...items];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: allItems.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.label,
      item: item.href ? `${BASE_URL}${item.href}` : undefined,
    })),
  };

  return (
    <>
      <JsonLd data={jsonLd} id="breadcrumb" />
      <nav aria-label="Breadcrumb" className={className}>
        <Breadcrumb>
          <BreadcrumbList className="text-xs">
            {allItems.map((seg, i) => {
              const isLast = i === allItems.length - 1;
              return (
                <span key={i} className="inline-flex items-center gap-1.5">
                  {i > 0 && <BreadcrumbSeparator />}
                  <BreadcrumbItem>
                    {isLast ? (
                      <BreadcrumbPage>{seg.label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <Link to={seg.href || "/"}>
                          {i === 0 ? <Home size={12} className="inline -mt-0.5" /> : null}
                          {i === 0 ? null : seg.label}
                        </Link>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </span>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      </nav>
    </>
  );
};

export default SeoBreadcrumbs;
