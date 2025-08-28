import axios from 'axios';

export class OllamaService {
  constructor(baseUrl = 'http://localhost:11434') {
    this.baseUrl = baseUrl;
    this.embeddingModel = 'nomic-embed-text';
    this.llmModel = 'llama3.1:8b';
  }

  async isAvailable() {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`, { timeout: 5000 });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  async getEmbedding(text) {
    try {
      const response = await axios.post(`${this.baseUrl}/api/embeddings`, {
        model: this.embeddingModel,
        prompt: text
      }, {
        timeout: 30000,
        headers: { 'Content-Type': 'application/json' }
      });

      return response.data.embedding;
    } catch (error) {
      console.error('Error getting embedding:', error.message);
      throw new Error(`Failed to get embedding: ${error.message}`);
    }
  }

  async generateResponse(prompt, context = '', maxTokens = 2048) {
    try {
      const systemPrompt = `You are an expert IT infrastructure and networking assistant. Your knowledge is based solely on the provided context from internal documentation.

IMPORTANT GUIDELINES:
- Only answer questions related to IT infrastructure, networking, and technical documentation
- Base your responses ONLY on the provided context
- If the context doesn't contain enough information, clearly state this
- Be specific and technical when appropriate
- Provide actionable insights when possible
- If asked about something outside the context, politely redirect to the available documentation

FORMATTING REQUIREMENTS:
- Use clear headings (## Main Topic, ### Subtopic) to organize your response
- Use **bold text** for important concepts, key terms, and critical information
- Use bullet points (-) or numbered lists (1.) for steps, procedures, or multiple items
- Break up long responses into well-structured paragraphs
- Highlight important warnings or notes
- Make responses easy to scan and read
- Use `code formatting` for commands, file names, or technical syntax

Context from internal documentation:
${context}

User question: ${prompt}

Please provide a well-formatted, organized response:`;

      const response = await axios.post(`${this.baseUrl}/api/generate`, {
        model: this.llmModel,
        prompt: systemPrompt,
        stream: false,
        options: {
          temperature: 0.1,
          top_p: 0.9,
          num_predict: maxTokens
        }
      }, {
        timeout: 60000,
        headers: { 'Content-Type': 'application/json' }
      });

      return response.data.response.trim();
    } catch (error) {
      console.error('Error generating response:', error.message);
      throw new Error(`Failed to generate response: ${error.message}`);
    }
  }

  async generateStreamResponse(prompt, context = '', onChunk) {
    try {
      const systemPrompt = `You are an expert IT infrastructure and networking assistant. Your knowledge is based solely on the provided context from internal documentation.

IMPORTANT GUIDELINES:
- Only answer questions related to IT infrastructure, networking, and technical documentation
- Base your responses ONLY on the provided context
- If the context doesn't contain enough information, clearly state this
- Be specific and technical when appropriate
- Provide actionable insights when possible
- If asked about something outside the context, politely redirect to the available documentation

FORMATTING REQUIREMENTS:
- Use clear headings (## Main Topic, ### Subtopic) to organize your response
- Use **bold text** for important concepts, key terms, and critical information
- Use bullet points (-) or numbered lists (1.) for steps, procedures, or multiple items
- Break up long responses into well-structured paragraphs
- Highlight important warnings or notes
- Make responses easy to scan and read
- Use `code formatting` for commands, file names, or technical syntax

Context from internal documentation:
${context}

User question: ${prompt}

Please provide a well-formatted, organized response:`;

      const response = await axios.post(`${this.baseUrl}/api/generate`, {
        model: this.llmModel,
        prompt: systemPrompt,
        stream: true,
        options: {
          temperature: 0.1,
          top_p: 0.9
        }
      }, {
        responseType: 'stream',
        timeout: 60000,
        headers: { 'Content-Type': 'application/json' }
      });

      response.data.on('data', (chunk) => {
        const lines = chunk.toString().split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.response) {
              onChunk(data.response);
            }
          } catch (e) {
            // Ignore malformed JSON
          }
        }
      });

      return new Promise((resolve, reject) => {
        response.data.on('end', () => resolve());
        response.data.on('error', reject);
      });
    } catch (error) {
      console.error('Error generating stream response:', error.message);
      throw new Error(`Failed to generate stream response: ${error.message}`);
    }
  }

  async checkModelsAvailable() {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`);
      const models = response.data.models || [];
      
      const hasEmbeddingModel = models.some(model => model.name.includes(this.embeddingModel));
      const hasLLMModel = models.some(model => model.name.includes(this.llmModel));
      
      return {
        available: hasEmbeddingModel && hasLLMModel,
        embeddingModel: hasEmbeddingModel,
        llmModel: hasLLMModel,
        models: models.map(m => m.name)
      };
    } catch (error) {
      return {
        available: false,
        error: error.message
      };
    }
  }
}

export default OllamaService;
