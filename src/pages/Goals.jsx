import React, { useState, useEffect } from "react";
import { Goal } from "@/api/entities";
import { User } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";

import GoalsList from "../components/goals/GoalsList";
import GoalForm from "../components/goals/GoalForm";
import GoalsStats from "../components/goals/GoalsStats";

export default function Goals() {
  const navigate = useNavigate();
  const [goals, setGoals] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadGoals();
  }, []);

  const loadGoals = async () => {
    try {
      const user = await User.me();
      const goalsData = await Goal.filter({ created_by: user.email }, '-created_date');
      setGoals(goalsData);
    } catch (error) {
      console.error("Error loading goals:", error);
    }
    setIsLoading(false);
  };

  const handleCreateGoal = () => {
    setEditingGoal(null);
    setShowForm(true);
  };

  const handleEditGoal = (goal) => {
    setEditingGoal(goal);
    setShowForm(true);
  };

  const handleSaveGoal = async (goalData) => {
    try {
      if (editingGoal) {
        await Goal.update(editingGoal.id, goalData);
      } else {
        await Goal.create(goalData);
      }
      setShowForm(false);
      setEditingGoal(null);
      loadGoals();
    } catch (error) {
      console.error("Error saving goal:", error);
    }
  };

  const handleUpdateProgress = async (goalId, newAmount) => {
    try {
      await Goal.update(goalId, { current_amount: newAmount });
      loadGoals();
    } catch (error) {
      console.error("Error updating progress:", error);
    }
  };

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
          <div className="space-y-4">
            {Array(3).fill(0).map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
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
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Financial Goals</h1>
            <p className="text-gray-600 mt-1">Track your progress toward financial freedom</p>
          </div>
        </div>
        <Button
          onClick={handleCreateGoal}
          className="bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 gap-2"
        >
          <Plus className="w-4 h-4" />
          New Goal
        </Button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
      >
        <GoalsStats goals={goals} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <GoalsList 
          goals={goals}
          onEditGoal={handleEditGoal}
          onUpdateProgress={handleUpdateProgress}
        />
      </motion.div>

      {showForm && (
        <GoalForm
          goal={editingGoal}
          onSave={handleSaveGoal}
          onCancel={() => {
            setShowForm(false);
            setEditingGoal(null);
          }}
        />
      )}
    </div>
  );
}