import fs from "fs-extra";
import path from "path";
import pdf from "pdf-parse";
import mammoth from "mammoth";
import { v4 as uuidv4 } from "uuid";

export class DocumentProcessingService {
  constructor(chunkSize = 1000, chunkOverlap = 200) {
    this.chunkSize = chunkSize;
    this.chunkOverlap = chunkOverlap;
  }

  async extractTextFromFile(filePath, filename) {
    const extension = path.extname(filename).toLowerCase();

    try {
      switch (extension) {
        case ".pdf":
          return await this.extractFromPDF(filePath);
        case ".docx":
          return await this.extractFromDOCX(filePath);
        case ".doc":
          throw new Error(
            "DOC files are not supported. Please convert to DOCX format."
          );
        case ".txt":
          return await this.extractFromTXT(filePath);
        default:
          throw new Error(`Unsupported file format: ${extension}`);
      }
    } catch (error) {
      console.error(`Error extracting text from ${filename}:`, error);
      throw error;
    }
  }

  async extractFromPDF(filePath) {
    try {
      const dataBuffer = await fs.readFile(filePath);
      const data = await pdf(dataBuffer);
      return this.cleanText(data.text);
    } catch (error) {
      throw new Error(`Failed to parse PDF: ${error.message}`);
    }
  }

  async extractFromDOCX(filePath) {
    try {
      const { value: text } = await mammoth.extractRawText({ path: filePath });
      return this.cleanText(text);
    } catch (error) {
      throw new Error(`Failed to parse DOCX: ${error.message}`);
    }
  }

  async extractFromTXT(filePath) {
    try {
      const text = await fs.readFile(filePath, "utf-8");
      return this.cleanText(text);
    } catch (error) {
      throw new Error(`Failed to read TXT file: ${error.message}`);
    }
  }

  cleanText(text) {
    return (
      text
        // Remove extra whitespace and normalize line breaks
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        // Remove multiple consecutive spaces
        .replace(/[ \t]+/g, " ")
        // Remove multiple consecutive newlines (keep max 2)
        .replace(/\n{3,}/g, "\n\n")
        // Trim whitespace
        .trim()
    );
  }

  createTextChunks(text, documentId) {
    const chunks = [];
    const sentences = this.splitIntoSentences(text);

    let currentChunk = "";
    let chunkIndex = 0;

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const potentialChunk = currentChunk
        ? `${currentChunk} ${sentence}`
        : sentence;

      if (potentialChunk.length <= this.chunkSize) {
        currentChunk = potentialChunk;
      } else {
        // Save current chunk if it has content
        if (currentChunk.trim()) {
          chunks.push({
            id: uuidv4(),
            text: currentChunk.trim(),
            documentId,
            chunkIndex: chunkIndex++,
            wordCount: currentChunk.trim().split(/\s+/).length,
            startSentence: i - (currentChunk.split(/[.!?]+/).length - 1),
            endSentence: i - 1,
          });
        }

        // Start new chunk with current sentence
        currentChunk = sentence;

        // If single sentence is too long, split it by words
        if (sentence.length > this.chunkSize) {
          const words = sentence.split(/\s+/);
          let wordChunk = "";

          for (const word of words) {
            const potentialWordChunk = wordChunk
              ? `${wordChunk} ${word}`
              : word;

            if (potentialWordChunk.length <= this.chunkSize) {
              wordChunk = potentialWordChunk;
            } else {
              if (wordChunk.trim()) {
                chunks.push({
                  id: uuidv4(),
                  text: wordChunk.trim(),
                  documentId,
                  chunkIndex: chunkIndex++,
                  wordCount: wordChunk.trim().split(/\s+/).length,
                  isPartialSentence: true,
                  partialSentenceIndex: i,
                });
              }
              wordChunk = word;
            }
          }

          // Save remaining word chunk
          if (wordChunk.trim()) {
            chunks.push({
              id: uuidv4(),
              text: wordChunk.trim(),
              documentId,
              chunkIndex: chunkIndex++,
              wordCount: wordChunk.trim().split(/\s+/).length,
              isPartialSentence: true,
              partialSentenceIndex: i,
            });
          }
          currentChunk = "";
        }
      }
    }

    // Add final chunk
    if (currentChunk.trim()) {
      chunks.push({
        id: uuidv4(),
        text: currentChunk.trim(),
        documentId,
        chunkIndex: chunkIndex++,
        wordCount: currentChunk.trim().split(/\s+/).length,
        startSentence:
          sentences.length - (currentChunk.split(/[.!?]+/).length - 1),
        endSentence: sentences.length - 1,
      });
    }

    console.log(`Created ${chunks.length} chunks with overlap strategy`);

    // Add overlap between chunks
    return this.addOverlapToChunks(chunks);
  }

  splitIntoSentences(text) {
    // Simple sentence splitting - can be improved with more sophisticated NLP
    return text
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 10); // Filter out very short fragments
  }

  addOverlapToChunks(chunks) {
    if (chunks.length <= 1) return chunks;

    const chunksWithOverlap = [chunks[0]]; // First chunk stays the same

    for (let i = 1; i < chunks.length; i++) {
      const currentChunk = chunks[i];
      const previousChunk = chunks[i - 1];

      // Get overlap text from previous chunk (last N characters)
      let overlapText = "";
      if (previousChunk.text.length > this.chunkOverlap) {
        // Take the last `chunkOverlap` characters from previous chunk
        overlapText = previousChunk.text.slice(-this.chunkOverlap);

        // Try to start overlap at a word boundary to avoid splitting words
        const spaceIndex = overlapText.indexOf(" ");
        if (spaceIndex > 0 && spaceIndex < this.chunkOverlap * 0.3) {
          // If we find a space within the first 30% of overlap, start from there
          overlapText = overlapText.slice(spaceIndex + 1);
        }
      } else {
        // If previous chunk is shorter than overlap size, use entire previous chunk
        overlapText = previousChunk.text;
      }

      // Prepend overlap to current chunk
      const enhancedText = overlapText
        ? `${overlapText} ${currentChunk.text}`
        : currentChunk.text;

      chunksWithOverlap.push({
        ...currentChunk,
        text: enhancedText,
        wordCount: enhancedText.split(/\s+/).length,
        overlapSize: overlapText.length, // Track actual overlap size for debugging
      });
    }

    return chunksWithOverlap;
  }

  extractMetadata(text, filename) {
    const metadata = {
      filename,
      wordCount: text.split(/\s+/).length,
      characterCount: text.length,
      estimatedReadingTime: Math.ceil(text.split(/\s+/).length / 200), // 200 WPM average
      processedAt: new Date().toISOString(),
    };

    // Try to extract some basic metadata from content
    const lines = text.split("\n");
    const firstFewLines = lines.slice(0, 10).join(" ");

    // Look for common IT/networking keywords
    const keywords = this.extractKeywords(text);
    if (keywords.length > 0) {
      metadata.keywords = keywords.slice(0, 10); // Top 10 keywords
    }

    // Try to identify document type based on content
    metadata.documentType = this.identifyDocumentType(firstFewLines);

    return metadata;
  }

  extractKeywords(text) {
    // IT and networking specific keywords
    const itKeywords = [
      "network",
      "server",
      "router",
      "switch",
      "firewall",
      "vpn",
      "dns",
      "dhcp",
      "tcp",
      "udp",
      "ip",
      "subnet",
      "vlan",
      "api",
      "database",
      "security",
      "authentication",
      "authorization",
      "ssl",
      "tls",
      "https",
      "configuration",
      "monitoring",
      "backup",
      "recovery",
      "disaster",
      "load balancer",
      "proxy",
      "bandwidth",
      "latency",
      "throughput",
      "protocol",
      "ethernet",
      "wifi",
      "infrastructure",
      "datacenter",
      "cloud",
      "aws",
      "azure",
      "kubernetes",
      "docker",
      "container",
      "virtualization",
      "hypervisor",
      "storage",
    ];

    const textLower = text.toLowerCase();
    const foundKeywords = [];

    for (const keyword of itKeywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, "gi");
      const matches = textLower.match(regex);
      if (matches && matches.length > 2) {
        // Only include if mentioned multiple times
        foundKeywords.push({
          keyword,
          count: matches.length,
        });
      }
    }

    return foundKeywords
      .sort((a, b) => b.count - a.count)
      .map((item) => item.keyword);
  }

  identifyDocumentType(text) {
    const textLower = text.toLowerCase();

    if (textLower.includes("policy") || textLower.includes("procedure")) {
      return "policy";
    } else if (textLower.includes("manual") || textLower.includes("guide")) {
      return "manual";
    } else if (
      textLower.includes("configuration") ||
      textLower.includes("config")
    ) {
      return "configuration";
    } else if (
      textLower.includes("troubleshoot") ||
      textLower.includes("problem")
    ) {
      return "troubleshooting";
    } else if (
      textLower.includes("specification") ||
      textLower.includes("requirement")
    ) {
      return "specification";
    }

    return "general";
  }
}

export default DocumentProcessingService;
