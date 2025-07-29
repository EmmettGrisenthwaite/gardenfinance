import React, { useState, useEffect } from "react";
import { Debt } from "@/api/entities";
import { User } from "@/api/entities";
import { InvokeLLM } from "@/api/integrations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditCard, Plus, ArrowLeft, TrendingDown, Calculator, Target, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";

import DebtForm from "../components/debt/DebtForm";
import DebtList from "../components/debt/DebtList";
import DebtStrategy from "../components/debt/DebtStrategy";
import DebtAnalysis from "../components/debt/DebtAnalysis";

export default function DebtManager() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [debts, setDebts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingDebt, setEditingDebt] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [analysis, setAnalysis] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const userData = await User.me();
      setUser(userData);
      
      const debtsData = await Debt.filter({ created_by: userData.email }, '-interest_rate');
      setDebts(debtsData);
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setIsLoading(false);
  };

  const generateAnalysis = async () => {
    if (debts.length === 0) return;
    
    try {
      const totalDebt = debts.reduce((sum, debt) => sum + debt.balance, 0);
      const totalMinPayments = debts.reduce((sum, debt) => sum + debt.minimum_payment, 0);
      const averageRate = debts.reduce((sum, debt) => sum + (debt.interest_rate * debt.balance), 0) / totalDebt;

      const prompt = `
As a financial advisor, analyze this debt portfolio and provide comprehensive recommendations:

User Profile:
- Monthly Income: $${user?.income_monthly || 0}
- Current Savings: $${user?.savings_current || 0}

Debt Portfolio:
${debts.map(debt => `
- ${debt.name} (${debt.type}): $${debt.balance} at ${debt.interest_rate}% APR
  Minimum Payment: $${debt.minimum_payment}
  Current Payment: $${debt.current_payment || debt.minimum_payment}
`).join('')}

Total Debt: $${totalDebt}
Total Min Payments: $${totalMinPayments}
Weighted Average Rate: ${averageRate.toFixed(2)}%

Provide specific recommendations for:
1. Optimal payoff strategy (avalanche vs snowball)
2. Payment allocation suggestions
3. Timeline estimates for different strategies
4. Ways to accelerate payoff
5. Which debts to prioritize and why

Keep advice practical and encouraging for a young adult.
      `;

      const result = await InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            recommended_strategy: {
              type: "string",
              enum: ["snowball", "avalanche", "hybrid"]
            },
            priority_order: {
              type: "array",
              items: { type: "string" }
            },
            payoff_timeline: {
              type: "object",
              properties: {
                minimum_payments: { type: "number" },
                optimized_strategy: { type: "number" }
              }
            },
            key_recommendations: {
              type: "array",
              items: { type: "string" }
            },
            monthly_allocation: {
              type: "object",
              additionalProperties: { type: "number" }
            }
          }
        }
      });

      setAnalysis(result);
    } catch (error) {
      console.error("Error generating analysis:", error);
    }
  };

  const handleSaveDebt = async (debtData) => {
    try {
      if (editingDebt) {
        await Debt.update(editingDebt.id, debtData);
      } else {
        await Debt.create(debtData);
      }
      setShowForm(false);
      setEditingDebt(null);
      loadData();
      // Regenerate analysis when debt changes
      setTimeout(generateAnalysis, 500);
    } catch (error) {
      console.error("Error saving debt:", error);
    }
  };

  const handleEditDebt = (debt) => {
    setEditingDebt(debt);
    setShowForm(true);
  };

  const totalDebt = debts.reduce((sum, debt) => sum + debt.balance, 0);
  const totalMinPayments = debts.reduce((sum, debt) => sum + debt.minimum_payment, 0);
  const highestRateDebt = debts.reduce((highest, debt) => 
    debt.interest_rate > (highest?.interest_rate || 0) ? debt : highest, null);

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid md:grid-cols-3 gap-6">
            {Array(3).fill(0).map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 space-y-8 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(createPageUrl("Dashboard"))}
            className="rounded-xl"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Debt Manager</h1>
            <p className="text-gray-600 mt-1">Take control of your debt with AI-powered strategies</p>
          </div>
        </div>
        <div className="flex gap-3">
          {debts.length > 0 && (
            <Button
              variant="outline"
              onClick={generateAnalysis}
              className="gap-2"
            >
              <Zap className="w-4 h-4" />
              AI Analysis
            </Button>
          )}
          <Button
            onClick={() => setShowForm(true)}
            className="bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Debt
          </Button>
        </div>
      </motion.div>

      {/* Quick Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        <Card className="glassmorphism border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-500">Total Debt</p>
                <p className="text-2xl font-bold text-red-600">${totalDebt.toLocaleString()}</p>
              </div>
              <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glassmorphism border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-500">Min Payments</p>
                <p className="text-2xl font-bold text-orange-600">${totalMinPayments.toLocaleString()}</p>
              </div>
              <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center">
                <Calculator className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glassmorphism border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-500">Highest Rate</p>
                <p className="text-2xl font-bold text-purple-600">
                  {highestRateDebt ? `${highestRateDebt.interest_rate}%` : '0%'}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center">
                <TrendingDown className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <Tabs defaultValue="debts" className="space-y-6">
          <TabsList className="grid w-full max-w-2xl grid-cols-3 bg-white/50 border border-white/20">
            <TabsTrigger 
              value="debts" 
              className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              <CreditCard className="w-4 h-4" />
              My Debts
            </TabsTrigger>
            <TabsTrigger 
              value="strategy"
              className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              <Target className="w-4 h-4" />
              Strategy
            </TabsTrigger>
            <TabsTrigger 
              value="analysis"
              className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              <TrendingDown className="w-4 h-4" />
              Analysis
            </TabsTrigger>
          </TabsList>

          <TabsContent value="debts" className="space-y-6">
            <DebtList 
              debts={debts}
              onEditDebt={handleEditDebt}
            />
          </TabsContent>

          <TabsContent value="strategy" className="space-y-6">
            <DebtStrategy 
              debts={debts}
              user={user}
              analysis={analysis}
            />
          </TabsContent>

          <TabsContent value="analysis" className="space-y-6">
            <DebtAnalysis 
              debts={debts}
              user={user}
              analysis={analysis}
              onGenerateAnalysis={generateAnalysis}
            />
          </TabsContent>
        </Tabs>
      </motion.div>

      {showForm && (
        <DebtForm
          debt={editingDebt}
          onSave={handleSaveDebt}
          onCancel={() => {
            setShowForm(false);
            setEditingDebt(null);
          }}
        />
      )}
    </div>
  );
}