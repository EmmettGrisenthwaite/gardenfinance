import React from 'react';
import { Button } from '@/components/ui/button';
import { Lightbulb, DollarSign, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

export default function PromptStarters({ onSelect }) {
  const starters = [
    {
      text: "Give me a complete analysis of my financial health and what I should focus on first.",
      icon: Lightbulb,
      color: "emerald",
      label: "Financial Checkup",
      sublabel: "Get personalized insights"
    },
    {
      text: "How can I optimize my budget to save more money each month?",
      icon: DollarSign,
      color: "blue", 
      label: "Budget Optimization",
      sublabel: "Find saving opportunities"
    },
    {
      text: "What investment strategy makes sense for someone in my situation?",
      icon: TrendingUp,
      color: "purple",
      label: "Investment Advice", 
      sublabel: "Plan your portfolio"
    },
    {
      text: "How should I prioritize paying off my debt vs saving for goals?",
      icon: DollarSign,
      color: "red",
      label: "Debt Strategy",
      sublabel: "Balance debt and savings"
    },
    {
      text: "What are some realistic ways I can increase my income this year?",
      icon: TrendingUp,
      color: "green",
      label: "Income Growth",
      sublabel: "Boost your earnings"
    },
    {
      text: "Help me plan for a major purchase like a car or house down payment.",
      icon: Lightbulb,
      color: "orange",
      label: "Major Purchase",
      sublabel: "Strategic planning"
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="px-6 pb-4"
    >
      <div className="mb-3">
        <h4 className="text-sm font-semibold text-slate-700 mb-1">💡 Try asking me about:</h4>
        <p className="text-xs text-slate-500">Click any suggestion to get started</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {starters.map((starter, index) => (
          <Button
            key={index}
            variant="outline"
            onClick={() => onSelect(starter.text)}
            className={`h-auto p-4 text-left justify-start gap-3 hover:bg-${starter.color}-50 border-${starter.color}-200 transition-all duration-200 hover:shadow-md`}
          >
            <starter.icon className={`w-5 h-5 text-${starter.color}-600 flex-shrink-0`} />
            <div className="min-w-0">
              <p className="font-semibold text-slate-700 text-sm">{starter.label}</p>
              <p className="text-xs text-slate-500 truncate">{starter.sublabel}</p>
            </div>
          </Button>
        ))}
      </div>
    </motion.div>
  );
}