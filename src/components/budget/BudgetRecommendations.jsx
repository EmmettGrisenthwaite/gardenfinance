import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Lightbulb, TrendingUp, AlertTriangle, CheckCircle, Target, Zap } from "lucide-react";

export default function BudgetRecommendations({ recommendations }) {
  const getScoreColor = (score) => {
    if (score >= 8) return "text-green-600 bg-green-50 border-green-200";
    if (score >= 6) return "text-yellow-600 bg-yellow-50 border-yellow-200"; 
    return "text-red-600 bg-red-50 border-red-200";
  };

  const getScoreBadge = (score) => {
    if (score >= 8) return { label: "Excellent", icon: CheckCircle };
    if (score >= 6) return { label: "Good", icon: Target };
    if (score >= 4) return { label: "Needs Work", icon: AlertTriangle };
    return { label: "Poor", icon: AlertTriangle };
  };

  const scoreBadge = getScoreBadge(recommendations.overall_score || 0);

  return (
    <div className="space-y-6">
      {/* Overall Score Card */}
      {recommendations.overall_score && (
        <Card className="glassmorphism border-0 shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${getScoreColor(recommendations.overall_score)}`}>
                  <scoreBadge.icon className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">Budget Health Score</h3>
                  <p className="text-gray-600">Based on AI analysis of your spending patterns</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-4xl font-bold text-blue-600">{recommendations.overall_score}/10</div>
                <Badge className={`mt-2 ${getScoreColor(recommendations.overall_score)}`}>
                  {scoreBadge.label}
                </Badge>
              </div>
            </div>
            <div className="mt-4">
              <Progress value={recommendations.overall_score * 10} className="h-3" />
            </div>
          </div>
        </Card>
      )}

      {/* Key Recommendations */}
      {recommendations.recommendations && recommendations.recommendations.length > 0 && (
        <Card className="glassmorphism border-0 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50">
            <CardTitle className="flex items-center gap-2 text-xl">
              <CheckCircle className="w-6 h-6 text-green-600" />
              Priority Actions
            </CardTitle>
            <p className="text-gray-600 text-sm">AI-powered recommendations to improve your financial health</p>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {recommendations.recommendations.map((rec, index) => (
                <div key={index} className="group p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl border border-green-100 hover:shadow-md transition-all duration-300">
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm">
                      <span className="text-green-600 font-bold text-sm">{index + 1}</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-800 font-medium leading-relaxed">{rec}</p>
                    </div>
                    <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <Zap className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Optimization Opportunities */}
      {recommendations.optimizations && recommendations.optimizations.length > 0 && (
        <Card className="glassmorphism border-0 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
            <CardTitle className="flex items-center gap-2 text-xl">
              <TrendingUp className="w-6 h-6 text-blue-600" />
              Optimization Opportunities
            </CardTitle>
            <p className="text-gray-600 text-sm">Ways to maximize your financial efficiency</p>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {recommendations.optimizations.map((opt, index) => (
                <div key={index} className="group p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 hover:shadow-md transition-all duration-300">
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm">
                      <TrendingUp className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-800 font-medium leading-relaxed">{opt}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Category-Specific Feedback */}
      {recommendations.category_feedback && (
        <Card className="glassmorphism border-0 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-orange-50 to-yellow-50">
            <CardTitle className="flex items-center gap-2 text-xl">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
              Category Deep Dive
            </CardTitle>
            <p className="text-gray-600 text-sm">Detailed analysis of your spending categories</p>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid gap-4">
              {Object.entries(recommendations.category_feedback)
                .filter(([_, feedback]) => feedback && feedback.trim())
                .map(([category, feedback]) => (
                  <div key={category} className="group p-5 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-2xl border border-orange-100 hover:shadow-md transition-all duration-300">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                        <span className="text-2xl">
                          {category === 'housing' ? '🏠' :
                           category === 'food' ? '🍕' :
                           category === 'transportation' ? '🚗' :
                           category === 'entertainment' ? '🎬' :
                           category === 'shopping' ? '🛍️' :
                           category === 'subscriptions' ? '📱' :
                           category === 'debt_payments' ? '💳' :
                           category === 'savings' ? '💰' : '📝'}
                        </span>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-orange-900 text-lg capitalize mb-2">
                          {category.replace('_', ' ')}
                        </h4>
                        <p className="text-orange-800 leading-relaxed">{feedback}</p>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Insights Footer */}
      <Card className="glassmorphism border-0 shadow-lg">
        <CardContent className="p-6">
          <div className="flex items-center gap-4 text-center">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center">
              <Lightbulb className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 text-left">
              <h4 className="font-semibold text-gray-900">Powered by AI Financial Analysis</h4>
              <p className="text-sm text-gray-600">These recommendations are based on your spending patterns, income level, and financial goals. Consider discussing major changes with your AI advisor.</p>
            </div>
            <Button variant="outline" className="gap-2">
              <Zap className="w-4 h-4" />
              Ask AI More
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}