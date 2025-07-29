import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { TrendingDown, Lightbulb, AlertTriangle, DollarSign, Calendar } from "lucide-react";

export default function DebtAnalysis({ debts, user, analysis, onGenerateAnalysis }) {
  if (debts.length === 0) {
    return (
      <Card className="glassmorphism border-0 shadow-lg">
        <CardContent className="text-center py-12 space-y-4">
          <div className="w-20 h-20 bg-purple-50 rounded-full flex items-center justify-center mx-auto">
            <TrendingDown className="w-10 h-10 text-purple-600" />
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-gray-900">No debt data to analyze</h3>
            <p className="text-gray-500 text-sm">Add your debts to get AI-powered insights</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate basic metrics
  const totalDebt = debts.reduce((sum, debt) => sum + debt.balance, 0);
  const totalMinPayments = debts.reduce((sum, debt) => sum + debt.minimum_payment, 0);
  const weightedAvgRate = debts.reduce((sum, debt) => sum + (debt.interest_rate * debt.balance), 0) / totalDebt;
  const monthlyIncomeRatio = user?.income_monthly ? (totalMinPayments / user.income_monthly) * 100 : 0;

  // Prepare chart data
  const debtBreakdownData = debts.map(debt => ({
    name: debt.name,
    balance: debt.balance,
    rate: debt.interest_rate,
    payment: debt.minimum_payment
  }));

  const debtByTypeData = debts.reduce((acc, debt) => {
    const existing = acc.find(item => item.type === debt.type);
    if (existing) {
      existing.balance += debt.balance;
      existing.count += 1;
    } else {
      acc.push({
        type: debt.type.replace('_', ' ').toUpperCase(),
        balance: debt.balance,
        count: 1
      });
    }
    return acc;
  }, []);

  const colors = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6'];

  const getRiskAssessment = () => {
    if (weightedAvgRate >= 20) return { level: 'High Risk', color: 'bg-red-50 text-red-700 border-red-200', icon: '🚨' };
    if (weightedAvgRate >= 15) return { level: 'Moderate Risk', color: 'bg-orange-50 text-orange-700 border-orange-200', icon: '⚠️' };
    if (weightedAvgRate >= 10) return { level: 'Average Risk', color: 'bg-yellow-50 text-yellow-700 border-yellow-200', icon: '📊' };
    return { level: 'Low Risk', color: 'bg-green-50 text-green-700 border-green-200', icon: '✅' };
  };

  const riskAssessment = getRiskAssessment();

  return (
    <div className="space-y-6">
      {/* Quick Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glassmorphism border-0 shadow-lg">
          <CardContent className="p-4 text-center">
            <DollarSign className="w-8 h-8 text-red-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-red-600">${totalDebt.toLocaleString()}</p>
            <p className="text-sm text-gray-500">Total Debt</p>
          </CardContent>
        </Card>

        <Card className="glassmorphism border-0 shadow-lg">
          <CardContent className="p-4 text-center">
            <Calendar className="w-8 h-8 text-orange-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-orange-600">${totalMinPayments.toLocaleString()}</p>
            <p className="text-sm text-gray-500">Monthly Minimums</p>
          </CardContent>
        </Card>

        <Card className="glassmorphism border-0 shadow-lg">
          <CardContent className="p-4 text-center">
            <TrendingDown className="w-8 h-8 text-purple-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-purple-600">{weightedAvgRate.toFixed(1)}%</p>
            <p className="text-sm text-gray-500">Avg Interest Rate</p>
          </CardContent>
        </Card>

        <Card className="glassmorphism border-0 shadow-lg">
          <CardContent className="p-4 text-center">
            <div className="text-2xl mb-2">{riskAssessment.icon}</div>
            <Badge className={`${riskAssessment.color} border mb-2`} variant="outline">
              {riskAssessment.level}
            </Badge>
            <p className="text-sm text-gray-500">Risk Level</p>
          </CardContent>
        </Card>
      </div>

      {/* Debt Breakdown Chart */}
      <Card className="glassmorphism border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-blue-600" />
            Debt Breakdown Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h4 className="font-semibold text-gray-900 mb-4">Balance vs Interest Rate</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={debtBreakdownData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip 
                      formatter={(value, name) => [
                        name === 'balance' ? `$${value.toLocaleString()}` : `${value}%`,
                        name === 'balance' ? 'Balance' : 'Interest Rate'
                      ]}
                    />
                    <Bar dataKey="balance" fill="#ef4444" name="balance" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 mb-4">Debt by Type</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={debtByTypeData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="balance"
                    >
                      {debtByTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`$${value.toLocaleString()}`, 'Balance']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Financial Health Assessment */}
      <Card className="glassmorphism border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
            Financial Health Assessment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-600">Debt-to-Income Ratio</span>
                  <span className="text-sm font-semibold">{monthlyIncomeRatio.toFixed(1)}%</span>
                </div>
                <Progress 
                  value={Math.min(monthlyIncomeRatio, 100)} 
                  className={`h-3 ${monthlyIncomeRatio > 40 ? 'text-red-600' : monthlyIncomeRatio > 20 ? 'text-orange-600' : 'text-green-600'}`} 
                />
                <p className="text-xs text-gray-500 mt-1">
                  {monthlyIncomeRatio > 40 ? 'High risk - Consider debt consolidation' : 
                   monthlyIncomeRatio > 20 ? 'Moderate - Room for improvement' : 
                   'Healthy debt level'}
                </p>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-600">Average Interest Rate</span>
                  <span className="text-sm font-semibold">{weightedAvgRate.toFixed(1)}%</span>
                </div>
                <Progress 
                  value={Math.min((weightedAvgRate / 25) * 100, 100)} 
                  className={`h-3 ${weightedAvgRate > 18 ? 'text-red-600' : weightedAvgRate > 12 ? 'text-orange-600' : 'text-green-600'}`} 
                />
                <p className="text-xs text-gray-500 mt-1">
                  {weightedAvgRate > 18 ? 'Very high - Prioritize payoff' : 
                   weightedAvgRate > 12 ? 'Above average - Consider refinancing' : 
                   'Reasonable rates'}
                </p>
              </div>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-2xl">
              <h4 className="font-semibold text-blue-900 mb-3">💡 Key Insights</h4>
              <ul className="space-y-2 text-sm text-blue-800">
                <li>• You have {debts.length} active debt accounts</li>
                <li>• Highest rate: {Math.max(...debts.map(d => d.interest_rate))}% 
                    ({debts.find(d => d.interest_rate === Math.max(...debts.map(d => d.interest_rate)))?.name})
                </li>
                <li>• Largest balance: ${Math.max(...debts.map(d => d.balance)).toLocaleString()} 
                    ({debts.find(d => d.balance === Math.max(...debts.map(d => d.balance)))?.name})
                </li>
                {user?.income_monthly && (
                  <li>• Debt payments use {monthlyIncomeRatio.toFixed(0)}% of your income</li>
                )}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Analysis Results */}
      {!analysis ? (
        <Card className="glassmorphism border-0 shadow-lg">
          <CardContent className="text-center py-12 space-y-4">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto">
              <Lightbulb className="w-10 h-10 text-purple-600" />
            </div>
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900 text-lg">Get AI-Powered Debt Analysis</h3>
              <p className="text-gray-600 max-w-md mx-auto">
                Let our AI analyze your debt portfolio and provide personalized strategies for faster payoff and savings optimization.
              </p>
            </div>
            <Button
              onClick={onGenerateAnalysis}
              className="bg-gradient-to-r from-purple-600 to-indigo-500 hover:from-purple-700 hover:to-indigo-600 gap-2"
            >
              <Lightbulb className="w-4 h-4" />
              Generate AI Analysis
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="glassmorphism border-0 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-purple-50 to-indigo-50">
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-purple-600" />
              AI Debt Analysis Results
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {analysis.recommended_strategy && (
              <div className="bg-gradient-to-r from-emerald-50 to-blue-50 p-6 rounded-2xl">
                <h4 className="font-bold text-emerald-900 mb-2">🎯 Recommended Strategy</h4>
                <p className="text-emerald-800 capitalize font-semibold text-lg">
                  {analysis.recommended_strategy} Method
                </p>
                <p className="text-emerald-700 text-sm mt-2">
                  Based on your debt profile and financial situation, this approach will optimize your payoff timeline.
                </p>
              </div>
            )}

            {analysis.payoff_timeline && (
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 bg-orange-50 rounded-2xl border border-orange-200">
                  <h5 className="font-semibold text-orange-900 mb-1">Minimum Payments Only</h5>
                  <p className="text-2xl font-bold text-orange-600">
                    {analysis.payoff_timeline.minimum_payments > 12 
                      ? `${Math.floor(analysis.payoff_timeline.minimum_payments / 12)}y ${analysis.payoff_timeline.minimum_payments % 12}m`
                      : `${analysis.payoff_timeline.minimum_payments}m`
                    }
                  </p>
                </div>
                <div className="p-4 bg-green-50 rounded-2xl border border-green-200">
                  <h5 className="font-semibold text-green-900 mb-1">Optimized Strategy</h5>
                  <p className="text-2xl font-bold text-green-600">
                    {analysis.payoff_timeline.optimized_strategy > 12 
                      ? `${Math.floor(analysis.payoff_timeline.optimized_strategy / 12)}y ${analysis.payoff_timeline.optimized_strategy % 12}m`
                      : `${analysis.payoff_timeline.optimized_strategy}m`
                    }
                  </p>
                  <p className="text-green-700 text-sm">
                    Save {analysis.payoff_timeline.minimum_payments - analysis.payoff_timeline.optimized_strategy} months!
                  </p>
                </div>
              </div>
            )}

            {analysis.key_recommendations && (
              <div className="space-y-3">
                <h4 className="font-semibold text-gray-900">💡 Personalized Recommendations</h4>
                {analysis.key_recommendations.map((rec, index) => (
                  <div key={index} className="flex items-start gap-3 p-4 bg-blue-50 rounded-xl">
                    <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs font-bold">{index + 1}</span>
                    </div>
                    <p className="text-blue-900 leading-relaxed">{rec}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}