import { loadOptimizedFallback } from "@/lib/optimized-fallback";
import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

interface SupabaseArticleRow {
  id: string;
  title: string;
  excerpt?: string | null;
  category?: string | null;
  categories?: string[] | null;
  location?: string | null;
  author?: string | null;
  tags?: string[] | null;
  type?: string | null;
  status?: string | null;
  created_at: string;
  updated_at?: string | null;
  trending_home?: boolean | null;
  trending_edmonton?: boolean | null;
  trending_calgary?: boolean | null;
  featured_home?: boolean | null;
  featured_edmonton?: boolean | null;
  featured_calgary?: boolean | null;
  image_url?: string | null;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get("refresh") === "true";

    // Parse query parameters with defaults
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "10", 10))
    );
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category") || "";
    const location = searchParams.get("location") || "";
    const sortBy = searchParams.get("sortBy") || "newest";

    const offset = (page - 1) * limit;

    const fallbackArticles = await loadOptimizedFallback();

    // Apply filters to fallback data
    let filtered = fallbackArticles;

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (article) =>
          article.title.toLowerCase().includes(searchLower) ||
          (article.excerpt &&
            article.excerpt.toLowerCase().includes(searchLower))
      );
    }

    if (category && category !== "all") {
      filtered = filtered.filter((article) => article.category === category);
    }

    if (location && location !== "all") {
      filtered = filtered.filter((article) => article.location === location);
    }

    // Apply sorting
    switch (sortBy) {
      case "oldest":
        filtered.sort(
          (a, b) =>
            new Date(a.createdAt || a.date || 0).getTime() -
            new Date(b.createdAt || b.date || 0).getTime()
        );
        break;
      case "title":
        filtered.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "newest":
      default:
        filtered.sort(
          (a, b) =>
            new Date(b.createdAt || b.date || 0).getTime() -
            new Date(a.createdAt || a.date || 0).getTime()
        );
        break;
    }

    // Apply pagination
    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + limit);

    // Map fallback data to match admin interface expectations
    const articles = paginated.map((article) => ({
      ...article,
      imageUrl: article.imageUrl,
      date: article.date || article.createdAt,
      trendingHome: article.trendingHome ?? false,
      trendingEdmonton: article.trendingEdmonton ?? false,
      trendingCalgary: article.trendingCalgary ?? false,
      featuredHome: article.featuredHome ?? false,
      featuredEdmonton: article.featuredEdmonton ?? false,
      featuredCalgary: article.featuredCalgary ?? false,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt || article.createdAt,
    }));

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json(
      {
        articles,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    // Return empty result instead of error to prevent admin dashboard crash
    return NextResponse.json(
      {
        articles: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "X-Content-Type-Options": "nosniff",
        },
      }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { id?: unknown };
    const { id } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "Invalid article ID" },
        { status: 400 }
      );
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
      return NextResponse.json(
        { error: "Invalid article ID format" },
        { status: 400 }
      );
    }

    const { error: deleteError } = await supabase
      .from("articles")
      .delete()
      .eq("id", id);

    if (deleteError) {
      // If Supabase delete fails, don't update fallback
      // This prevents data inconsistency
      return NextResponse.json(
        { error: "Failed to delete article from database" },
        { status: 500 }
      );
    }

    setImmediate(async () => {
      try {
        const { loadOptimizedFallback, updateOptimizedFallback } = await import(
          "@/lib/optimized-fallback"
        );
        const allArticles = await loadOptimizedFallback();
        const filteredArticles = allArticles.filter(
          (article) => article.id !== id
        );
        await updateOptimizedFallback(filteredArticles);
      } catch (fallbackError) {
        // Log error but don't fail the request
        // Fallback update is not critical for delete operation
        if (process.env.NODE_ENV === "development") {
          console.error(
            "Failed to update fallback after delete:",
            fallbackError
          );
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: "Article deleted successfully",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to delete article",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
