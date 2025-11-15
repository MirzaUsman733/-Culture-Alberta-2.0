import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const pathsToRevalidate = [
      "/",
      "/edmonton",
      "/calgary",
      "/food-drink",
      "/culture",
      "/events",
      "/articles",
    ];

    pathsToRevalidate.forEach((path) => {
      revalidatePath(path);
    });

    revalidatePath("/articles/[slug]", "page");
    revalidatePath("/events/[slug]", "page");

    const tagsToRevalidate = ["articles", "events", "homepage", "city-pages"];

    tagsToRevalidate.forEach((tag) => {
      revalidateTag(tag);
    });

    return NextResponse.json({
      success: true,
      message: "All caches cleared and paths revalidated",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Error in force refresh:", error);
    }
    return NextResponse.json(
      {
        success: false,
        error: "Failed to refresh caches",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Force refresh endpoint - use POST to trigger refresh",
    timestamp: new Date().toISOString(),
  });
}
