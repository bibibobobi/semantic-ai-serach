import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { Pinecone } from "@pinecone-database/pinecone";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

interface SearchRequest {
  query: string;
  topK?: number;
  includeMetadata?: boolean;
  filter?: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  try {
    const body: SearchRequest = await request.json();
    const { query, topK = 10, includeMetadata = true, filter } = body;

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: "Query is required and cannot be empty" },
        { status: 400 }
      );
    }

    // Check if we have OpenAI API key for real embeddings
    if (!process.env.OPENAI_API_KEY) {
      console.warn("OpenAI API key not found, using fallback search");
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    // Step 1: Generate embedding for the search query
    console.log("🔍 Generating embedding for query:", query);

    const queryEmbeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query,
    });

    const queryEmbedding = queryEmbeddingResponse.data[0].embedding;

    // Step 2: Search Pinecone for similar vectors
    console.log("🔍 Searching Pinecone index...");

    const index = pinecone.index("podcast-search");

    const searchResponse = await index.query({
      vector: queryEmbedding,
      topK: topK,
      includeMetadata: includeMetadata,
      ...(filter && { filter }),
    });

    // Step 3: Format and return results
    const matches =
      searchResponse.matches?.map((match) => ({
        id: match.id,
        score: match.score || 0,
        metadata: match.metadata || {},
      })) || [];

    console.log(`✅ Found ${matches.length} matches for query: "${query}"`);

    return NextResponse.json({
      query,
      matches,
      total: matches.length,
      status: "success",
    });
  } catch (error: unknown) {
    console.error("Pinecone search error:", error);

    // Return specific error information
    let errorMessage = "Internal server error";
    let statusCode = 500;

    let errorMessageText = "";
    if (
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof (error as Error).message === "string"
    ) {
      errorMessageText = (error as Error).message;
    }

    if (
      errorMessageText.includes("quota") ||
      errorMessageText.includes("429")
    ) {
      errorMessage = "OpenAI API quota exceeded";
      statusCode = 429;
    } else if (errorMessageText.includes("Pinecone")) {
      errorMessage = "Pinecone database error";
    } else if (
      errorMessageText.includes("network") ||
      errorMessageText.includes("fetch")
    ) {
      errorMessage = "Network connection error";
    }

    return NextResponse.json(
      {
        error: errorMessage,
        details:
          process.env.NODE_ENV === "development" ? errorMessageText : undefined,
        status: "error",
      },
      { status: statusCode }
    );
  }
}
