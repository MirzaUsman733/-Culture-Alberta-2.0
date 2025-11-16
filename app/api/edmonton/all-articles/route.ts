import { NextRequest, NextResponse } from "next/server";
import { getPaginatedCityArticles } from "@/lib/data/city-category-data";

// Revalidate list responses frequently but not on every request
export const revalidate = 120;

// Lightweight DTO for listing articles (no heavy content field)
function mapToPreview(article: any) {
  return {
    id: article.id,
    title: article.title,
    excerpt: article.excerpt || "",
    category: article.category || "",
    categories: article.categories || [],
    location: article.location || "",
    author: article.author || "",
    tags: article.tags || [],
    type: article.type || "article",
    status: article.status || "published",
    imageUrl: article.image_url || article.imageUrl || "",
    date: article.created_at || article.date,
    createdAt: article.created_at || article.createdAt,
    updatedAt: article.updated_at || article.updatedAt || article.created_at,
    trendingHome: article.trending_home ?? article.trendingHome ?? false,
    trendingEdmonton: article.trending_edmonton ?? article.trendingEdmonton ?? false,
    trendingCalgary: article.trending_calgary ?? article.trendingCalgary ?? false,
    featuredHome: article.featured_home ?? article.featuredHome ?? false,
    featuredEdmonton: article.featured_edmonton ?? article.featuredEdmonton ?? false,
    featuredCalgary: article.featured_calgary ?? article.featuredCalgary ?? false,
    // IMPORTANT: never include `content` in list responses
    content: undefined,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
    const limit = Math.max(parseInt(searchParams.get("limit") || "30", 10), 1);

    const result = await getPaginatedCityArticles("edmonton", page, limit);
    const pageItems = result.items.map(mapToPreview);

    return NextResponse.json(
      {
        items: pageItems,
        page: result.page,
        totalPages: result.totalPages,
        total: result.total,
        limit: result.limit,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
        },
      }
    );
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Failed to load Edmonton articles list:", error);
    }

    return NextResponse.json(
      {
        error: "Failed to load Edmonton articles",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}


