import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAppSettings } from "@/hooks/useStore";

declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer: any[];
    fbq: (...args: any[]) => void;
    _fbq: any;
  }
}

/**
 * Injects GA4 and Facebook Pixel scripts dynamically from app_settings.
 * Tracks page views on route changes.
 */
const Analytics = () => {
  const { data: settings } = useAppSettings();
  const location = useLocation();
  const ga4Id = settings?.seo_ga4_measurement_id;
  const fbPixelId = settings?.seo_facebook_pixel_id;

  // GA4 init
  useEffect(() => {
    if (!ga4Id) return;
    if (document.getElementById("ga4-script")) return;

    const script = document.createElement("script");
    script.id = "ga4-script";
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${ga4Id}`;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", ga4Id, { send_page_view: false });
  }, [ga4Id]);

  // Facebook Pixel init
  useEffect(() => {
    if (!fbPixelId) return;
    if (document.getElementById("fb-pixel-script")) return;

    const script = document.createElement("script");
    script.id = "fb-pixel-script";
    script.textContent = `
      !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
      n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
      (window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
      fbq('init','${fbPixelId}');
    `;
    document.head.appendChild(script);
  }, [fbPixelId]);

  // Track page views on route change
  useEffect(() => {
    if (ga4Id && window.gtag) {
      window.gtag("event", "page_view", {
        page_path: location.pathname + location.search,
        page_title: document.title,
      });
    }
    if (fbPixelId && window.fbq) {
      window.fbq("track", "PageView");
    }
  }, [location, ga4Id, fbPixelId]);

  return null;
};

export default Analytics;

/**
 * Track e-commerce events
 */
export const trackAddToCart = (product: any, quantity: number) => {
  if (window.gtag) {
    window.gtag("event", "add_to_cart", {
      currency: "COP",
      value: product.price * quantity,
      items: [{ item_id: product.id, item_name: product.name, price: product.price, quantity }],
    });
  }
  if (window.fbq) {
    window.fbq("track", "AddToCart", {
      content_ids: [product.id],
      content_name: product.name,
      content_type: "product",
      value: product.price * quantity,
      currency: "COP",
    });
  }
};

export const trackPurchase = (orderNumber: number, total: number, items: any[]) => {
  if (window.gtag) {
    window.gtag("event", "purchase", {
      transaction_id: `SURTE-${orderNumber}`,
      currency: "COP",
      value: total,
      items: items.map((i) => ({ item_id: i.product_id, item_name: i.name, price: i.price, quantity: i.quantity })),
    });
  }
  if (window.fbq) {
    window.fbq("track", "Purchase", {
      content_ids: items.map((i) => i.product_id),
      content_type: "product",
      value: total,
      currency: "COP",
      num_items: items.length,
    });
  }
};

export const trackViewProduct = (product: any) => {
  if (window.gtag) {
    window.gtag("event", "view_item", {
      currency: "COP",
      value: product.price,
      items: [{ item_id: product.id, item_name: product.name, price: product.price }],
    });
  }
  if (window.fbq) {
    window.fbq("track", "ViewContent", {
      content_ids: [product.id],
      content_name: product.name,
      content_type: "product",
      value: product.price,
      currency: "COP",
    });
  }
};
