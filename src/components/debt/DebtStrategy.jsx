import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Target, Zap, Calculator, TrendingDown, DollarSign } from "lucide-react";

export default function DebtStrategy({ debts, user, analysis }) {
  const [selectedStrategy, setSelectedStrategy] = useState("avalanche");
  const [extraPayment, setExtraPayment] = useState(0);

  const calculatePayoffOrder = (strategy) => {
    if (!debts || debts.length === 0) return [];
    
    const sortedDebts = [...debts].sort((a, b) => {
      if (strategy === "avalanche") {
        return b.interest_rate - a.interest_rate; // Highest rate first
      } else if (strategy === "snowball") {
        return a.balance - b.balance; // Lowest balance first
      }
      return 0;
    });

    return sortedDebts;
  };

  const calculateTimeline = (strategy, extra = 0) => {
    const orderedDebts = calculatePayoffOrder(strategy);
    let totalMonths = 0;
    let remainingExtra = extra;

    orderedDebts.forEach((debt, index) => {
      const monthlyPayment = debt.current_payment || debt.minimum_payment;
      const totalPayment = index === 0 ? monthlyPayment + remainingExtra : monthlyPayment;
      
      const monthlyRate = debt.interest_rate / 100 / 12;
      const months = Math.ceil(Math.log(1 + (debt.balance * monthlyRate) / totalPayment) / Math.log(1 + monthlyRate));
      
      totalMonths = Math.max(totalMonths, months);
    });

    return Math.min(totalMonths, 600); // Cap at 50 years for sanity
  };

  const totalDebt = debts.reduce((sum, debt) => sum + debt.balance, 0);
  const totalMinPayments = debts.reduce((sum, debt) => sum + debt.minimum_payment, 0);
  const orderedDebts = calculatePayoffOrder(selectedStrategy);
  const timelineMonths = calculateTimeline(selectedStrategy, extraPayment);

  if (debts.length === 0) {
    return (
      <Card className="glassmorphism border-0 shadow-lg">
        <CardContent className="text-center py-12 space-y-4">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto">
            <Target className="w-10 h-10 text-blue-600" />
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-gray-900">No debt strategy available</h3>
            <p className="text-gray-500 text-sm">Add your debts to see personalized payoff strategies</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Strategy Selection */}
      <Card className="glassmorphism border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600" />
            Choose Your Payoff Strategy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className={`p-6 rounded-2xl border-2 cursor-pointer transition-all duration-300 ${
              selectedStrategy === "avalanche" 
                ? "border-blue-500 bg-blue-50" 
                : "border-gray-200 hover:border-gray-300"
            }`} onClick={() => setSelectedStrategy("avalanche")}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center">
                  <TrendingDown className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Debt Avalanche</h3>
                  <Badge className="bg-blue-50 text-blue-700 border-blue-200">Mathematically Optimal</Badge>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Pay minimums on all debts, then attack the highest interest rate debt first. Saves the most money overall.
              </p>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-green-600 font-semibold">💰 Best for:</span>
                <span className="text-gray-600">Saving money long-term</span>
              </div>
            </div>

            <div className={`p-6 rounded-2xl border-2 cursor-pointer transition-all duration-300 ${
              selectedStrategy === "snowball" 
                ? "border-purple-500 bg-purple-50" 
                : "border-gray-200 hover:border-gray-300"
            }`} onClick={() => setSelectedStrategy("snowball")}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center">
                  <Zap className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Debt Snowball</h3>
                  <Badge className="bg-purple-50 text-purple-700 border-purple-200">Psychological Wins</Badge>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Pay minimums on all debts, then attack the smallest balance first. Builds momentum with quick victories.
              </p>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-green-600 font-semibold">🎯 Best for:</span>
                <span className="text-gray-600">Staying motivated</span>
              </div>
            </div>
          </div>

          {/* Extra Payment Calculator */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-2xl border border-green-200">
            <h4 className="font-semibold text-green-900 mb-4 flex items-center gap-2">
              <Calculator className="w-5 h-5" />
              Accelerate Your Payoff
            </h4>
            <div className="grid md:grid-cols-2 gap-6 items-center">
              <div>
                <label className="block text-sm font-medium text-green-800 mb-2">
                  Extra Monthly Payment
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="number"
                    value={extraPayment}
                    onChange={(e) => setExtraPayment(parseFloat(e.target.value) || 0)}
                    className="w-full pl-10 pr-4 py-3 border border-green-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="100"
                  />
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm text-green-700 mb-1">Payoff Timeline</p>
                <p className="text-3xl font-bold text-green-600">
                  {timelineMonths > 12 ? `${Math.floor(timelineMonths / 12)}y ${timelineMonths % 12}m` : `${timelineMonths}m`}
                </p>
                {extraPayment > 0 && (
                  <p className="text-xs text-green-600 mt-1">
                    {Math.floor((calculateTimeline(selectedStrategy) - timelineMonths) / 12)} years faster!
                  </p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payoff Order */}
      <Card className="glassmorphism border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-orange-600" />
            Your {selectedStrategy === "avalanche" ? "Debt Avalanche" : "Debt Snowball"} Plan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {orderedDebts.map((debt, index) => {
            const isFirstPriority = index === 0;
            
            return (
              <div key={debt.id} className={`p-5 rounded-2xl border-2 ${
                isFirstPriority 
                  ? "border-orange-300 bg-orange-50" 
                  : "border-gray-200 bg-gray-50"
              }`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white ${
                      isFirstPriority ? "bg-orange-600" : "bg-gray-400"
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900">{debt.name}</h4>
                      <p className="text-sm text-gray-600">
                        ${debt.balance.toLocaleString()} at {debt.interest_rate}%
                      </p>
                    </div>
                  </div>
                  {isFirstPriority && (
                    <Badge className="bg-orange-100 text-orange-800 border-orange-300">
                      Focus Here! 🎯
                    </Badge>
                  )}
                </div>

                <div className="grid md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500 font-medium">Payment Strategy</p>
                    <p className="font-semibold">
                      {isFirstPriority 
                        ? `$${(debt.minimum_payment + extraPayment).toLocaleString()} (min + extra)`
                        : `$${debt.minimum_payment.toLocaleString()} (minimum)`
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 font-medium">Why This Order?</p>
                    <p className="font-semibold">
                      {selectedStrategy === "avalanche" 
                        ? `${debt.interest_rate}% interest rate`
                        : `$${debt.balance.toLocaleString()} balance`
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 font-medium">Status</p>
                    <p className="font-semibold">
                      {isFirstPriority ? "🔥 Attack mode" : "💳 Minimum payments"}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* AI Recommendations */}
      {analysis?.key_recommendations && (
        <Card className="glassmorphism border-0 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-emerald-50 to-blue-50">
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-emerald-600" />
              AI Strategy Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {analysis.key_recommendations.map((rec, index) => (
                <div key={index} className="flex items-start gap-4 p-4 bg-gradient-to-r from-emerald-50 to-blue-50 rounded-2xl">
                  <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-emerald-600 font-bold text-sm">{index + 1}</span>
                  </div>
                  <p className="text-gray-800 leading-relaxed">{rec}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}