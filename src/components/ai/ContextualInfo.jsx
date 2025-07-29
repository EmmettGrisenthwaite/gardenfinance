import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { DollarSign, PiggyBank, TrendingUp, Target, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export default function ContextualInfo({ user, portfolios, goals, budgets }) {
  const currentPortfolio = portfolios.find(p => p.type === 'current');
  const activeGoals = goals.filter(g => g.status === 'active');
  const currentBudget = budgets[0];

  const stats = [
    {
      title: "Monthly Income",
      value: user?.income_monthly ? `$${user.income_monthly.toLocaleString()}` : "Not set",
      icon: DollarSign,
      color: "text-emerald-600",
      link: createPageUrl("BudgetBuilder"),
      linkText: "View Budget"
    },
    {
      title: "Portfolio Value",
      value: currentPortfolio?.total_value ? `$${currentPortfolio.total_value.toLocaleString()}` : "$0",
      icon: TrendingUp,
      color: "text-purple-600",
      link: createPageUrl("Portfolio"),
      linkText: "View Portfolio"
    },
    {
      title: "Active Goals",
      value: activeGoals.length,
      icon: Target,
      color: "text-orange-600",
      link: createPageUrl("Goals"),
      linkText: "View Goals"
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className="space-y-6"
    >
      <Card className="glassmorphism border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg">Your Financial Snapshot</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {stats.map(stat => (
            <div key={stat.title} className="p-4 bg-white/50 rounded-xl border border-white/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 flex items-center justify-center rounded-lg bg-white`}>
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">{stat.title}</p>
                    <p className="text-lg font-bold text-gray-900">{stat.value}</p>
                  </div>
                </div>
                <Link to={stat.link}>
                  <ArrowRight className="w-5 h-5 text-gray-400 hover:text-gray-700 transition" />
                </Link>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="glassmorphism border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg">AI Knowledge Base</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            Your AI advisor has access to all your financial data to provide the best possible advice.
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Onboarding Data</Badge>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Budget</Badge>
            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">Portfolio</Badge>
            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">Goals</Badge>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}