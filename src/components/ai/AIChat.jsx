
import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InvokeLLM } from "@/api/integrations";
import { User } from "@/api/entities";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";
import {
  Send,
  Bot,
  User as UserIcon,
  Loader2,
  Lightbulb,
  Copy,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  TrendingUp,
  Target,
  Calculator
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import PromptStarters from "./PromptStarters";

export default function AIChat({ user, portfolios, goals, budgets }) {
  const [messages, setMessages] = useState(() => {
    // Load chat history from localStorage
    const savedMessages = localStorage.getItem(`chat_${user?.email}`);
    if (savedMessages) {
      const parsedMessages = JSON.parse(savedMessages);
      // Convert timestamp strings back to Date objects
      return parsedMessages.map(msg => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }));
    }
    return [
      {
        id: 1,
        type: 'ai',
        content: `Hi ${user?.full_name?.split(' ')[0] || 'there'}! 👋 I'm your personal AI financial advisor. I have access to all your financial data and I'm here to help you make smarter money decisions. What would you like to talk about?`,
        timestamp: new Date(),
        suggestions: [
          { text: "Analyze my financial health", action: "analysis" },
          { text: "Help me optimize my budget", action: "budget" },
          { text: "Review my investment strategy", action: "investment" }
        ]
      }
    ];
  });

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPromptStarters, setShowPromptStarters] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState(null);
  const [conversationSummary, setConversationSummary] = useState("");
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    // A small timeout helps ensure the DOM has fully updated after new messages
    // are rendered, especially when animations are present. This makes the
    // automatic scroll more reliable.
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (user?.email && messages.length > 1) {
      localStorage.setItem(`chat_${user.email}`, JSON.stringify(messages));
    }
  }, [messages, user?.email]);

  // Auto-focus input when component mounts
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const identifyDataGaps = () => {
    const gaps = [];
    if (!user?.income_monthly || user.income_monthly === 0) {
      gaps.push({ field: "Monthly Income", page: "BudgetBuilder", description: "to provide accurate budget recommendations" });
    }
    if (!budgets || budgets.length === 0) {
      gaps.push({ field: "Budget", page: "BudgetBuilder", description: "to analyze your spending patterns" });
    }
    if (!goals || goals.length === 0) {
      gaps.push({ field: "Financial Goals", page: "Goals", description: "to create a personalized savings strategy" });
    }
    if (!portfolios || portfolios.length === 0) {
      gaps.push({ field: "Investment Portfolio", page: "Portfolio", description: "to provide investment advice" });
    }
    return gaps;
  };

  const buildEnhancedContext = () => {
    const currentBudget = budgets?.[0];
    const currentPortfolio = portfolios?.find(p => p.type === 'current');
    const activeGoals = goals?.filter(g => g.status === 'active') || [];
    const completedGoals = goals?.filter(g => g.status === 'completed') || [];
    const dataGaps = identifyDataGaps();

    const contextSections = [];

    // User Profile
    contextSections.push(`
USER PROFILE:
- Name: ${user?.full_name}
- Age: ${user?.age}
- Occupation: ${user?.occupation?.replace('_', ' ') || 'Not specified'}
- Monthly Income: $${user?.income_monthly?.toLocaleString() || 'Not provided'}
- Current Savings: $${user?.savings_current?.toLocaleString() || 0}
- Total Debt: $${user?.debt_total?.toLocaleString() || 0}
- Risk Tolerance: ${user?.risk_tolerance || 'Not assessed'}
- Financial Goals Priority: ${user?.financial_goals?.join(', ') || 'None set'}
    `);

    // Budget Analysis
    if (currentBudget) {
      const totalExpenses = Object.values(currentBudget.categories || {}).reduce((a, b) => a + b, 0);
      const savingsRate = currentBudget.monthly_income > 0 ?
        ((currentBudget.categories?.savings || 0) / currentBudget.monthly_income * 100).toFixed(1) : 0;

      contextSections.push(`
CURRENT BUDGET STATUS:
- Monthly Income: $${currentBudget.monthly_income?.toLocaleString()}
- Total Allocated: $${totalExpenses.toLocaleString()}
- Savings Rate: ${savingsRate}%
- Housing: $${currentBudget.categories?.housing?.toLocaleString() || 0}
- Food: $${currentBudget.categories?.food?.toLocaleString() || 0}
- Transportation: $${currentBudget.categories?.transportation?.toLocaleString() || 0}
- Debt Payments: $${currentBudget.categories?.debt_payments?.toLocaleString() || 0}
      `);
    }

    // Portfolio Analysis
    if (currentPortfolio) {
      contextSections.push(`
INVESTMENT PORTFOLIO:
- Total Value: $${currentPortfolio.total_value?.toLocaleString() || 0}
- Risk Score: ${currentPortfolio.analysis?.risk_score || 'Not analyzed'}/10
- Diversification Score: ${currentPortfolio.analysis?.diversification_score || 'Not analyzed'}/10
- Holdings Count: ${currentPortfolio.holdings?.length || 0}
      `);
    }

    // Goals Progress
    if (activeGoals.length > 0) {
      contextSections.push(`
ACTIVE FINANCIAL GOALS:
${activeGoals.map(goal => {
  const progress = ((goal.current_amount || 0) / goal.target_amount * 100).toFixed(1);
  return `- ${goal.title}: $${goal.current_amount?.toLocaleString() || 0}/$${goal.target_amount?.toLocaleString()} (${progress}% complete, due ${new Date(goal.target_date).toLocaleDateString()})`;
}).join('\n')}
      `);
    }

    // Recent Achievements
    if (completedGoals.length > 0) {
      contextSections.push(`
RECENT ACHIEVEMENTS:
${completedGoals.slice(0, 3).map(goal => `- Completed: ${goal.title} ($${goal.target_amount?.toLocaleString()})`).join('\n')}
      `);
    }

    // Data Gaps
    if (dataGaps.length > 0) {
      contextSections.push(`
MISSING DATA (mention if relevant to query):
${dataGaps.map(gap => `- ${gap.field} needed ${gap.description}`).join('\n')}
      `);
    }

    // Conversation Context
    if (conversationSummary) {
      contextSections.push(`
CONVERSATION CONTEXT:
${conversationSummary}
      `);
    }

    return contextSections.join('\n');
  };

  const generateActionableLinks = (content) => {
    const linkMappings = [
      { keywords: ['budget', 'spending', 'expense'], page: 'BudgetBuilder', text: 'Budget Builder' },
      { keywords: ['invest', 'portfolio', 'stock'], page: 'Portfolio', text: 'Portfolio Tools' },
      { keywords: ['goal', 'save', 'target'], page: 'Goals', text: 'Goals' },
      { keywords: ['debt', 'loan', 'payoff'], page: 'DebtManager', text: 'Debt Manager' },
      { keywords: ['learn', 'education', 'course'], page: 'Learn', text: 'Learning Center' }
    ];

    let enhancedContent = content;

    // This logic ensures that links are only added if the AI's response
    // contains relevant keywords, making the suggestions contextual.
    linkMappings.forEach(({ keywords, page, text }) => {
      if (keywords.some(keyword => content.toLowerCase().includes(keyword))) {
        const pageUrl = createPageUrl(page);
        // We append the markdown link which will be rendered as a button
        enhancedContent += `\n\n💡 **Take Action:** [Open ${text}](${pageUrl})`;
      }
    });

    return enhancedContent;
  };

  const updateConversationSummary = (newMessage, aiResponse) => {
    // Keep a rolling summary of the last few conversation turns
    const summary = `Recent discussion: User asked about "${newMessage.content.substring(0, 50)}..." and we discussed ${aiResponse.substring(0, 100)}...`;
    setConversationSummary(summary);
  };

  const sendMessage = async (messageText = input) => {
    if (!messageText.trim()) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: messageText,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setShowPromptStarters(false);

    try {
      const context = buildEnhancedContext();
      const recentMessages = messages.slice(-4).map(m =>
        `${m.type === 'user' ? 'User' : 'AI'}: ${m.content}`
      ).join('\n');

      const prompt = `
You are Garden's AI financial advisor, specifically designed for college students and young professionals. You have access to the user's complete financial profile and should provide personalized, actionable advice.

${context}

Recent conversation:
${recentMessages}

User's current question: "${messageText}"

RESPONSE GUIDELINES:
1. Be encouraging, practical, and Gen Z-friendly in tone
2. Reference their specific financial data when relevant
3. Provide actionable, step-by-step advice with specific numbers when possible
4. If they ask about general concepts, relate them to their situation
5. Keep responses concise but comprehensive (2-4 paragraphs max)
6. Use emojis sparingly but appropriately
7. If data is missing for a complete answer, mention what specific information would help
8. Use garden-themed metaphors when appropriate (saving = watering, investing = planting, debt = weeding)
9. Always end with a concrete next step they can take
10. If recommending app features, be specific about which page/tool to use

Respond as their personal financial advisor:
      `;

      const response = await InvokeLLM({
        prompt,
        add_context_from_internet: messageText.toLowerCase().includes('news') ||
                                   messageText.toLowerCase().includes('market') ||
                                   messageText.toLowerCase().includes('stock') ||
                                   messageText.toLowerCase().includes('inflation')
      });

      const enhancedResponse = generateActionableLinks(response);

      const aiMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: enhancedResponse,
        timestamp: new Date(),
        // Add smart suggestions based on the response content
        suggestions: generateSmartSuggestions(enhancedResponse, userMessage.content)
      };

      setMessages(prev => [...prev, aiMessage]);
      updateConversationSummary(userMessage, response);

    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: "I apologize, but I'm having trouble processing your request right now. This might be due to high demand or a temporary connection issue. Please try rephrasing your question or try again in a moment. 🤖",
        timestamp: new Date(),
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);
    }

    setIsLoading(false);
  };

  const generateSmartSuggestions = (aiResponse, userQuery) => {
    const suggestions = [];

    if (aiResponse.toLowerCase().includes('budget')) {
      suggestions.push({ text: "Show me my budget breakdown", action: "budget_analysis" });
    }
    if (aiResponse.toLowerCase().includes('invest')) {
      suggestions.push({ text: "Help me start investing", action: "investment_start" });
    }
    if (aiResponse.toLowerCase().includes('debt')) {
      suggestions.push({ text: "Create a debt payoff plan", action: "debt_plan" });
    }
    if (aiResponse.toLowerCase().includes('save')) {
      suggestions.push({ text: "Set up a savings goal", action: "savings_goal" });
    }

    // Always add a follow-up question
    suggestions.push({ text: "What else should I know about this?", action: "follow_up" });

    return suggestions.slice(0, 3); // Limit to 3 suggestions
  };

  const handlePromptClick = (promptText) => {
    sendMessage(promptText);
  };

  const handleSuggestionClick = (suggestion) => {
    sendMessage(suggestion.text);
  };

  const copyToClipboard = async (content, messageId) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (error) {
      console.error("Failed to copy text:", error);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <AnimatePresence>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className={`flex gap-3 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.type === 'ai' && (
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-blue-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Bot className="w-5 h-5 text-white" />
                </div>
              )}

              <div className={`max-w-2xl ${message.type === 'user' ? 'order-2' : ''}`}>
                <Card className={`${
                  message.type === 'user'
                    ? 'bg-gradient-to-r from-blue-600 to-emerald-500 text-white'
                    : message.isError
                      ? 'bg-red-50 border-red-200 text-red-800'
                      : 'bg-white border-slate-200'
                } shadow-sm hover:shadow-md transition-shadow`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="prose prose-sm max-w-none">
                          {message.content.split('\n').map((line, index) => {
                            // Handle action links
                            const linkMatch = line.match(/\[([^\]]+)\]\(([^)]+)\)/);
                            if (linkMatch) {
                              const [, linkText, linkUrl] = linkMatch;
                              return (
                                <div key={index} className="mt-3">
                                  <Link
                                    to={linkUrl}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
                                  >
                                    {linkText}
                                    <ExternalLink className="w-4 h-4" />
                                  </Link>
                                </div>
                              );
                            }
                            return line && (
                              <p key={index} className="mb-2 last:mb-0">
                                {line}
                              </p>
                            );
                          })}
                        </div>

                        {/* Smart Suggestions */}
                        {message.suggestions && message.suggestions.length > 0 && (
                          <div className="mt-4 space-y-2">
                            <p className="text-xs font-medium text-slate-500">💡 Try asking:</p>
                            <div className="flex flex-wrap gap-2">
                              {message.suggestions.map((suggestion, index) => (
                                <Button
                                  key={index}
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleSuggestionClick(suggestion)}
                                  className="text-xs hover:bg-emerald-50 hover:border-emerald-300"
                                >
                                  {suggestion.text}
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {message.type === 'ai' && !message.isError && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyToClipboard(message.content, message.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          {copiedMessageId === message.id ? (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-3">
                      <p className={`text-xs ${
                        message.type === 'user' ? 'text-blue-100' : 'text-slate-400'
                      }`}>
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>

                      {message.isError && (
                        <div className="flex items-center gap-1 text-red-600">
                          <AlertCircle className="w-3 h-3" />
                          <span className="text-xs">Error</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {message.type === 'user' && (
                <div className="w-10 h-10 bg-gradient-to-br from-slate-400 to-slate-500 rounded-xl flex items-center justify-center flex-shrink-0 order-3">
                  <UserIcon className="w-5 h-5 text-white" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Loading indicator with enhanced animation */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-3"
          >
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-blue-500 rounded-xl flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-slate-600">AI is analyzing your data</span>
                    <motion.div
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="flex gap-1"
                    >
                      <div className="w-1 h-1 bg-emerald-500 rounded-full"></div>
                      <div className="w-1 h-1 bg-emerald-500 rounded-full"></div>
                      <div className="w-1 h-1 bg-emerald-500 rounded-full"></div>
                    </motion.div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Prompt Starters */}
      <AnimatePresence>
        {showPromptStarters && (
          <PromptStarters onSelect={handlePromptClick} />
        )}
      </AnimatePresence>

      {/* Enhanced Input Area */}
      <div className="border-t border-slate-200 p-6 bg-white/50 backdrop-blur-sm">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me anything about your finances..."
              onKeyPress={handleKeyPress}
              className="h-12 border-slate-200 focus:border-emerald-500 focus:ring-emerald-500 pr-12"
              disabled={isLoading}
            />
            {input && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setInput("")}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 text-slate-400 hover:text-slate-600"
              >
                ×
              </Button>
            )}
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowPromptStarters(prev => !prev)}
            className={`h-12 w-12 flex-shrink-0 transition-colors ${
              showPromptStarters
                ? 'bg-yellow-50 border-yellow-300 text-yellow-600'
                : 'hover:bg-slate-50'
            }`}
          >
            <Lightbulb className={`w-5 h-5 ${showPromptStarters ? 'text-yellow-500' : 'text-gray-500'}`} />
          </Button>

          <Button
            onClick={() => sendMessage()}
            disabled={!input.trim() || isLoading}
            className="h-12 px-6 bg-gradient-to-r from-emerald-600 to-blue-500 hover:from-emerald-700 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        </div>

        <div className="flex items-center justify-between mt-3">
          <p className="text-xs text-slate-400">
            💡 I have access to your budget, goals, and portfolio data to give you personalized advice
          </p>

          {messages.length > 2 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setMessages([messages[0]]); // Keep welcome message
                localStorage.removeItem(`chat_${user?.email}`);
                setConversationSummary("");
              }}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              Clear Chat
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
