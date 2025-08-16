import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface Document {
  id: number;
  text: string;
}

interface SearchRequest {
  query: string;
  documents: Document[];
}

// Calculate cosine similarity between two vectors
function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

export async function POST(request: NextRequest) {
  try {
    const body: SearchRequest = await request.json();
    const { query, documents } = body;

    if (!query || !documents || documents.length === 0) {
      return NextResponse.json(
        { error: "Query and documents are required" },
        { status: 400 }
      );
    }

    // Generate embedding for the search query
    const queryEmbeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query,
    });

    const queryEmbedding = queryEmbeddingResponse.data[0].embedding;

    // Generate embeddings for all documents
    const documentTexts = documents.map((doc) => doc.text);
    const documentEmbeddingsResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: documentTexts,
    });

    const documentEmbeddings = documentEmbeddingsResponse.data.map(
      (item) => item.embedding
    );

    // Calculate similarities and create results
    const matches = documents
      .map((doc, index) => {
        const similarity = cosineSimilarity(
          queryEmbedding,
          documentEmbeddings[index]
        );
        return {
          id: doc.id,
          score: similarity,
          text: doc.text,
        };
      })
      .filter((match) => match.score > 0.3) // Filter by similarity threshold
      .sort((a, b) => b.score - a.score); // Sort by highest similarity first

    return NextResponse.json({
      query,
      matches,
      total: matches.length,
    });
  } catch (error) {
    console.error("Semantic search error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
