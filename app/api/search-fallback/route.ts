import { NextRequest, NextResponse } from "next/server";
import { Pinecone } from "@pinecone-database/pinecone";

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

// Simple local embedding function (same as in setup script)
function createLocalEmbedding(text: string, dimension = 1536): number[] {
  const normalizedText = text
    .toLowerCase()
    .replace(/[^\u4e00-\u9fff\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = normalizedText.split(" ").filter((w) => w.length > 0);
  const embedding = new Array(dimension).fill(0);

  words.forEach((word, index) => {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      const char = word.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }

    const pos1 = Math.abs(hash) % dimension;
    const pos2 = Math.abs(hash * 31) % dimension;
    const pos3 = Math.abs(hash * 37) % dimension;

    const weight = Math.min(1, Math.log(word.length + 1) / 3);
    embedding[pos1] += weight;
    embedding[pos2] += weight * 0.7;
    embedding[pos3] += weight * 0.5;
  });

  // Add semantic features for Chinese content
  const semanticFeatures: Record<string, number[]> = {
    美食: [100, 200, 300],
    旅遊: [150, 250, 350],
    投資: [400, 500, 600],
    財經: [450, 550, 650],
    科技: [700, 800, 900],
    企業: [750, 850, 950],
    社會: [1000, 1100, 1200],
    娛樂: [1300, 1400, 1500],
  };

  Object.entries(semanticFeatures).forEach(([keyword, positions]) => {
    if (normalizedText.includes(keyword)) {
      positions.forEach((pos) => {
        if (pos < dimension) {
          embedding[pos] += 2.0;
        }
      });
    }
  });

  // Normalize
  const magnitude = Math.sqrt(
    embedding.reduce((sum, val) => sum + val * val, 0)
  );
  if (magnitude > 0) {
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] /= magnitude;
    }
  }

  return embedding;
}

interface SearchRequest {
  query: string;
  topK?: number;
  includeMetadata?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body: SearchRequest = await request.json();
    const { query, topK = 10, includeMetadata = true } = body;

    if (!query || query.trim().length === 0) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    console.log("🔍 Using fallback search for query:", query);

    // Generate local embedding (no OpenAI API call)
    const queryEmbedding = createLocalEmbedding(query);

    // Search Pinecone with local embedding
    const index = pinecone.index("podcast-search");

    const searchResponse = await index.query({
      vector: queryEmbedding,
      topK: topK,
      includeMetadata: includeMetadata,
    });

    const matches =
      searchResponse.matches?.map((match) => ({
        id: match.id,
        score: (match.score || 0) * 0.8, // Slightly lower scores for local embeddings
        metadata: match.metadata || {},
      })) || [];

    console.log(`✅ Fallback search found ${matches.length} matches`);

    return NextResponse.json({
      query,
      matches,
      total: matches.length,
      status: "success",
      method: "fallback",
    });
  } catch (error: unknown) {
    console.error("Fallback search error:", error);

    return NextResponse.json(
      {
        error: "Fallback search failed",
        details:
          process.env.NODE_ENV === "development" && error instanceof Error
            ? error.message
            : undefined,
        status: "error",
      },
      { status: 500 }
    );
  }
}
