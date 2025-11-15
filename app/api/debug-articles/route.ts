import { loadOptimizedFallback } from "@/lib/optimized-fallback";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const articles = await loadOptimizedFallback();
    const recentArticles = articles
      .sort(
        (a, b) =>
          new Date(b.createdAt || b.date || 0).getTime() -
          new Date(a.createdAt || a.date || 0).getTime()
      )
      .slice(0, 5)
      .map((article) => ({
        id: article.id,
        title: article.title,
        type: article.type,
        createdAt: article.createdAt || article.date,
        status: article.status,
      }));

    return NextResponse.json({
      total: articles.length,
      recent: recentArticles,
      message: "Debug info loaded",
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Debug failed:", error);
    }
    return NextResponse.json(
      {
        error: "Debug failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
