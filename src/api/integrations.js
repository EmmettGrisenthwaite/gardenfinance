// AI and external service integrations
import { apiClient } from './client.js';

export const Core = {
  InvokeLLM: async (options = {}) => {
    try {
      // Extract the message from prompt or options
      const message = options.prompt || options.message || '';
      const context = options.context || '';
      
      // Call the backend AI endpoint
      const response = await apiClient.sendChatMessage(message, context);
      
      return response.response;
    } catch (error) {
      console.error('Error calling AI service:', error);
      
      // Fallback response if the AI service fails
      return `I'm having trouble connecting to my AI service right now. This might be due to high demand or a temporary issue. Please try again in a moment, or feel free to browse the learning resources in the meantime! 🤖

If this continues, you can still use all the budgeting, goal tracking, and portfolio features in the app.`;
    }
  },

  SendEmail: async (emailData) => {
    console.log('Mock email would be sent:', emailData);
    return { success: true, messageId: 'mock_' + Date.now() };
  },

  UploadFile: async (file) => {
    console.log('Mock file upload:', file.name);
    return { 
      success: true, 
      fileId: 'mock_file_' + Date.now(),
      url: URL.createObjectURL(file)
    };
  },

  GenerateImage: async (prompt) => {
    console.log('Mock image generation for prompt:', prompt);
    return { 
      success: true, 
      imageUrl: 'https://via.placeholder.com/400x300?text=' + encodeURIComponent(prompt)
    };
  },

  ExtractDataFromUploadedFile: async (fileId) => {
    console.log('Mock data extraction from file:', fileId);
    return {
      success: true,
      extractedData: {
        transactions: [],
        summary: 'No transaction data found in uploaded file.'
      }
    };
  }
};

// Export individual functions for compatibility
export const InvokeLLM = Core.InvokeLLM;
export const SendEmail = Core.SendEmail;
export const UploadFile = Core.UploadFile;
export const GenerateImage = Core.GenerateImage;
export const ExtractDataFromUploadedFile = Core.ExtractDataFromUploadedFile;






