#!/usr/bin/env node

import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import DocumentProcessingService from "../src/services/DocumentProcessingService.js";
import OllamaService from "../src/services/OllamaService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DocumentIngestionService {
  constructor() {
    this.documentProcessor = new DocumentProcessingService();
    this.ollamaService = new OllamaService();
    this.inputDir = path.join(__dirname, "../data/documents");
    this.outputDir = path.join(__dirname, "../data/processed");
    this.outputFile = path.join(this.outputDir, "knowledge_base.jsonl");
  }

  async init() {
    // Ensure directories exist
    await fs.ensureDir(this.inputDir);
    await fs.ensureDir(this.outputDir);

    console.log("🚀 Document Ingestion Service Started");
    console.log(`📁 Input Directory: ${this.inputDir}`);
    console.log(`📊 Output File: ${this.outputFile}`);
  }

  async checkOllamaConnection() {
    console.log("🔍 Checking Ollama connection...");

    const isAvailable = await this.ollamaService.isAvailable();
    if (!isAvailable) {
      throw new Error(
        "❌ Ollama is not available. Please ensure Ollama is running on localhost:11434"
      );
    }

    const modelCheck = await this.ollamaService.checkModelsAvailable();
    if (!modelCheck.available) {
      console.warn("⚠️  Required models not found:");
      if (!modelCheck.embeddingModel) {
        console.warn("   - Missing embedding model: nomic-embed-text");
      }
      if (!modelCheck.llmModel) {
        console.warn("   - Missing LLM model: llama3.1:8b");
      }
      console.log(
        "   Run: ollama pull nomic-embed-text && ollama pull llama3.1:8b"
      );
      throw new Error("Required models not available");
    }

    console.log("✅ Ollama connection established");
    console.log("✅ All required models are available");
  }

  async findDocuments() {
    console.log("🔍 Scanning for documents...");

    const supportedExtensions = [".pdf", ".docx", ".txt"];
    const documents = [];

    const files = await fs.readdir(this.inputDir);

    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (supportedExtensions.includes(ext)) {
        const filePath = path.join(this.inputDir, file);
        const stats = await fs.stat(filePath);

        documents.push({
          filename: file,
          path: filePath,
          size: stats.size,
          modified: stats.mtime,
        });
      }
    }

    console.log(`📄 Found ${documents.length} documents to process`);
    return documents;
  }

  async processDocument(doc) {
    console.log(`\n📝 Processing: ${doc.filename}`);

    try {
      // Extract text from document
      console.log("  📄 Extracting text...");
      const text = await this.documentProcessor.extractTextFromFile(
        doc.path,
        doc.filename
      );

      if (!text || text.trim().length === 0) {
        throw new Error("No text content extracted");
      }

      console.log(`  📋 Text extracted: ${text.length} characters`);

      // Create chunks
      console.log("  🔪 Creating chunks...");
      const chunks = this.documentProcessor.createTextChunks(
        text,
        doc.filename
      );
      console.log(`  📦 Created ${chunks.length} chunks`);

      // Generate embeddings for each chunk
      console.log("  🔢 Generating embeddings...");
      const processedChunks = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];

        try {
          const embedding = await this.ollamaService.getEmbedding(chunk.text);

          processedChunks.push({
            id: chunk.id,
            text: chunk.text,
            document_name: doc.filename,
            chunk_index: chunk.chunkIndex,
            word_count: chunk.wordCount,
            embedding: embedding,
            processed_at: new Date().toISOString(),
          });

          // Progress indicator
          if ((i + 1) % 5 === 0 || i === chunks.length - 1) {
            console.log(`    Processed ${i + 1}/${chunks.length} chunks`);
          }
        } catch (error) {
          console.error(
            `    ❌ Error processing chunk ${i + 1}:`,
            error.message
          );
        }
      }

      // Extract metadata
      const metadata = this.documentProcessor.extractMetadata(
        text,
        doc.filename
      );

      console.log(
        `  ✅ Successfully processed: ${processedChunks.length}/${chunks.length} chunks`
      );

      return {
        document_name: doc.filename,
        document_path: doc.path,
        processed_at: new Date().toISOString(),
        total_chunks: processedChunks.length,
        metadata: metadata,
        chunks: processedChunks,
      };
    } catch (error) {
      console.error(`  ❌ Error processing ${doc.filename}:`, error.message);
      return null;
    }
  }

  async writeToJSONL(processedDocuments) {
    console.log(
      `\n💾 Writing ${processedDocuments.length} documents to JSONL...`
    );

    // Clear existing file
    if (await fs.pathExists(this.outputFile)) {
      await fs.remove(this.outputFile);
    }

    let totalChunks = 0;

    for (const doc of processedDocuments) {
      if (!doc) continue;

      // Write document metadata
      const docMetadata = {
        type: "document",
        document_name: doc.document_name,
        document_path: doc.document_path,
        processed_at: doc.processed_at,
        total_chunks: doc.total_chunks,
        metadata: doc.metadata,
      };

      await fs.appendFile(this.outputFile, JSON.stringify(docMetadata) + "\n");

      // Write each chunk
      for (const chunk of doc.chunks) {
        const chunkData = {
          type: "chunk",
          ...chunk,
        };
        await fs.appendFile(this.outputFile, JSON.stringify(chunkData) + "\n");
        totalChunks++;
      }
    }

    console.log(`✅ Successfully wrote knowledge base to JSONL`);
    console.log(`   📄 Documents: ${processedDocuments.length}`);
    console.log(`   📦 Total chunks: ${totalChunks}`);
    console.log(`   💾 Output file: ${this.outputFile}`);
  }

  async generateSummaryStats(processedDocuments) {
    const validDocs = processedDocuments.filter((doc) => doc !== null);
    const totalChunks = validDocs.reduce(
      (sum, doc) => sum + doc.total_chunks,
      0
    );
    const totalWords = validDocs.reduce(
      (sum, doc) => sum + (doc.metadata?.wordCount || 0),
      0
    );

    const summary = {
      ingestion_completed_at: new Date().toISOString(),
      total_documents: validDocs.length,
      failed_documents: processedDocuments.length - validDocs.length,
      total_chunks: totalChunks,
      total_words: totalWords,
      documents: validDocs.map((doc) => ({
        name: doc.document_name,
        chunks: doc.total_chunks,
        words: doc.metadata?.wordCount || 0,
        type: doc.metadata?.documentType || "general",
      })),
    };

    const summaryFile = path.join(this.outputDir, "ingestion_summary.json");
    await fs.writeJson(summaryFile, summary, { spaces: 2 });

    console.log("\n📊 Ingestion Summary:");
    console.log(`   📄 Total Documents: ${summary.total_documents}`);
    console.log(`   ❌ Failed Documents: ${summary.failed_documents}`);
    console.log(`   📦 Total Chunks: ${summary.total_chunks}`);
    console.log(`   📝 Total Words: ${summary.total_words.toLocaleString()}`);
    console.log(`   💾 Summary saved to: ${summaryFile}`);
  }

  async run() {
    try {
      await this.init();
      await this.checkOllamaConnection();

      const documents = await this.findDocuments();

      if (documents.length === 0) {
        console.log("📭 No documents found to process.");
        console.log(`   Place PDF, DOCX, or TXT files in: ${this.inputDir}`);
        return;
      }

      const processedDocuments = [];

      for (const doc of documents) {
        const result = await this.processDocument(doc);
        processedDocuments.push(result);
      }

      await this.writeToJSONL(processedDocuments);
      await this.generateSummaryStats(processedDocuments);

      console.log("\n🎉 Document ingestion completed successfully!");
      console.log("   You can now start the user app with: npm run app");
    } catch (error) {
      console.error("\n❌ Ingestion failed:", error.message);
      process.exit(1);
    }
  }
}

// Run ingestion if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const ingestionService = new DocumentIngestionService();
  await ingestionService.run();
}

export default DocumentIngestionService;
