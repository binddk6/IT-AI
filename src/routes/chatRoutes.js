import express from 'express';
import { getChatService } from '../services/ChatService.js';

const router = express.Router();
const chatService = getChatService();

// POST /api/chat/query - Process a chat query
router.post('/query', async (req, res) => {
  try {
    const { query, sessionId, options = {} } = req.body;
    
    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        error: 'Query is required',
        code: 'MISSING_QUERY'
      });
    }

    const result = await chatService.processITQuery(
      query.trim(), 
      sessionId || chatService.generateSessionId(),
      options
    );

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Chat query error:', error);
    res.status(500).json({
      error: error.message,
      code: 'CHAT_QUERY_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/chat/stream - Process a streaming chat query
router.post('/stream', (req, res) => {
  const { query, sessionId, options = {} } = req.body;
  
  if (!query || query.trim().length === 0) {
    return res.status(400).json({
      error: 'Query is required',
      code: 'MISSING_QUERY'
    });
  }

  // Set up Server-Sent Events
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type'
  });

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Send initial event
  sendEvent('start', { message: 'Processing query...' });

  chatService.processStreamQuery(
    query.trim(),
    sessionId || chatService.generateSessionId(),
    (chunk) => {
      sendEvent('chunk', { content: chunk });
    },
    options
  ).then((result) => {
    sendEvent('context', {
      contextSources: result.contextSources,
      hasContext: result.hasContext,
      contextChunks: result.contextChunks
    });
    sendEvent('end', { message: 'Query completed' });
    res.end();
  }).catch((error) => {
    console.error('Stream chat error:', error);
    sendEvent('error', { 
      error: error.message,
      code: 'STREAM_CHAT_ERROR'
    });
    res.end();
  });
});

// GET /api/chat/history/:sessionId - Get chat history for a session
router.get('/history/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const { limit = 10 } = req.query;
    
    const history = chatService.getChatHistory(sessionId, parseInt(limit));
    
    res.json({
      success: true,
      data: {
        sessionId,
        history,
        count: history.length
      }
    });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({
      error: error.message,
      code: 'GET_HISTORY_ERROR'
    });
  }
});

// DELETE /api/chat/history/:sessionId - Clear chat history
router.delete('/history/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    
    chatService.clearChatHistory(sessionId);
    
    res.json({
      success: true,
      message: `Chat history cleared for session: ${sessionId}`
    });
  } catch (error) {
    console.error('Clear history error:', error);
    res.status(500).json({
      error: error.message,
      code: 'CLEAR_HISTORY_ERROR'
    });
  }
});

// GET /api/chat/documents - Get available documents information
router.get('/documents', async (req, res) => {
  try {
    const documents = await chatService.getAvailableDocuments();
    
    res.json({
      success: true,
      data: documents
    });
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({
      error: error.message,
      code: 'GET_DOCUMENTS_ERROR'
    });
  }
});

// POST /api/chat/search - Search through documents
router.post('/search', async (req, res) => {
  try {
    const { query, limit = 10 } = req.body;
    
    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        error: 'Search query is required',
        code: 'MISSING_SEARCH_QUERY'
      });
    }

    const results = await chatService.searchDocuments(query.trim(), parseInt(limit));
    
    res.json({
      success: true,
      data: {
        query: query.trim(),
        results,
        count: results.length
      }
    });
  } catch (error) {
    console.error('Search documents error:', error);
    res.status(500).json({
      error: error.message,
      code: 'SEARCH_DOCUMENTS_ERROR'
    });
  }
});

// GET /api/chat/status - Get system status
router.get('/status', (req, res) => {
  try {
    const status = chatService.getSystemStatus();
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Get status error:', error);
    res.status(500).json({
      error: error.message,
      code: 'GET_STATUS_ERROR'
    });
  }
});

// POST /api/chat/session - Create a new chat session
router.post('/session', (req, res) => {
  try {
    const sessionId = chatService.generateSessionId();
    
    res.json({
      success: true,
      data: {
        sessionId,
        created: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({
      error: error.message,
      code: 'CREATE_SESSION_ERROR'
    });
  }
});

export default router;
