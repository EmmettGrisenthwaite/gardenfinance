import React, { useState, useEffect } from "react";
import { User } from "@/api/entities";
import { Budget } from "@/api/entities";
import { Portfolio } from "@/api/entities";
import { Goal } from "@/api/entities";
import { MessageCircle, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

import ContextualInfo from "../components/ai/ContextualInfo";
import AIChat from "../components/ai/AIChat";
import OnboardingPrompt from "../components/dashboard/OnboardingPrompt";

export default function AIAdvisor() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [budgets, setBudgets] = useState([]);
  const [portfolios, setPortfolios] = useState([]);
  const [goals, setGoals] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const userData = await User.me();
      setUser(userData);
      
      if (userData.onboarding_completed) {
        const [budgetData, portfolioData, goalData] = await Promise.all([
          Budget.filter({ created_by: userData.email }),
          Portfolio.filter({ created_by: userData.email }),
          Goal.filter({ created_by: userData.email })
        ]);
        setBudgets(budgetData);
        setPortfolios(portfolioData);
        setGoals(goalData);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setLoading(false);
  };
  
  if (loading) {
    return <div className="p-8">Loading your advisor...</div>;
  }
  
  if (!user?.onboarding_completed) {
    return <OnboardingPrompt />;
  }

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="mb-8"
      >
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-blue-500 rounded-2xl flex items-center justify-center shadow-lg">
              <MessageCircle className="w-8 h-8 text-white" />
            </div>
            <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent">
            Your AI Financial Advisor
          </h1>
          <p className="text-slate-600 mt-2 text-lg">
            Get personalized advice based on your complete financial profile
          </p>
        </div>
      </motion.div>
      
      <div className="grid lg:grid-cols-4 gap-8 items-start">
        {/* Main Chat Area */}
        <div className="lg:col-span-3">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="h-[70vh] bg-white/90 backdrop-blur-sm rounded-2xl border border-slate-200 shadow-xl overflow-hidden"
          >
            <AIChat 
              user={user}
              portfolios={portfolios}
              goals={goals}
              budgets={budgets}
            />
          </motion.div>
        </div>

        {/* Contextual Info Sidebar */}
        <div className="lg:col-span-1">
          <ContextualInfo 
            user={user}
            portfolios={portfolios}
            goals={goals}
            budgets={budgets}
          />
        </div>
      </div>
    </div>
  );
}