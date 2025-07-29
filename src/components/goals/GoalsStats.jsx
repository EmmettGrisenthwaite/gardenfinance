import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target, TrendingUp, Calendar, CheckCircle } from "lucide-react";

export default function GoalsStats({ goals }) {
  const activeGoals = goals.filter(g => g.status === 'active');
  const completedGoals = goals.filter(g => g.status === 'completed');
  const totalTargetAmount = activeGoals.reduce((sum, goal) => sum + (goal.target_amount || 0), 0);
  const totalCurrentAmount = activeGoals.reduce((sum, goal) => sum + (goal.current_amount || 0), 0);
  const overallProgress = totalTargetAmount > 0 ? (totalCurrentAmount / totalTargetAmount) * 100 : 0;

  const stats = [
    {
      title: "Active Goals",
      value: activeGoals.length,
      icon: Target,
      color: "text-orange-600",
      bgColor: "bg-orange-50"
    },
    {
      title: "Completed Goals",
      value: completedGoals.length,
      icon: CheckCircle,
      color: "text-green-600", 
      bgColor: "bg-green-50"
    },
    {
      title: "Total Progress",
      value: `${overallProgress.toFixed(0)}%`,
      icon: TrendingUp,
      color: "text-blue-600",
      bgColor: "bg-blue-50"
    },
    {
      title: "Target Amount",
      value: `$${totalTargetAmount.toLocaleString()}`,
      icon: Calendar,
      color: "text-purple-600",
      bgColor: "bg-purple-50"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat, index) => (
        <Card key={stat.title} className="glassmorphism border-0 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-500">{stat.title}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
              <div className={`w-12 h-12 ${stat.bgColor} rounded-2xl flex items-center justify-center`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}