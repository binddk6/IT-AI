# TCS IT & Networking Assistant

A **2-stage** IT assistant for TCS infrastructure and networking documentation. Clean separation between document processing (ingestion) and user interaction (Q&A app).

## 🏗️ Architecture (2-Stage Design)

### Stage 1: Document Ingestion (Offline)

```
PDF/DOCX Files → Text Extraction → Chunking → Embedding → JSONL Storage
```

### Stage 2: User App (Online)

```
User Query → Embedding → Similarity Search → Context Retrieval → LLM Response
```

## 🚀 Quick Start

### Prerequisites

1. **Node.js** (v18+ recommended)
2. **Ollama** installed and running

### Setup Ollama Models

```bash
# Install required models
ollama pull llama3.1:8b
ollama pull nomic-embed-text
```

### Installation

```bash
# Install dependencies
npm install
```

## 📖 Usage

### Stage 1: Document Ingestion

1. **Place your documents** in the `data/documents/` directory:

   ```bash
   # Supported formats: PDF, DOCX, TXT
   cp your-documents.pdf data/documents/
   cp network-policies.docx data/documents/
   ```

2. **Run the ingestion process**:

   ```bash
   npm run ingest
   ```

   This will:

   - Process all documents in `data/documents/`
   - Extract text and create intelligent chunks
   - Generate embeddings using Ollama
   - Save everything to `data/processed/knowledge_base.jsonl`
   - Generate ingestion summary

### Stage 2: User Application

1. **Start the user app**:

   ```bash
   npm start
   # or
   npm run app
   ```

2. **Open your browser**: `http://localhost:3000`

3. **Ask questions** like:
   - "How do we configure VPN access?"
   - "What are the firewall rules for the DMZ?"
   - "How do we troubleshoot network connectivity issues?"
   - "What is our backup procedure for critical servers?"

## 🏛️ Project Structure

```
document-processor/
├── scripts/
│   └── ingest.js                 # Stage 1: Document processing
├── src/
│   ├── app.js                   # Stage 2: User app entry point
│   ├── services/
│   │   ├── DocumentProcessingService.js  # PDF/DOCX processing
│   │   ├── OllamaService.js              # LLM integration
│   │   ├── KnowledgeBaseService.js       # JSONL data access
│   │   └── ChatService.js                # Chat logic
│   ├── routes/
│   │   └── chatRoutes.js                 # Chat API endpoints
│   └── public/
│       └── index.html                    # Web interface
├── data/
│   ├── documents/               # Input: Place your files here
│   └── processed/              # Output: JSONL knowledge base
└── package.json
```

## 🔄 Two-Stage Workflow

### When to Re-run Ingestion

- New documents added to `data/documents/`
- Updated existing documents
- Changed chunking or processing parameters
- Need to rebuild knowledge base

### Benefits of 2-Stage Architecture

✅ **Clean Separation**: Document processing vs. user interaction  
✅ **Offline Processing**: Heavy embedding work done upfront  
✅ **Fast Queries**: Pre-computed embeddings for instant search  
✅ **Simple Deployment**: User app has minimal dependencies  
✅ **Scalable Storage**: JSONL format is portable and efficient

## 🛠️ API Endpoints

### Chat Endpoints

- `POST /api/chat/query` - Process a chat query
- `POST /api/chat/stream` - Process streaming chat query
- `GET /api/chat/history/:sessionId` - Get chat history
- `POST /api/chat/search` - Search through documents
- `GET /api/chat/documents` - Get knowledge base stats

### System Endpoints

- `GET /api/status` - Get system and knowledge base status
- `GET /health` - Health check

## 📊 Configuration

### Environment Variables

```bash
# Server port (default: 3000)
PORT=3000

# Ollama base URL (default: http://localhost:11434)
OLLAMA_URL=http://localhost:11434
```

### Processing Parameters

Edit `scripts/ingest.js` or `DocumentProcessingService.js`:

- **Chunk Size**: 1000 characters (balance between context and precision)
- **Chunk Overlap**: 200 characters (maintains context continuity)
- **Similarity Threshold**: 0.1 (minimum similarity for context inclusion)

## 🔧 Troubleshooting

### Common Issues

1. **"Knowledge base not found"**

   ```bash
   # Run ingestion first
   npm run ingest
   ```

2. **"Ollama is not available"**

   ```bash
   # Check if Ollama is running
   curl http://localhost:11434/api/tags

   # Start Ollama if needed
   ollama serve
   ```

3. **"Required models not found"**

   ```bash
   # Install required models
   ollama pull nomic-embed-text
   ollama pull llama3.1:8b
   ```

4. **No documents processed**

   ```bash
   # Check documents directory
   ls data/documents/

   # Ensure files are PDF, DOCX, or TXT format
   ```

### Processing Large Document Sets

For large document collections:

- Run ingestion during off-hours (CPU intensive)
- Monitor memory usage during processing
- Consider batch processing for 100+ documents

## 📋 JSONL Data Format

The knowledge base uses JSON Lines format:

```jsonl
{"type":"document","document_name":"network-policy.pdf","processed_at":"2024-01-01T00:00:00Z","total_chunks":15,"metadata":{...}}
{"type":"chunk","id":"chunk-001","text":"VPN configuration requires...","document_name":"network-policy.pdf","embedding":[0.1,0.2,...],"processed_at":"2024-01-01T00:00:00Z"}
{"type":"chunk","id":"chunk-002","text":"Firewall rules should be...","document_name":"network-policy.pdf","embedding":[0.3,0.4,...],"processed_at":"2024-01-01T00:00:00Z"}
```

## 🚦 Future Enhancements

### Immediate Improvements

- [ ] Document versioning and update detection
- [ ] Batch ingestion with progress tracking
- [ ] Advanced chunking strategies (sentence-aware)
- [ ] Document type-specific processing

### Production Readiness

- [ ] PostgreSQL with pgvector for vector storage
- [ ] User authentication and multi-tenancy
- [ ] Document access controls
- [ ] API rate limiting
- [ ] Monitoring and analytics
- [ ] Docker containerization

## 🔄 Scripts Reference

```bash
# Process documents (Stage 1)
npm run ingest

# Start user app (Stage 2)
npm start
npm run app

# Development with auto-reload
npm run dev

# Health check
curl http://localhost:3000/health
```

## 📝 License

MIT License - Feel free to modify for your organization's needs.

---

## 💡 Usage Tips

1. **Start Small**: Begin with 5-10 important documents
2. **Iterate**: Refine based on query results and user feedback
3. **Monitor**: Check ingestion logs for processing issues
4. **Organize**: Group related documents for better context
5. **Update Regularly**: Re-run ingestion when documents change
