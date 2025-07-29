import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PieChart, BarChart3, TrendingUp } from "lucide-react";
import { 
  PieChart as RechartsPieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Legend, 
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from "recharts";

const categoryColors = {
  housing: "#3B82F6",
  food: "#10B981", 
  transportation: "#8B5CF6",
  entertainment: "#EC4899",
  shopping: "#F59E0B",
  subscriptions: "#6366F1",
  debt_payments: "#EF4444",
  savings: "#059669",
  other: "#6B7280"
};

const categoryLabels = {
  housing: "Housing",
  food: "Food",
  transportation: "Transport",
  entertainment: "Entertainment", 
  shopping: "Shopping",
  subscriptions: "Subscriptions",
  debt_payments: "Debt Payments",
  savings: "Savings",
  other: "Other"
};

export default function BudgetVisualization({ budgetData }) {
  const pieChartData = Object.entries(budgetData.categories)
    .filter(([_, value]) => value > 0)
    .map(([key, value]) => ({
      name: categoryLabels[key],
      value: value,
      color: categoryColors[key],
      percentage: budgetData.monthly_income > 0 ? ((value / budgetData.monthly_income) * 100).toFixed(1) : 0
    }));

  const totalExpenses = Object.values(budgetData.categories).reduce((a, b) => a + b, 0);
  const remaining = budgetData.monthly_income - totalExpenses;

  // Add remaining/surplus to chart if positive
  if (remaining > 0) {
    pieChartData.push({
      name: "Available",
      value: remaining,
      color: "#D1FAE5",
      percentage: ((remaining / budgetData.monthly_income) * 100).toFixed(1)
    });
  }

  // Prepare data for comparison chart (actual vs recommended)
  const comparisonData = Object.entries(budgetData.categories)
    .filter(([_, value]) => value > 0)
    .map(([key, value]) => {
      const recommended = {
        housing: 30, food: 15, transportation: 15, entertainment: 10,
        shopping: 8, subscriptions: 5, debt_payments: 10, savings: 20, other: 7
      };
      
      return {
        category: categoryLabels[key],
        actual: budgetData.monthly_income > 0 ? ((value / budgetData.monthly_income) * 100).toFixed(1) : 0,
        recommended: recommended[key] || 10,
        color: categoryColors[key]
      };
    });

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload?.length > 0) {
      const data = payload[0];
      return (
        <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-200">
          <p className="font-semibold text-gray-900">{data.name}</p>
          <p className="text-emerald-600 font-medium">
            ${data.value.toLocaleString()} ({data.payload.percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Main Pie Chart */}
      <Card className="glassmorphism border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="w-5 h-5 text-purple-600" />
            Budget Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pieChartData.length > 0 ? (
            <div className="space-y-6">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={120}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {pieChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>

              {/* Enhanced Legend with Percentages */}
              <div className="grid grid-cols-2 gap-3">
                {pieChartData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between p-3 bg-white/50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm font-medium text-gray-700">{item.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">${item.value.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">{item.percentage}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 space-y-4">
              <div className="w-20 h-20 bg-purple-50 rounded-full flex items-center justify-center mx-auto">
                <PieChart className="w-10 h-10 text-purple-600" />
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-gray-900">No data to visualize</h3>
                <p className="text-gray-500 text-sm">Add your income and expenses to see the breakdown</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actual vs Recommended Comparison */}
      {comparisonData.length > 0 && (
        <Card className="glassmorphism border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              Actual vs Recommended Allocation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="category" 
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    label={{ value: 'Percentage (%)', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip 
                    formatter={(value, name) => [`${value}%`, name === 'actual' ? 'Your Allocation' : 'Recommended']}
                    labelStyle={{ color: '#374151' }}
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Bar dataKey="actual" fill="#3B82F6" name="actual" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="recommended" fill="#E5E7EB" name="recommended" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Financial Health Insights */}
      <Card className="glassmorphism border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            Budget Insights
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 bg-emerald-50 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                <h4 className="font-semibold text-emerald-800">Savings Rate</h4>
              </div>
              <p className="text-2xl font-bold text-emerald-600">
                {budgetData.monthly_income > 0 ? 
                  ((budgetData.categories.savings / budgetData.monthly_income) * 100).toFixed(1) : 0}%
              </p>
              <p className="text-xs text-emerald-700 mt-1">Target: 20%</p>
            </div>
            
            <div className="p-4 bg-blue-50 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <h4 className="font-semibold text-blue-800">Housing Ratio</h4>
              </div>
              <p className="text-2xl font-bold text-blue-600">
                {budgetData.monthly_income > 0 ? 
                  ((budgetData.categories.housing / budgetData.monthly_income) * 100).toFixed(1) : 0}%
              </p>
              <p className="text-xs text-blue-700 mt-1">Recommended: ≤30%</p>
            </div>
          </div>

          {budgetData.monthly_income > 0 && (
            <div className="border-t border-white/20 pt-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-600">Budget Utilization</span>
                <Badge variant="outline" className={
                  totalExpenses / budgetData.monthly_income <= 0.9 ? 
                  "bg-green-50 text-green-700 border-green-200" :
                  totalExpenses / budgetData.monthly_income <= 1 ?
                  "bg-yellow-50 text-yellow-700 border-yellow-200" :
                  "bg-red-50 text-red-700 border-red-200"
                }>
                  {((totalExpenses / budgetData.monthly_income) * 100).toFixed(0)}%
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-600">Monthly Surplus/Deficit</span>
                <span className={`font-bold ${remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {remaining >= 0 ? '+' : '-'}${Math.abs(remaining).toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}