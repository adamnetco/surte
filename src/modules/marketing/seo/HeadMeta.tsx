import { useEffect } from "react";

interface HeadMetaProps {
  title: string;
  description: string;
  canonical?: string;
  ogImage?: string;
  ogType?: string;
  noindex?: boolean;
}

/**
 * Dynamically sets document <head> meta tags for SEO.
 * Cleans up on unmount by restoring defaults.
 */
const HeadMeta = ({ title, description, canonical, ogImage, ogType = "website", noindex }: HeadMetaProps) => {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title;

    const setMeta = (attr: string, key: string, content: string) => {
      let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.content = content;
    };

    setMeta("name", "description", description);
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
    setMeta("property", "og:type", ogType);
    setMeta("name", "twitter:title", title);
    setMeta("name", "twitter:description", description);

    if (ogImage) {
      setMeta("property", "og:image", ogImage);
      setMeta("name", "twitter:image", ogImage);
    }

    if (noindex) {
      setMeta("name", "robots", "noindex,nofollow");
    }

    // Canonical link
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (canonical) {
      if (!link) {
        link = document.createElement("link");
        link.rel = "canonical";
        document.head.appendChild(link);
      }
      link.href = canonical;
    }

    return () => {
      document.title = prevTitle;
      if (link && canonical) link.remove();
    };
  }, [title, description, canonical, ogImage, ogType, noindex]);

  return null;
};

export default HeadMeta;
