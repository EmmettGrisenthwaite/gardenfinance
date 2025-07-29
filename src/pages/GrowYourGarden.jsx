import React, { useState, useEffect } from "react";
import { User } from "@/api/entities";
import { InvokeLLM } from "@/api/integrations";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Sprout, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion, AnimatePresence } from "framer-motion";

import GoalInputCard from "../components/garden/GoalInputCard";
import RealityCheck from "../components/garden/RealityCheck";
import ProgressTracker from "../components/garden/ProgressTracker";
import ChecklistPanel from "../components/garden/ChecklistPanel";
import SideHustleRecommender from "../components/garden/SideHustleRecommender";
import GetRichCurriculum from "../components/garden/GetRichCurriculum";
import GardenVisual from "../components/garden/GardenVisual";

export default function GrowYourGarden() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [goal, setGoal] = useState({
    amount: 200000,
    type: "Net Worth",
    byDate: new Date(new Date().setFullYear(new Date().getFullYear() + 10))
  });
  
  const [plan, setPlan] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const userData = await User.me();
        setUser(userData);
        const savedPlan = localStorage.getItem(`gardenPlan_${userData.email}`);
        if (savedPlan) {
          const parsedPlan = JSON.parse(savedPlan);
          setPlan(parsedPlan);
          setGoal(parsedPlan.goal);
        }
      } catch (error) {
        console.error("Error loading user data:", error);
      }
      setIsLoading(false);
    };
    loadData();
  }, []);

  const handleGeneratePlan = async () => {
    if (!user) return;
    setIsGenerating(true);
    
    const prompt = `
      Based on the following user financial data, create a personalized "Grow Your Garden" (wealth building) action plan.
      The user's goal is to achieve a ${goal.type} of $${goal.amount.toLocaleString()} by ${goal.byDate.toLocaleDateString()}.

      User's Current Financials:
      - Monthly Income: $${user.income_monthly || 'not provided'}
      - Current Savings: $${user.savings_current || 0}
      - Total Debt: $${user.debt_total || 0}
      - Investment Portfolio Value: $${user.portfolio_value || 0}
      - Risk Tolerance: ${user.risk_tolerance || 'moderate'}

      Generate a step-by-step checklist with actionable, specific, and realistic tasks. Use a friendly, encouraging, and garden-themed metaphor.
      For each task, provide a category (Tending, Planting, Weeding, Learning, Watering) and a measurable impact.
      The tone should be motivational, youthful, and empowering.
    `;

    try {
      const response = await InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            checklist: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  task: { type: "string", description: "The specific action item for the user." },
                  category: { type: "string", enum: ["Tending", "Planting", "Weeding", "Learning", "Watering"], description: "The category of the task using garden metaphors (Tending for income, Planting for investing, Weeding for debt, Learning for education, Watering for saving)." },
                  impact: { type: "string", description: "The estimated financial or progress impact of completing the task." },
                  status: { type: "string", enum: ["To Do", "In Progress", "Done"], default: "To Do", description: "The current status of the task." }
                },
                required: ["task", "category", "impact"]
              }
            }
          }
        }
      });
      
      const newPlan = { checklist: response.checklist, goal };
      setPlan(newPlan);
      localStorage.setItem(`gardenPlan_${user.email}`, JSON.stringify(newPlan));

    } catch (error) {
      console.error("Error generating plan:", error);
    }
    setIsGenerating(false);
  };
  
  const handleUpdateChecklist = (updatedChecklist) => {
    const updatedPlan = { ...plan, checklist: updatedChecklist };
    setPlan(updatedPlan);
    if (user) {
      localStorage.setItem(`gardenPlan_${user.email}`, JSON.stringify(updatedPlan));
    }
  };
  
  const financialSummary = {
    netWorth: (user?.savings_current || 0) + (user?.portfolio_value || 0) - (user?.debt_total || 0),
    investmentBalance: user?.portfolio_value || 0,
    monthlySurplus: (user?.income_monthly || 0) * 0.2,
    debtLevel: user?.debt_total || 0
  };

  const completedTasks = plan ? plan.checklist.filter(item => item.status === 'Done').length : 0;
  const totalTasks = plan ? plan.checklist.length : 0;
  const progressPercentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 space-y-8 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
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
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Sprout className="w-6 h-6 text-green-600" />
              Grow Your Garden
            </h1>
            <p className="text-gray-600 mt-1">Your personalized roadmap to financial growth.</p>
          </div>
        </div>
      </motion.div>

      {/* Beautiful Garden Visual */}
      {plan && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <GardenVisual progress={progressPercentage} checklist={plan.checklist} />
        </motion.div>
      )}

      <div className="grid lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-1 space-y-8">
          <GoalInputCard 
            goal={goal}
            setGoal={setGoal}
            onGeneratePlan={handleGeneratePlan}
            isGenerating={isGenerating}
            hasPlan={!!plan}
          />
          <RealityCheck summary={financialSummary} />
          {plan && <ProgressTracker goal={plan.goal} currentNetWorth={financialSummary.netWorth} />}
        </div>

        <div className="lg:col-span-2 space-y-8">
          <AnimatePresence>
            {plan ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <ChecklistPanel checklist={plan.checklist} onUpdate={handleUpdateChecklist} />
              </motion.div>
            ) : (
              <Card className="glassmorphism border-0 shadow-lg text-center flex flex-col items-center justify-center min-h-[300px]">
                <CardContent className="p-8">
                  <Sprout className="w-16 h-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-gray-900">Ready to grow your wealth?</h3>
                  <p className="text-gray-600 mt-2">Set your target and let our AI create a personalized plan to help your financial garden flourish!</p>
                </CardContent>
              </Card>
            )}
          </AnimatePresence>

          <SideHustleRecommender />
          <GetRichCurriculum />
        </div>
      </div>
    </div>
  );
}