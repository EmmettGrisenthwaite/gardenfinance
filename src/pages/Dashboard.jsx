
import React, { useState, useEffect } from "react";
import { User } from "@/api/entities";
import { Budget } from "@/api/entities";
import { Portfolio } from "@/api/entities";
import { Goal } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { 
  TrendingUp, 
  Target, 
  DollarSign, 
  PiggyBank,
  ArrowUpRight,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Plus
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import WelcomeCard from "../components/dashboard/WelcomeCard";
import QuickStats from "../components/dashboard/QuickStats";
import GoalsOverview from "../components/dashboard/GoalsOverview";
import FinancialTips from "../components/dashboard/FinancialTips";
import OnboardingPrompt from "../components/dashboard/OnboardingPrompt";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [budgets, setBudgets] = useState([]);
  const [portfolios, setPortfolios] = useState([]);
  const [goals, setGoals] = useState([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const userData = await User.me();
      setUser(userData);
      
      if (userData.onboarding_completed) {
        const [budgetData, portfolioData, goalData] = await Promise.all([
          Budget.filter({ created_by: userData.email }),
          Portfolio.filter({ created_by: userData.email }),
          Goal.filter({ created_by: userData.email }, '-created_date')
        ]);
        
        setBudgets(budgetData);
        setPortfolios(portfolioData);
        setGoals(goalData);
      }
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array(4).fill(0).map((_, i) => (
            <Card key={i} className="animate-pulse border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="h-4 bg-slate-200 rounded mb-3"></div>
                <div className="h-8 bg-slate-200 rounded mb-2"></div>
                <div className="h-3 bg-slate-200 rounded w-3/4"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!user?.onboarding_completed) {
    return <OnboardingPrompt />;
  }

  const currentBudget = budgets[0];
  const currentPortfolio = portfolios.find(p => p.type === 'current');
  const activeGoals = goals.filter(g => g.status === 'active');

  return (
    <div className="p-4 lg:p-8 space-y-8 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <WelcomeCard user={user} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
      >
        <QuickStats 
          user={user}
          currentBudget={currentBudget}
          currentPortfolio={currentPortfolio}
          activeGoals={activeGoals}
        />
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <GoalsOverview goals={activeGoals} />
          </motion.div>

          {/* AI Actions Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-sm">
              <CardHeader className="border-b border-slate-100">
                <CardTitle className="flex items-center gap-3 text-xl font-bold text-slate-900">
                  <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-blue-500 rounded-lg flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  AI-Powered Financial Tools
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Link to={createPageUrl("AIAdvisor?topic=budget")}>
                    <Button 
                      variant="outline" 
                      className="w-full h-24 flex flex-col gap-3 border-2 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50 transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
                    >
                      <DollarSign className="w-8 h-8 text-emerald-600" />
                      <span className="font-semibold text-slate-700">Ask AI About My Budget</span>
                    </Button>
                  </Link>
                  <Link to={createPageUrl("AIAdvisor?topic=portfolio")}>
                    <Button 
                      variant="outline" 
                      className="w-full h-24 flex flex-col gap-3 border-2 border-purple-200 hover:border-purple-400 hover:bg-purple-50 transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
                    >
                      <TrendingUp className="w-8 h-8 text-purple-600" />
                      <span className="font-semibold text-slate-700">Optimize Portfolio with AI</span>
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <div className="space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <FinancialTips />
          </motion.div>

          {/* Portfolio Summary */}
          {currentPortfolio && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
            >
              <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-sm">
                <CardHeader className="border-b border-slate-100">
                  <CardTitle className="flex items-center gap-3 text-xl font-bold text-slate-900">
                    <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-lg flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-white" />
                    </div>
                    Portfolio Snapshot
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-slate-900">
                      ${currentPortfolio.total_value?.toLocaleString() || '0'}
                    </p>
                    <p className="text-sm text-slate-500 font-medium">Total Value</p>
                  </div>
                  {currentPortfolio.analysis && (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-slate-600">Risk Score</span>
                        <Badge className={currentPortfolio.analysis.risk_score > 7 ? "bg-red-50 text-red-700 border-red-200" : "bg-green-50 text-green-700 border-green-200"} variant="outline">
                          {currentPortfolio.analysis.risk_score}/10
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-slate-600">Diversification</span>
                        <Badge className={currentPortfolio.analysis.diversification_score > 7 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-yellow-50 text-yellow-700 border-yellow-200"} variant="outline">
                          {currentPortfolio.analysis.diversification_score}/10
                        </Badge>
                      </div>
                    </div>
                  )}
                  <Link to={createPageUrl("Portfolio")}>
                    <Button variant="outline" size="sm" className="w-full gap-2 hover:bg-slate-50 border-slate-200 font-semibold">
                      View Full Portfolio <ArrowUpRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
