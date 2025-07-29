import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, RefreshCw, TrendingUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function FinancialTips() {
  const [currentTip, setCurrentTip] = useState(0);

  const tips = [
    {
      title: "50/30/20 Rule",
      description: "Allocate 50% for needs, 30% for wants, and 20% for savings and debt repayment. This proven formula helps build financial stability.",
      category: "Budgeting",
      difficulty: "Beginner"
    },
    {
      title: "Emergency Fund First",
      description: "Build 3-6 months of expenses before investing. It's your financial safety net that prevents debt when unexpected costs arise!",
      category: "Savings",
      difficulty: "Essential"
    },
    {
      title: "Start Investing Early",
      description: "Time is your biggest advantage. Even $50/month can grow to over $50,000 in 20 years with compound interest working for you.",
      category: "Investing",
      difficulty: "Intermediate"
    },
    {
      title: "Automate Everything",
      description: "Set up automatic transfers to savings and investments. Pay yourself first before you have a chance to spend the money elsewhere!",
      category: "Habits",
      difficulty: "Beginner"
    },
    {
      title: "Track Your Spending",
      description: "Awareness is the first step to control. Use apps or spreadsheets to know where every dollar goes - you'll be surprised by small expenses.",
      category: "Budgeting",
      difficulty: "Beginner"
    },
    {
      title: "Diversify Your Portfolio",
      description: "Don't put all eggs in one basket. Spread investments across different asset types, sectors, and geographic regions to reduce risk.",
      category: "Investing",
      difficulty: "Advanced"
    }
  ];

  const nextTip = () => {
    setCurrentTip((prev) => (prev + 1) % tips.length);
  };

  useEffect(() => {
    const interval = setInterval(nextTip, 8000);
    return () => clearInterval(interval);
  }, []);

  const getCategoryColor = (category) => {
    const colors = {
      "Budgeting": "bg-blue-50 text-blue-700 border-blue-200",
      "Savings": "bg-emerald-50 text-emerald-700 border-emerald-200",
      "Investing": "bg-purple-50 text-purple-700 border-purple-200",
      "Habits": "bg-amber-50 text-amber-700 border-amber-200"
    };
    return colors[category] || "bg-slate-50 text-slate-700 border-slate-200";
  };

  const getDifficultyColor = (difficulty) => {
    const colors = {
      "Beginner": "bg-green-50 text-green-700 border-green-200",
      "Essential": "bg-red-50 text-red-700 border-red-200",
      "Intermediate": "bg-yellow-50 text-yellow-700 border-yellow-200",
      "Advanced": "bg-purple-50 text-purple-700 border-purple-200"
    };
    return colors[difficulty] || "bg-slate-50 text-slate-700 border-slate-200";
  };

  return (
    <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-sm">
      <CardHeader className="border-b border-slate-100">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3 text-xl font-bold text-slate-900">
            <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-lg flex items-center justify-center">
              <Lightbulb className="w-5 h-5 text-white" />
            </div>
            Financial Wisdom
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={nextTip} className="rounded-full hover:bg-slate-100">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentTip}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="space-y-5"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-lg">{tips[currentTip].title}</h3>
                <TrendingUp className="w-5 h-5 text-emerald-500" />
              </div>
              
              <div className="flex gap-2 flex-wrap">
                <Badge className={`${getCategoryColor(tips[currentTip].category)} border font-medium`} variant="outline">
                  {tips[currentTip].category}
                </Badge>
                <Badge className={`${getDifficultyColor(tips[currentTip].difficulty)} border font-medium`} variant="outline">
                  {tips[currentTip].difficulty}
                </Badge>
              </div>
              
              <p className="text-slate-600 leading-relaxed font-medium">
                {tips[currentTip].description}
              </p>
            </div>
            
            <div className="flex justify-center space-x-2 pt-4 border-t border-slate-100">
              {tips.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentTip(index)}
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    index === currentTip 
                      ? 'bg-gradient-to-r from-blue-500 to-emerald-500 scale-110' 
                      : 'bg-slate-200 hover:bg-slate-300'
                  }`}
                />
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}