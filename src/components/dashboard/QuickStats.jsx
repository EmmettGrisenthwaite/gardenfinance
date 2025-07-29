import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, PiggyBank, Target, TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { motion } from "framer-motion";

export default function QuickStats({ user, currentBudget, currentPortfolio, activeGoals }) {
  const stats = [
    {
      title: "Monthly Income",
      value: user?.income_monthly ? `$${user.income_monthly.toLocaleString()}` : "Not set",
      icon: DollarSign,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
      borderColor: "border-emerald-200",
      change: "+8% vs last month",
      trend: "up"
    },
    {
      title: "Total Savings",
      value: user?.savings_current ? `$${user.savings_current.toLocaleString()}` : "$0",
      icon: PiggyBank,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200",
      change: "+12% this month",
      trend: "up"
    },
    {
      title: "Portfolio Value",
      value: currentPortfolio?.total_value ? `$${currentPortfolio.total_value.toLocaleString()}` : "$0",
      icon: TrendingUp,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      borderColor: "border-purple-200",
      change: "+5.2% this week",
      trend: "up"
    },
    {
      title: "Active Goals",
      value: activeGoals?.length || 0,
      icon: Target,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
      borderColor: "border-amber-200",
      change: `${activeGoals?.filter(g => g.current_amount / g.target_amount > 0.5).length || 0} on track`,
      trend: "neutral"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat, index) => (
        <motion.div
          key={stat.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: index * 0.1 }}
        >
          <Card className={`border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-white/80 backdrop-blur-sm ${stat.borderColor} border-2`}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-3 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-600">{stat.title}</p>
                  </div>
                  <p className="text-2xl lg:text-3xl font-bold text-slate-900">{stat.value}</p>
                  <div className="flex items-center gap-2">
                    {stat.trend === "up" && <ArrowUpRight className="w-4 h-4 text-emerald-500" />}
                    {stat.trend === "down" && <ArrowDownRight className="w-4 h-4 text-red-500" />}
                    <p className="text-xs text-slate-500 font-medium">{stat.change}</p>
                  </div>
                </div>
                <div className={`w-14 h-14 ${stat.bgColor} rounded-2xl flex items-center justify-center border-2 ${stat.borderColor}`}>
                  <stat.icon className={`w-7 h-7 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}