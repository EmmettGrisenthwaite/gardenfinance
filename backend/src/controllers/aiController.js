import OpenAI from 'openai';

export const chatController = {
  async sendMessage(req, res) {
    // Initialize OpenAI client inside the function to ensure env vars are loaded
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    try {
      const { message, context } = req.body;

      if (!message) {
        return res.status(400).json({
          error: 'Message is required'
        });
      }

      // Construct the system prompt with user context
      const systemPrompt = `You are Garden's AI financial advisor, specifically designed for college students and young professionals. You have access to the user's complete financial profile and should provide personalized, actionable advice.

${context || ''}

Guidelines:
- Be conversational and supportive
- Provide specific, actionable recommendations
- Reference the user's actual financial data when available
- Keep responses concise but comprehensive
- Use emojis appropriately to make responses engaging
- If data is missing, suggest ways to improve their financial tracking
- Focus on practical steps they can take today`;

      // Call OpenAI API
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: message
          }
        ],
        max_tokens: 500,
        temperature: 0.7,
      });

      const aiResponse = completion.choices[0].message.content;

      res.json({
        response: aiResponse
      });

    } catch (error) {
      console.error('AI chat error:', error);
      
      // Handle specific OpenAI errors
      if (error.status === 401) {
        return res.status(500).json({
          error: 'AI service authentication failed'
        });
      } else if (error.status === 429) {
        return res.status(429).json({
          error: 'Too many requests. Please try again later.'
        });
      } else if (error.status >= 500) {
        return res.status(503).json({
          error: 'AI service temporarily unavailable'
        });
      }

      res.status(500).json({
        error: 'Failed to get AI response'
      });
    }
  }
};