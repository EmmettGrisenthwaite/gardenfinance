import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Target, Plus, ArrowUpRight, Calendar, DollarSign } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function GoalsOverview({ goals }) {
  const topGoals = goals?.slice(0, 3) || [];

  const getCategoryColor = (category) => {
    const colors = {
      emergency_fund: "bg-red-50 text-red-700 border-red-200",
      travel: "bg-blue-50 text-blue-700 border-blue-200",
      education: "bg-purple-50 text-purple-700 border-purple-200",
      car: "bg-green-50 text-green-700 border-green-200",
      house: "bg-orange-50 text-orange-700 border-orange-200",
      debt_payoff: "bg-slate-50 text-slate-700 border-slate-200",
      other: "bg-slate-50 text-slate-700 border-slate-200"
    };
    return colors[category] || colors.other;
  };

  const getProgressPercent = (goal) => {
    return Math.min((goal.current_amount / goal.target_amount) * 100, 100);
  };

  return (
    <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-sm">
      <CardHeader className="border-b border-slate-100">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3 text-xl font-bold text-slate-900">
            <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg flex items-center justify-center">
              <Target className="w-5 h-5 text-white" />
            </div>
            Your Financial Goals
          </CardTitle>
          <Link to={createPageUrl("Goals")}>
            <Button variant="outline" size="sm" className="gap-2 hover:bg-slate-50 border-slate-200">
              View All <ArrowUpRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {topGoals.length > 0 ? (
          <div className="space-y-6">
            {topGoals.map((goal) => (
              <div key={goal.id} className="p-5 bg-gradient-to-r from-slate-50 to-blue-50 rounded-xl border border-slate-200 hover:shadow-md transition-all duration-200">
                <div className="flex items-start justify-between mb-4">
                  <div className="space-y-2">
                    <h4 className="font-bold text-slate-900 text-lg">{goal.title}</h4>
                    <Badge className={`${getCategoryColor(goal.category)} border font-medium`} variant="outline">
                      {goal.category.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-slate-600">
                      <DollarSign className="w-4 h-4" />
                      <p className="text-sm font-medium">Progress</p>
                    </div>
                    <p className="text-xl font-bold text-slate-900">
                      ${goal.current_amount?.toLocaleString() || 0}
                    </p>
                    <p className="text-sm text-slate-500 font-medium">
                      of ${goal.target_amount?.toLocaleString()}
                    </p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-700">{getProgressPercent(goal).toFixed(0)}% complete</span>
                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs" variant="outline">
                        On Track
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 text-slate-500">
                      <Calendar className="w-4 h-4" />
                      <span className="font-medium">
                        Due {new Date(goal.target_date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="relative">
                    <Progress 
                      value={getProgressPercent(goal)} 
                      className="h-3 bg-slate-200"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-blue-500 rounded-full" 
                         style={{ width: `${getProgressPercent(goal)}%` }}></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 space-y-6">
            <div className="w-20 h-20 bg-gradient-to-br from-amber-100 to-orange-100 rounded-full flex items-center justify-center mx-auto">
              <Target className="w-10 h-10 text-amber-600" />
            </div>
            <div className="space-y-3">
              <h3 className="font-bold text-slate-900 text-lg">No goals yet</h3>
              <p className="text-slate-600 text-sm max-w-sm mx-auto">Start building your financial future by setting your first savings goal!</p>
            </div>
            <Link to={createPageUrl("Goals")}>
              <Button className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg gap-2 font-semibold">
                <Plus className="w-4 h-4" />
                Create Your First Goal
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}