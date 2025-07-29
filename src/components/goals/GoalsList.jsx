
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Target, Edit, Plus, Calendar, DollarSign, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function GoalsList({ goals, onEditGoal, onUpdateProgress }) {
  const [progressUpdates, setProgressUpdates] = React.useState({});

  const getCategoryColor = (category) => {
    const colors = {
      emergency_fund: "bg-red-100 text-red-800",
      travel: "bg-blue-100 text-blue-800", 
      education: "bg-purple-100 text-purple-800",
      car: "bg-green-100 text-green-800",
      house: "bg-orange-100 text-orange-800",
      debt_payoff: "bg-gray-100 text-gray-800",
      other: "bg-gray-100 text-gray-800"
    };
    return colors[category] || colors.other;
  };

  const getProgressPercent = (goal) => {
    return Math.min((goal.current_amount / goal.target_amount) * 100, 100);
  };

  const getPriorityColor = (priority) => {
    const colors = {
      high: "bg-red-100 text-red-800 border-red-200",
      medium: "bg-yellow-100 text-yellow-800 border-yellow-200", 
      low: "bg-green-100 text-green-800 border-green-200"
    };
    return colors[priority] || colors.medium;
  };

  const handleProgressUpdate = (goalId, amount) => {
    setProgressUpdates(prev => ({
      ...prev,
      [goalId]: amount
    }));
  };

  const submitProgressUpdate = (goal) => {
    const newAmount = progressUpdates[goal.id];
    if (newAmount !== undefined && newAmount !== goal.current_amount) {
      onUpdateProgress(goal.id, parseFloat(newAmount) || 0);
      setProgressUpdates(prev => {
        const updated = { ...prev };
        delete updated[goal.id];
        return updated;
      });
    }
  };

  const activeGoals = goals.filter(g => g.status === 'active');
  const completedGoals = goals.filter(g => g.status === 'completed');

  return (
    <div className="space-y-8">
      {/* Active Goals */}
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Target className="w-6 h-6 text-orange-600" />
          Active Goals ({activeGoals.length})
        </h2>
        
        {activeGoals.length > 0 ? (
          <div className="grid gap-6">
            <AnimatePresence>
              {activeGoals.map((goal) => (
                <motion.div
                  key={goal.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card className="glassmorphism border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <CardTitle className="text-xl">{goal.title}</CardTitle>
                          {goal.description && (
                            <p className="text-gray-600 text-sm">{goal.description}</p>
                          )}
                          <div className="flex gap-2 flex-wrap">
                            <Badge className={getCategoryColor(goal.category)} variant="secondary">
                              {goal.category.replace('_', ' ')}
                            </Badge>
                            <Badge className={getPriorityColor(goal.priority)} variant="outline">
                              {goal.priority} priority
                            </Badge>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEditGoal(goal)}
                          className="rounded-full"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4" />
                          <span>${goal.current_amount?.toLocaleString() || 0} of ${goal.target_amount?.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>Due {new Date(goal.target_date).toLocaleDateString()}</span>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">{getProgressPercent(goal).toFixed(0)}% complete</span>
                          <span className="font-medium text-gray-900">
                            ${(goal.target_amount - goal.current_amount).toLocaleString()} to go
                          </span>
                        </div>
                        <Progress 
                          value={getProgressPercent(goal)} 
                          className="h-2"
                        />
                      </div>

                      <div className="flex gap-3 items-center">
                        <div className="flex-1">
                          <Input
                            type="number"
                            placeholder={`Current: $${goal.current_amount || 0}`}
                            value={progressUpdates[goal.id] !== undefined ? progressUpdates[goal.id] : ""}
                            onChange={(e) => handleProgressUpdate(goal.id, e.target.value)}
                            className="h-9"
                          />
                        </div>
                        <Button
                          size="sm"
                          onClick={() => submitProgressUpdate(goal)}
                          disabled={progressUpdates[goal.id] === undefined}
                          className="bg-orange-600 hover:bg-orange-700"
                        >
                          Update
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <Card className="glassmorphism border-0 shadow-lg">
            <CardContent className="text-center py-12 space-y-4">
              <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mx-auto">
                <Target className="w-8 h-8 text-orange-600" />
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-gray-900">No active goals yet</h3>
                <p className="text-gray-500 text-sm">Start building your financial future by setting your first goal!</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Completed Goals */}
      {completedGoals.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <CheckCircle className="w-6 h-6 text-green-600" />
            Completed Goals ({completedGoals.length})
          </h2>
          
          <div className="grid gap-4">
            {completedGoals.map((goal) => (
              <Card key={goal.id} className="glassmorphism border-0 shadow-md opacity-75">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h4 className="font-semibold text-gray-900">{goal.title}</h4>
                      <Badge className={getCategoryColor(goal.category)} variant="secondary">
                        {goal.category.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">${goal.target_amount?.toLocaleString()}</p>
                      <p className="text-sm text-gray-500">Completed ✅</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
