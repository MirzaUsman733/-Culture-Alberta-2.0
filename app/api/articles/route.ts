import { loadOptimizedFallback } from "@/lib/optimized-fallback";
import { NextRequest, NextResponse } from "next/server";

export const revalidate = 60;

export async function GET(request: NextRequest) {
  try {
    const fallbackArticles = await loadOptimizedFallback();

    const { searchParams } = new URL(request.url);
    const articleId = searchParams.get("id");

    if (articleId) {
      const article = fallbackArticles.find(
        (article: any) => article.id === articleId
      );

      if (article) {
        return NextResponse.json(article, {
          headers: {
            "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
          },
        });
      } else {
        return NextResponse.json(
          { error: "Article not found" },
          {
            status: 404,
            headers: {
              "Cache-Control": "no-store",
            },
          }
        );
      }
    }

    return NextResponse.json(fallbackArticles, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Failed to load articles:", error);
    }
    return NextResponse.json(
      {
        error: "Failed to load articles",
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
