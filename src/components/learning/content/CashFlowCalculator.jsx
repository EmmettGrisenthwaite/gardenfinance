import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calculator, TrendingUp, AlertCircle, CheckCircle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export default function CashFlowCalculator({ title, inputs }) {
  const [values, setValues] = useState({
    monthlyIncome: 5000,
    fixedExpenses: 2000,
    variableExpenses: 1500,
    savingsGoal: 500,
    annualBonus: 0
  });
  const [selectedScenario, setSelectedScenario] = useState("current");
  const [projection, setProjection] = useState(null);

  const scenarios = {
    current: { name: "Current Path", income: 1.0, expenses: 1.0, inflation: 1.03 },
    optimistic: { name: "Optimistic", income: 1.1, expenses: 0.95, inflation: 1.02 },
    conservative: { name: "Conservative", income: 0.95, expenses: 1.05, inflation: 1.04 }
  };

  const handleInputChange = (field, value) => {
    setValues(prev => ({ ...prev, [field]: parseFloat(value) || 0 }));
  };

  const calculateProjection = () => {
    const scenario = scenarios[selectedScenario];
    const projectionData = [];
    let cumulativeSurplus = 0;

    for (let month = 1; month <= 12; month++) {
      const adjustedIncome = values.monthlyIncome * scenario.income;
      const bonusMonth = month === 12 ? values.annualBonus : 0;
      const totalIncome = adjustedIncome + bonusMonth;
      
      const adjustedFixed = values.fixedExpenses * scenario.expenses;
      const adjustedVariable = values.variableExpenses * scenario.expenses;
      const inflationFactor = Math.pow(scenario.inflation, month/12);
      
      const totalExpenses = (adjustedFixed + adjustedVariable) * inflationFactor;
      const actualSavings = Math.max(0, totalIncome - totalExpenses);
      const surplus = totalIncome - totalExpenses - values.savingsGoal;
      
      cumulativeSurplus += surplus;
      
      projectionData.push({
        month: `Month ${month}`,
        income: Math.round(totalIncome),
        expenses: Math.round(totalExpenses),
        savings: Math.round(actualSavings),
        surplus: Math.round(surplus),
        cumulative: Math.round(cumulativeSurplus)
      });
    }

    setProjection(projectionData);
  };

  const calculateRatios = () => {
    const totalExpenses = values.fixedExpenses + values.variableExpenses;
    const netIncome = values.monthlyIncome - totalExpenses;
    
    return {
      savingsRate: ((values.savingsGoal / values.monthlyIncome) * 100).toFixed(1),
      expenseRatio: ((totalExpenses / values.monthlyIncome) * 100).toFixed(1),
      fixedRatio: ((values.fixedExpenses / values.monthlyIncome) * 100).toFixed(1),
      flexibilityScore: ((values.variableExpenses / totalExpenses) * 100).toFixed(1),
      cashFlowHealth: netIncome >= values.savingsGoal ? "Healthy" : "Needs Attention"
    };
  };

  const ratios = calculateRatios();

  return (
    <Card className="glassmorphism border-0 shadow-lg mb-8">
      <CardHeader className="border-b border-gray-100">
        <CardTitle className="flex items-center gap-3 text-xl">
          <Calculator className="w-6 h-6 text-indigo-600" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-8 space-y-8">
        {/* Input Section */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Object.entries(inputs).map(([key, config]) => (
            <div key={key} className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">
                {config.label}
                {config.optional && <span className="text-gray-400 ml-1">(Optional)</span>}
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                <Input
                  type="number"
                  placeholder={config.placeholder}
                  value={values[key] || ""}
                  onChange={(e) => handleInputChange(key, e.target.value)}
                  className="pl-8 h-11"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Scenario Selection */}
        <div className="space-y-4">
          <Label className="text-sm font-medium text-gray-700">Scenario Analysis</Label>
          <div className="flex flex-wrap gap-3">
            {Object.entries(scenarios).map(([key, scenario]) => (
              <Button
                key={key}
                variant={selectedScenario === key ? "default" : "outline"}
                onClick={() => setSelectedScenario(key)}
                className="gap-2"
              >
                {scenario.name}
              </Button>
            ))}
          </div>
        </div>

        {/* Calculate Button */}
        <Button onClick={calculateProjection} className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 gap-2">
          <TrendingUp className="w-4 h-4" />
          Generate 12-Month Projection
        </Button>

        {/* Health Indicators */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-xl">
            <p className="text-2xl font-bold text-blue-600">{ratios.savingsRate}%</p>
            <p className="text-xs text-gray-600">Savings Rate</p>
            <p className="text-xs text-gray-500">Target: 20%+</p>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-xl">
            <p className="text-2xl font-bold text-purple-600">{ratios.expenseRatio}%</p>
            <p className="text-xs text-gray-600">Expense Ratio</p>
            <p className="text-xs text-gray-500">Target: &lt;80%</p>
          </div>
          <div className="text-center p-4 bg-orange-50 rounded-xl">
            <p className="text-2xl font-bold text-orange-600">{ratios.fixedRatio}%</p>
            <p className="text-xs text-gray-600">Fixed Costs</p>
            <p className="text-xs text-gray-500">Target: &lt;50%</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-xl">
            <p className="text-2xl font-bold text-green-600">{ratios.flexibilityScore}%</p>
            <p className="text-xs text-gray-600">Flexibility</p>
            <p className="text-xs text-gray-500">Higher = Better</p>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-xl">
            <div className="flex items-center justify-center mb-2">
              {ratios.cashFlowHealth === "Healthy" ? (
                <CheckCircle className="w-6 h-6 text-green-600" />
              ) : (
                <AlertCircle className="w-6 h-6 text-red-600" />
              )}
            </div>
            <p className="text-sm font-semibold text-gray-700">{ratios.cashFlowHealth}</p>
          </div>
        </div>

        {/* Projection Chart */}
        {projection && (
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-gray-900">12-Month Cash Flow Projection</h4>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={projection}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => [`$${value.toLocaleString()}`, ""]} />
                  <Legend />
                  <Line type="monotone" dataKey="income" stroke="#10B981" strokeWidth={2} name="Income" />
                  <Line type="monotone" dataKey="expenses" stroke="#EF4444" strokeWidth={2} name="Expenses" />
                  <Line type="monotone" dataKey="cumulative" stroke="#8B5CF6" strokeWidth={2} name="Cumulative Surplus" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            
            <div className="grid md:grid-cols-3 gap-4 mt-6">
              <div className="text-center p-4 bg-green-50 rounded-xl">
                <p className="text-xl font-bold text-green-600">
                  ${projection[11]?.cumulative.toLocaleString() || 0}
                </p>
                <p className="text-sm text-gray-600">Year-End Surplus</p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-xl">
                <p className="text-xl font-bold text-blue-600">
                  ${Math.round(projection.reduce((sum, month) => sum + month.savings, 0) / 12).toLocaleString()}
                </p>
                <p className="text-sm text-gray-600">Avg Monthly Savings</p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-xl">
                <p className="text-xl font-bold text-purple-600">
                  {scenarios[selectedScenario].name}
                </p>
                <p className="text-sm text-gray-600">Current Scenario</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}