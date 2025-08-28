import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import chatRoutes from "./routes/chatRoutes.js";
import { getKnowledgeBaseService } from "./services/KnowledgeBaseService.js";
import { getChatService } from "./services/ChatService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

// Initialize services
const knowledgeBaseService = getKnowledgeBaseService();
const chatService = getChatService();

// Routes
app.use("/api/chat", chatRoutes);

// Serve frontend
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    stage: "user-app",
  });
});

// System status endpoint
app.get("/api/status", async (req, res) => {
  try {
    const systemStatus = await chatService.getSystemStatus();
    const documentStats = await chatService.getAvailableDocuments();

    res.json({
      success: true,
      data: {
        ...systemStatus,
        documents: documentStats,
      },
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      code: "STATUS_ERROR",
    });
  }
});

// Start server
async function startServer() {
  try {
    console.log("🚀 Starting TCS IT & Networking Assistant...");

    // Check if knowledge base is available
    const isKnowledgeAvailable =
      await knowledgeBaseService.isKnowledgeBaseAvailable();

    if (!isKnowledgeAvailable) {
      console.log("⚠️  Knowledge base not found!");
      console.log('   Run "npm run ingest" first to process your documents.');
      console.log("   Place PDF/DOCX files in: data/documents/");
    } else {
      console.log("✅ Knowledge base found");

      // Load stats
      try {
        const stats = await knowledgeBaseService.getStats();
        console.log("📊 Knowledge Base Stats:");
        console.log(`   📄 Documents: ${stats.documents}`);
        console.log(`   📦 Chunks: ${stats.chunks}`);
        console.log(
          `   📝 Total Words: ${stats.totalWords?.toLocaleString() || "N/A"}`
        );
        if (stats.lastIngestion) {
          console.log(
            `   ⏰ Last Ingestion: ${new Date(
              stats.lastIngestion
            ).toLocaleString()}`
          );
        }
      } catch (error) {
        console.log("📊 Knowledge base loading will happen on first query");
      }
    }

    app.listen(PORT, () => {
      console.log(`\n🌟 User App running on http://localhost:${PORT}`);
      console.log("📚 Ready to answer questions about your IT documentation");
      console.log("\n💡 Usage:");
      console.log("   1. Process documents: npm run ingest");
      console.log("   2. Ask questions through the web interface");
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error.message);
    process.exit(1);
  }
}

startServer();

export default app;
