import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, AlertCircle, CheckCircle2 } from "lucide-react";

const categories = [
  { key: "housing", label: "Housing & Rent", icon: "🏠", color: "text-blue-600", recommended: 30 },
  { key: "food", label: "Food & Dining", icon: "🍕", color: "text-green-600", recommended: 15 },
  { key: "transportation", label: "Transportation", icon: "🚗", color: "text-purple-600", recommended: 15 },
  { key: "entertainment", label: "Entertainment", icon: "🎬", color: "text-pink-600", recommended: 10 },
  { key: "shopping", label: "Shopping", icon: "🛍️", color: "text-orange-600", recommended: 8 },
  { key: "subscriptions", label: "Subscriptions", icon: "📱", color: "text-indigo-600", recommended: 5 },
  { key: "debt_payments", label: "Debt Payments", icon: "💳", color: "text-red-600", recommended: 10 },
  { key: "savings", label: "Savings & Investing", icon: "💰", color: "text-emerald-600", recommended: 20 },
  { key: "other", label: "Other Expenses", icon: "📝", color: "text-gray-600", recommended: 7 }
];

export default function BudgetForm({ budgetData, setBudgetData }) {
  const handleIncomeChange = (value) => {
    setBudgetData(prev => ({
      ...prev,
      monthly_income: parseFloat(value) || 0
    }));
  };

  const handleCategoryChange = (category, value) => {
    setBudgetData(prev => ({
      ...prev,
      categories: {
        ...prev.categories,
        [category]: parseFloat(value) || 0
      }
    }));
  };

  const totalExpenses = Object.values(budgetData.categories).reduce((a, b) => a + b, 0);
  const remaining = budgetData.monthly_income - totalExpenses;
  const budgetHealthScore = budgetData.monthly_income > 0 ? Math.max(0, Math.min(100, ((remaining / budgetData.monthly_income) * 100) + 50)) : 0;

  const getCategoryStatus = (category, amount) => {
    if (budgetData.monthly_income === 0) return "neutral";
    const percentage = (amount / budgetData.monthly_income) * 100;
    const recommended = categories.find(c => c.key === category)?.recommended || 10;
    
    if (percentage <= recommended * 0.8) return "under";
    if (percentage <= recommended * 1.2) return "good";
    return "over";
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "under": return "text-blue-600 bg-blue-50 border-blue-200";
      case "good": return "text-green-600 bg-green-50 border-green-200";
      case "over": return "text-red-600 bg-red-50 border-red-200";
      default: return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  return (
    <div className="space-y-6">
      {/* Income Section with Visual Enhancement */}
      <Card className="glassmorphism border-0 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-emerald-50 to-blue-50 rounded-t-2xl">
          <CardTitle className="flex items-center gap-2 text-xl">
            <DollarSign className="w-6 h-6 text-emerald-600" />
            Monthly Income
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="relative">
              <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 text-lg font-medium">$</span>
              <Input
                type="number"
                placeholder="5,000"
                value={budgetData.monthly_income || ""}
                onChange={(e) => handleIncomeChange(e.target.value)}
                className="pl-10 h-14 text-xl font-semibold border-2 rounded-xl focus:border-emerald-500 transition-all"
              />
            </div>
            {budgetData.monthly_income > 0 && (
              <div className="flex items-center gap-4 p-4 bg-emerald-50 rounded-xl">
                <div className="flex-1">
                  <p className="text-sm font-medium text-emerald-700">Budget Health Score</p>
                  <div className="flex items-center gap-3 mt-2">
                    <Progress value={budgetHealthScore} className="flex-1 h-3" />
                    <span className="font-bold text-emerald-600">{Math.round(budgetHealthScore)}/100</span>
                  </div>
                </div>
                {budgetHealthScore >= 70 ? (
                  <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-8 h-8 text-orange-500" />
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Advanced Category Management */}
      <Card className="glassmorphism border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <TrendingUp className="w-6 h-6 text-blue-600" />
            Budget Categories
          </CardTitle>
          <p className="text-gray-600">Track your spending across different categories with intelligent recommendations</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {categories.map((category) => {
            const amount = budgetData.categories[category.key] || 0;
            const percentage = budgetData.monthly_income > 0 ? (amount / budgetData.monthly_income) * 100 : 0;
            const status = getCategoryStatus(category.key, amount);
            
            return (
              <div key={category.key} className="group p-5 bg-white/70 rounded-2xl border border-white/40 hover:shadow-md transition-all duration-300">
                <div className="flex items-center gap-4 mb-3">
                  <div className="flex items-center gap-3 flex-1">
                    <span className="text-3xl">{category.icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Label className={`font-semibold ${category.color} text-base`}>
                          {category.label}
                        </Label>
                        <Badge variant="outline" className={`text-xs ${getStatusColor(status)}`}>
                          {status === "good" ? "Optimal" : status === "over" ? "Over Budget" : "Under Budget"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>{percentage.toFixed(1)}% of income</span>
                        <span>•</span>
                        <span>Recommended: {category.recommended}%</span>
                      </div>
                    </div>
                  </div>
                  <div className="relative w-32">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">$</span>
                    <Input
                      type="number"
                      placeholder="0"
                      value={budgetData.categories[category.key] || ""}
                      onChange={(e) => handleCategoryChange(category.key, e.target.value)}
                      className="pl-8 h-11 text-right font-semibold border-2 rounded-xl focus:border-blue-500 transition-all"
                    />
                  </div>
                </div>
                
                {/* Visual Progress Bar for Each Category */}
                {budgetData.monthly_income > 0 && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Current: {percentage.toFixed(1)}%</span>
                      <span>Target: {category.recommended}%</span>
                    </div>
                    <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ${
                          status === "good" ? "bg-green-500" : 
                          status === "over" ? "bg-red-500" : "bg-blue-500"
                        }`}
                        style={{ width: `${Math.min(100, (percentage / category.recommended) * 100)}%` }}
                      />
                      <div 
                        className="absolute top-0 w-0.5 h-full bg-gray-400"
                        style={{ left: "100%" }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Enhanced Summary with Insights */}
      <Card className="glassmorphism border-0 shadow-lg">
        <CardContent className="p-6">
          <div className="grid md:grid-cols-3 gap-6 text-center">
            <div className="p-4 bg-blue-50 rounded-2xl">
              <p className="text-2xl font-bold text-blue-600">${budgetData.monthly_income.toLocaleString()}</p>
              <p className="text-sm text-gray-600 font-medium">Monthly Income</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-2xl">
              <p className="text-2xl font-bold text-purple-600">${totalExpenses.toLocaleString()}</p>
              <p className="text-sm text-gray-600 font-medium">Total Allocated</p>
            </div>
            <div className={`p-4 rounded-2xl ${remaining >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              <p className={`text-2xl font-bold ${remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${Math.abs(remaining).toLocaleString()}
              </p>
              <p className="text-sm text-gray-600 font-medium">
                {remaining >= 0 ? 'Available' : 'Over Budget'}
              </p>
            </div>
          </div>
          
          {remaining < 0 && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-red-600 mt-0.5" />
              <div>
                <h4 className="font-semibold text-red-800">Budget Alert</h4>
                <p className="text-red-700 text-sm mt-1">
                  You're spending ${Math.abs(remaining).toLocaleString()} more than you earn. Consider reducing expenses in categories marked as "Over Budget".
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}