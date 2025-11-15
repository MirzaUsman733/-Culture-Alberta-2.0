import { loadOptimizedFallback } from "@/lib/optimized-fallback";
import { NextResponse } from "next/server";

export const revalidate = 60;

export async function GET() {
  try {
    const fallbackArticles = await loadOptimizedFallback();
    const calgaryArticles = fallbackArticles.filter((article) => {
      if (article.type === "event") return false;

      const cityLower = "calgary";
      const category = article.category?.toLowerCase() || "";
      const location = article.location?.toLowerCase() || "";
      const categories = article.categories || [];
      const tags = article.tags || [];

      return (
        category.includes(cityLower) ||
        location.includes(cityLower) ||
        categories.some((cat: string) =>
          cat.toLowerCase().includes(cityLower)
        ) ||
        tags.some((tag: string) => tag.toLowerCase().includes(cityLower))
      );
    });

    return NextResponse.json(calgaryArticles, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Failed to load Calgary articles:", error);
    }
    return NextResponse.json([], {
      status: 500,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  }
}
