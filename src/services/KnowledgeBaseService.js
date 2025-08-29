import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import readline from "readline";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class KnowledgeBaseService {
  constructor() {
    this.knowledgeFile = path.join(
      __dirname,
      "../../data/processed/knowledge_base.jsonl"
    );
    this.summaryFile = path.join(
      __dirname,
      "../../data/processed/ingestion_summary.json"
    );
    this.chunks = [];
    this.documents = [];
    this.loaded = false;
  }

  async loadKnowledgeBase() {
    if (this.loaded) return true;

    if (!(await fs.pathExists(this.knowledgeFile))) {
      // Don't throw error, just return false to indicate KB is not available
      console.log("❌ Knowledge base file not found:", this.knowledgeFile);
      return false;
    }

    console.log("📚 Loading knowledge base...");

    try {
      this.chunks = [];
      this.documents = [];

      const fileStream = fs.createReadStream(this.knowledgeFile);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity,
      });

      let chunkCount = 0;
      let docCount = 0;

      for await (const line of rl) {
        if (line.trim()) {
          try {
            const data = JSON.parse(line);

            if (data.type === "document") {
              this.documents.push(data);
              docCount++;
            } else if (data.type === "chunk") {
              this.chunks.push(data);
              chunkCount++;
            }
          } catch (error) {
            console.error("Error parsing line:", error.message);
          }
        }
      }

      console.log(`✅ Knowledge base loaded:`);
      console.log(`   📄 Documents: ${docCount}`);
      console.log(`   📦 Chunks: ${chunkCount}`);

      this.loaded = true;
      return true;
    } catch (error) {
      console.error("❌ Error loading knowledge base:", error);
      this.loaded = false;
      return false;
    }
  }

  async getStats() {
    const loaded = await this.loadKnowledgeBase();

    if (!loaded) {
      return {
        documents: 0,
        chunks: 0,
        totalWords: 0,
        lastIngestion: null,
        documentDetails: [],
        knowledgeBaseAvailable: false,
        message:
          "No knowledge base found. Run 'npm run ingest' to process your documents.",
      };
    }

    let summary = {};
    if (await fs.pathExists(this.summaryFile)) {
      summary = await fs.readJson(this.summaryFile);
    }

    return {
      documents: this.documents.length,
      chunks: this.chunks.length,
      totalWords: summary.total_words || 0,
      lastIngestion: summary.ingestion_completed_at || null,
      documentDetails: summary.documents || [],
      knowledgeBaseAvailable: true,
    };
  }

  cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  async searchSimilarChunks(queryEmbedding, topK = 5, threshold = 0.1) {
    const loaded = await this.loadKnowledgeBase();

    if (!loaded) {
      return [];
    }

    const results = [];

    for (const chunk of this.chunks) {
      const similarity = this.cosineSimilarity(queryEmbedding, chunk.embedding);

      if (similarity >= threshold) {
        results.push({
          id: chunk.id,
          similarity,
          text: chunk.text,
          documentName: chunk.document_name,
          chunkIndex: chunk.chunk_index,
          wordCount: chunk.word_count,
        });
      }
    }

    // Sort by similarity (descending) and return top K
    return results.sort((a, b) => b.similarity - a.similarity).slice(0, topK);
  }

  async searchDocuments(query, limit = 10) {
    const loaded = await this.loadKnowledgeBase();

    if (!loaded) {
      return [];
    }

    const queryLower = query.toLowerCase();
    const results = [];

    for (const chunk of this.chunks) {
      if (chunk.text.toLowerCase().includes(queryLower)) {
        results.push({
          documentName: chunk.document_name,
          similarity: 1.0, // Perfect text match
          preview: chunk.text.substring(0, 300) + "...",
          chunkIndex: chunk.chunk_index,
        });

        if (results.length >= limit) break;
      }
    }

    return results;
  }

  getDocumentsList() {
    return this.documents.map((doc) => ({
      name: doc.document_name,
      processedAt: doc.processed_at,
      totalChunks: doc.total_chunks,
      metadata: doc.metadata,
    }));
  }

  async isKnowledgeBaseAvailable() {
    return await fs.pathExists(this.knowledgeFile);
  }
}

// Singleton instance
let knowledgeBaseService = null;

export const getKnowledgeBaseService = () => {
  if (!knowledgeBaseService) {
    knowledgeBaseService = new KnowledgeBaseService();
  }
  return knowledgeBaseService;
};

export default KnowledgeBaseService;
