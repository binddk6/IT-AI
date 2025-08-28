import { getKnowledgeBaseService } from "./KnowledgeBaseService.js";
import OllamaService from "./OllamaService.js";

export class ChatService {
  constructor() {
    this.knowledgeBaseService = getKnowledgeBaseService();
    this.ollamaService = new OllamaService();
    this.chatHistory = new Map(); // Simple in-memory chat history for MVP
  }

  async processQuery(query, sessionId = "default", options = {}) {
    try {
      const {
        includeContext = true,
        maxContextChunks = 5,
        contextThreshold = 0.1,
        maxTokens = 2048,
      } = options;

      console.log(`🔍 Processing query: "${query}"`);

      let context = "";
      let contextSources = [];

      if (includeContext) {
        // Check if knowledge base is available first
        const isKBAvailable =
          await this.knowledgeBaseService.isKnowledgeBaseAvailable();

        if (!isKBAvailable) {
          // Return helpful message when knowledge base is not available
          return {
            response:
              "## No Documents Available\n\nI don't have any processed documents to search through yet. To get started with your **IT Infrastructure Assistant**:\n\n### Getting Started Steps:\n1. Place your **PDF, DOCX, or TXT files** in the `data/documents/` folder\n2. Run `npm run ingest` to process them\n3. **Ask me questions** about your documentation!\n\n### What I Can Help With:\n- Network configuration and troubleshooting\n- Server infrastructure guidance  \n- Security policies and procedures\n- IT best practices and standards\n- Technical documentation queries\n\n*I'll be able to provide detailed, organized answers based on your IT infrastructure and networking documents once they're processed.*",
            contextSources: [],
            hasContext: false,
            contextChunks: 0,
            sessionId,
            needsIngestion: true,
          };
        }

        // Generate embedding for the query
        const queryEmbedding = await this.ollamaService.getEmbedding(query);

        // Search for relevant context
        const relevantChunks =
          await this.knowledgeBaseService.searchSimilarChunks(
            queryEmbedding,
            maxContextChunks,
            contextThreshold
          );

        if (relevantChunks.length > 0) {
          console.log(`📄 Found ${relevantChunks.length} relevant chunks`);

          // Build context from chunks
          context = relevantChunks
            .map((chunk) => `[Source: ${chunk.documentName}]\n${chunk.text}`)
            .join("\n\n---\n\n");

          contextSources = relevantChunks.map((chunk) => ({
            documentName: chunk.documentName,
            chunkIndex: chunk.chunkIndex,
            similarity: chunk.similarity,
            preview: chunk.text.substring(0, 200) + "...",
          }));
        } else {
          console.log("📄 No relevant context found");
        }
      }

      // Generate response using LLM
      console.log("🤖 Generating response...");
      const response = await this.ollamaService.generateResponse(
        query,
        context,
        maxTokens
      );

      // Store in chat history
      this.addToChatHistory(sessionId, query, response, contextSources);

      return {
        response,
        contextSources,
        hasContext: contextSources.length > 0,
        contextChunks: contextSources.length,
        sessionId,
      };
    } catch (error) {
      console.error("Error processing query:", error);
      throw new Error(`Failed to process query: ${error.message}`);
    }
  }

  async processStreamQuery(
    query,
    sessionId = "default",
    onChunk,
    options = {}
  ) {
    try {
      const {
        includeContext = true,
        maxContextChunks = 5,
        contextThreshold = 0.1,
      } = options;

      console.log(`🔍 Processing stream query: "${query}"`);

      let context = "";
      let contextSources = [];

      if (includeContext) {
        // Check if knowledge base is available first
        const isKBAvailable =
          await this.knowledgeBaseService.isKnowledgeBaseAvailable();

        if (!isKBAvailable) {
          // Send helpful message via streaming
          const helpMessage =
            "I don't have any processed documents to search through yet. To get started:\n\n1. Place your PDF, DOCX, or TXT files in the 'data/documents/' folder\n2. Run 'npm run ingest' to process them\n3. Then ask me questions about your documentation!\n\nI'll be able to provide answers based on your IT infrastructure and networking documents once they're processed.";

          // Stream the message
          onChunk(helpMessage);

          return {
            contextSources: [],
            hasContext: false,
            contextChunks: 0,
            sessionId,
            needsIngestion: true,
          };
        }

        // Generate embedding for the query
        const queryEmbedding = await this.ollamaService.getEmbedding(query);

        // Search for relevant context
        const relevantChunks =
          await this.knowledgeBaseService.searchSimilarChunks(
            queryEmbedding,
            maxContextChunks,
            contextThreshold
          );

        if (relevantChunks.length > 0) {
          console.log(`📄 Found ${relevantChunks.length} relevant chunks`);

          context = relevantChunks
            .map((chunk) => `[Source: ${chunk.documentName}]\n${chunk.text}`)
            .join("\n\n---\n\n");

          contextSources = relevantChunks.map((chunk) => ({
            documentName: chunk.documentName,
            chunkIndex: chunk.chunkIndex,
            similarity: chunk.similarity,
            preview: chunk.text.substring(0, 200) + "...",
          }));
        }
      }

      // Generate streaming response
      let fullResponse = "";

      await this.ollamaService.generateStreamResponse(
        query,
        context,
        (chunk) => {
          fullResponse += chunk;
          onChunk(chunk);
        }
      );

      // Store in chat history
      this.addToChatHistory(sessionId, query, fullResponse, contextSources);

      return {
        contextSources,
        hasContext: contextSources.length > 0,
        contextChunks: contextSources.length,
        sessionId,
      };
    } catch (error) {
      console.error("Error processing stream query:", error);
      throw new Error(`Failed to process stream query: ${error.message}`);
    }
  }

  addToChatHistory(sessionId, query, response, contextSources) {
    if (!this.chatHistory.has(sessionId)) {
      this.chatHistory.set(sessionId, []);
    }

    const history = this.chatHistory.get(sessionId);
    history.push({
      timestamp: new Date().toISOString(),
      query,
      response,
      contextSources: contextSources || [],
      hasContext: (contextSources || []).length > 0,
    });

    // Keep only last 20 interactions per session for MVP
    if (history.length > 20) {
      history.splice(0, history.length - 20);
    }
  }

  getChatHistory(sessionId = "default", limit = 10) {
    const history = this.chatHistory.get(sessionId) || [];
    return history.slice(-limit);
  }

  clearChatHistory(sessionId = "default") {
    if (sessionId === "all") {
      this.chatHistory.clear();
    } else {
      this.chatHistory.delete(sessionId);
    }
  }

  async getAvailableDocuments() {
    try {
      const stats = await this.knowledgeBaseService.getStats();
      return {
        totalDocuments: stats.documents,
        processedDocuments: stats.documents,
        totalChunks: stats.chunks,
        totalWords: stats.totalWords,
        lastIngestion: stats.lastIngestion,
        documentDetails: stats.documentDetails,
        knowledgeBaseAvailable: stats.knowledgeBaseAvailable,
        message: stats.message,
      };
    } catch (error) {
      console.error("Error getting available documents:", error);
      return {
        totalDocuments: 0,
        processedDocuments: 0,
        totalChunks: 0,
        totalWords: 0,
        knowledgeBaseAvailable: false,
        message: "Error loading document information",
      };
    }
  }

  async searchDocuments(query, limit = 10) {
    try {
      return await this.knowledgeBaseService.searchDocuments(query, limit);
    } catch (error) {
      console.error("Error searching documents:", error);
      return [];
    }
  }

  async getSystemStatus() {
    const knowledgeBaseAvailable =
      await this.knowledgeBaseService.isKnowledgeBaseAvailable();
    const ollamaConnected = await this.ollamaService.isAvailable();

    return {
      chatSessions: this.chatHistory.size,
      totalInteractions: Array.from(this.chatHistory.values()).reduce(
        (total, history) => total + history.length,
        0
      ),
      knowledgeBaseAvailable,
      ollamaConnected,
      timestamp: new Date().toISOString(),
    };
  }

  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // IT-specific query preprocessing
  preprocessITQuery(query) {
    // Expand common IT abbreviations and synonyms
    const expansions = {
      dns: "domain name system dns",
      dhcp: "dynamic host configuration protocol dhcp",
      vpn: "virtual private network vpn",
      ssl: "secure socket layer ssl tls",
      api: "application programming interface api",
      tcp: "transmission control protocol tcp",
      udp: "user datagram protocol udp",
      ip: "internet protocol ip address",
      vlan: "virtual local area network vlan",
      wan: "wide area network wan",
      lan: "local area network lan",
    };

    let expandedQuery = query.toLowerCase();

    for (const [abbr, expansion] of Object.entries(expansions)) {
      const regex = new RegExp(`\\b${abbr}\\b`, "gi");
      expandedQuery = expandedQuery.replace(regex, expansion);
    }

    return expandedQuery;
  }

  async processITQuery(query, sessionId = "default", options = {}) {
    // Preprocess the query for better IT-specific matching
    const expandedQuery = this.preprocessITQuery(query);

    return await this.processQuery(expandedQuery, sessionId, {
      ...options,
      maxContextChunks: 7, // More context for technical queries
      contextThreshold: 0.05, // Lower threshold for technical content
    });
  }
}

// Singleton instance
let chatService = null;

export const getChatService = () => {
  if (!chatService) {
    chatService = new ChatService();
  }
  return chatService;
};

export default ChatService;
