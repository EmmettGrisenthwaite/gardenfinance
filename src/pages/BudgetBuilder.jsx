import React, { useState, useEffect } from "react";
import { User } from "@/api/entities";
import { Budget } from "@/api/entities";
import { InvokeLLM } from "@/api/integrations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calculator, PieChart, Lightbulb, Save, ArrowLeft, BarChart3, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";

import BudgetForm from "../components/budget/BudgetForm";
import BudgetVisualization from "../components/budget/BudgetVisualization";
import BudgetRecommendations from "../components/budget/BudgetRecommendations";

export default function BudgetBuilder() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [currentBudget, setCurrentBudget] = useState(null);
  const [budgetData, setBudgetData] = useState({
    monthly_income: 0,
    categories: {
      housing: 0,
      food: 0,
      transportation: 0,
      entertainment: 0,
      shopping: 0,
      subscriptions: 0,
      debt_payments: 0,
      savings: 0,
      other: 0
    }
  });
  const [recommendations, setRecommendations] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingRecommendations, setIsGeneratingRecommendations] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const userData = await User.me();
      setUser(userData);

      // Load existing budget
      const budgets = await Budget.filter({ created_by: userData.email });
      if (budgets.length > 0) {
        const budget = budgets[0];
        setCurrentBudget(budget);
        setBudgetData({
          monthly_income: budget.monthly_income || userData.income_monthly || 0,
          categories: budget.categories || budgetData.categories
        });
      } else {
        setBudgetData(prev => ({
          ...prev,
          monthly_income: userData.income_monthly || 0
        }));
      }
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setIsLoading(false);
  };

  const generateRecommendations = async () => {
    setIsGeneratingRecommendations(true);
    
    try {
      const totalExpenses = Object.values(budgetData.categories).reduce((a, b) => a + b, 0);
      const leftover = budgetData.monthly_income - totalExpenses;
      
      const prompt = `
        As a financial advisor for Gen Z, analyze this budget and provide specific recommendations:
        
        Monthly Income: $${budgetData.monthly_income}
        Current Budget:
        - Housing: $${budgetData.categories.housing}
        - Food: $${budgetData.categories.food}
        - Transportation: $${budgetData.categories.transportation}
        - Entertainment: $${budgetData.categories.entertainment}
        - Shopping: $${budgetData.categories.shopping}
        - Subscriptions: $${budgetData.categories.subscriptions}
        - Debt Payments: $${budgetData.categories.debt_payments}
        - Savings: $${budgetData.categories.savings}
        - Other: $${budgetData.categories.other}
        
        User Profile:
        - Age: ${user?.age}
        - Occupation: ${user?.occupation}
        - Total Debt: $${user?.debt_total || 0}
        - Current Savings: $${user?.savings_current || 0}
        
        Total Allocated: $${totalExpenses}
        Remaining: $${leftover}
        
        Provide:
        1. Specific feedback on each category
        2. Recommended percentage allocations based on 50/30/20 rule and their situation
        3. Areas where they can optimize spending
        4. Actionable tips for this specific budget
        
        Keep it encouraging and practical for someone just starting their financial journey.
      `;

      const result = await InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            overall_score: {
              type: "number",
              description: "Budget health score from 1-10"
            },
            category_feedback: {
              type: "object",
              properties: {
                housing: { type: "string" },
                food: { type: "string" },
                transportation: { type: "string" },
                entertainment: { type: "string" },
                shopping: { type: "string" },
                subscriptions: { type: "string" },
                debt_payments: { type: "string" },
                savings: { type: "string" },
                other: { type: "string" }
              }
            },
            recommendations: {
              type: "array",
              items: { type: "string" }
            },
            optimizations: {
              type: "array",
              items: { type: "string" }
            }
          }
        }
      });

      setRecommendations(result);
    } catch (error) {
      console.error("Error generating recommendations:", error);
    }
    
    setIsGeneratingRecommendations(false);
  };

  const saveBudget = async () => {
    setIsSaving(true);
    
    try {
      const budgetToSave = {
        ...budgetData,
        recommendations: recommendations?.recommendations || []
      };

      if (currentBudget) {
        await Budget.update(currentBudget.id, budgetToSave);
      } else {
        await Budget.create(budgetToSave);
      }

      // Also update user's monthly income if it changed
      if (budgetData.monthly_income !== user?.income_monthly) {
        await User.updateMyUserData({
          income_monthly: budgetData.monthly_income
        });
      }

      navigate(createPageUrl("Dashboard"));
    } catch (error) {
      console.error("Error saving budget:", error);
    }
    
    setIsSaving(false);
  };

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              {Array(9).fill(0).map((_, i) => (
                <div key={i} className="h-16 bg-gray-200 rounded"></div>
              ))}
            </div>
            <div className="h-96 bg-gray-200 rounded"></div>
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
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Budget Builder</h1>
            <p className="text-gray-600 mt-1">Take control of your spending with a personalized budget</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={generateRecommendations}
            disabled={isGeneratingRecommendations}
            className="gap-2"
          >
            <Lightbulb className="w-4 h-4" />
            {isGeneratingRecommendations ? "Analyzing..." : "Get AI Tips"}
          </Button>
          <Button
            onClick={saveBudget}
            disabled={isSaving}
            className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 gap-2"
          >
            <Save className="w-4 h-4" />
            {isSaving ? "Saving..." : "Save Budget"}
          </Button>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
      >
        <Tabs defaultValue="builder" className="space-y-6">
          <TabsList className="grid w-full max-w-2xl grid-cols-3 bg-white/50 border border-white/20">
            <TabsTrigger 
              value="builder" 
              className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              <Calculator className="w-4 h-4" />
              Budget Builder
            </TabsTrigger>
            <TabsTrigger 
              value="visualize"
              className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              <PieChart className="w-4 h-4" />
              Visualize
            </TabsTrigger>
            <TabsTrigger 
              value="insights"
              className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              <TrendingUp className="w-4 h-4" />
              AI Insights
            </TabsTrigger>
          </TabsList>

          <TabsContent value="builder" className="space-y-6">
            <BudgetForm 
              budgetData={budgetData}
              setBudgetData={setBudgetData}
            />
          </TabsContent>

          <TabsContent value="visualize" className="space-y-6">
            <BudgetVisualization budgetData={budgetData} />
          </TabsContent>

          <TabsContent value="insights" className="space-y-6">
            {recommendations ? (
              <BudgetRecommendations recommendations={recommendations} />
            ) : (
              <Card className="glassmorphism border-0 shadow-lg">
                <CardContent className="text-center py-12 space-y-4">
                  <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto">
                    <Lightbulb className="w-8 h-8 text-blue-600" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-semibold text-gray-900">Get AI-Powered Budget Analysis</h3>
                    <p className="text-gray-500 text-sm max-w-md mx-auto">
                      Click "Get AI Tips" to receive personalized recommendations based on your budget and financial goals.
                    </p>
                  </div>
                  <Button
                    onClick={generateRecommendations}
                    disabled={isGeneratingRecommendations}
                    className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 gap-2"
                  >
                    <Lightbulb className="w-4 h-4" />
                    {isGeneratingRecommendations ? "Analyzing..." : "Analyze My Budget"}
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}