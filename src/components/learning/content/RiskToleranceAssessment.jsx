import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, PieChart, Target, Brain, Scale } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Pie } from "recharts";
import {
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Cell,
  Tooltip,
  Legend,
} from "recharts";

const COLORS = {
  stocks: "#8884d8",
  bonds: "#82ca9d",
  real_estate: "#ffc658",
  commodities: "#ff8042",
  cash: "#a4de6c",
};

export default function RiskToleranceAssessment({
  assessment,
  age,
  onComplete,
}) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState(null);

  const currentQuestion = assessment.questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === assessment.questions.length - 1;

  const handleAnswer = (value) => {
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: value }));
  };

  const handleNext = () => {
    if (isLastQuestion) {
      calculateResults();
    } else {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  };

  const calculateResults = () => {
    let score = 0;
    for (const questionId in answers) {
      score += answers[questionId];
    }

    // Determine risk profile
    let riskProfile;
    if (score <= 10) riskProfile = "Conservative";
    else if (score <= 18) riskProfile = "Moderate";
    else riskProfile = "Aggressive";

    // Get asset allocation
    const allocation = assessment.allocation_models[riskProfile.toLowerCase()];
    const ageAdjustment = Math.max(0, (age - 25) / 50); // Simple age factor
    
    let adjustedAllocation = {
      stocks: Math.max(0, allocation.stocks - ageAdjustment * 15),
      bonds: Math.min(100, allocation.bonds + ageAdjustment * 10),
      real_estate: allocation.real_estate,
      commodities: allocation.commodities,
      cash: Math.min(20, allocation.cash + ageAdjustment * 5),
    };

    // Normalize to 100%
    const total = Object.values(adjustedAllocation).reduce((sum, v) => sum + v, 0);
    const finalAllocation = Object.keys(adjustedAllocation).map(key => ({
      name: key.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      value: Math.round((adjustedAllocation[key] / total) * 100),
      color: COLORS[key]
    }));

    setResults({
      riskProfile,
      score,
      allocation: finalAllocation.filter(a => a.value > 0),
      recommendation: assessment.recommendations[riskProfile.toLowerCase()],
    });
    setShowResults(true);
  };
  
  const renderResults = () => (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-6"
    >
      <CardHeader className="text-center p-0">
        <CardTitle className="text-2xl">Your Personalized Investment Plan</CardTitle>
        <p className="text-gray-600">Based on your risk profile and age ({age})</p>
      </CardHeader>
      
      <div className="grid md:grid-cols-2 gap-8 items-center">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <RechartsPieChart>
              <Pie
                data={results.allocation}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={120}
                fill="#8884d8"
                dataKey="value"
              >
                {results.allocation.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `${value}%`} />
              <Legend />
            </RechartsPieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-4">
          <Badge className="bg-blue-100 text-blue-800 text-lg px-4 py-2">
            Risk Profile: {results.riskProfile}
          </Badge>
          <p className="text-gray-700 leading-relaxed">{results.recommendation}</p>
        </div>
      </div>

      <div className="text-center">
        <Button onClick={() => onComplete && onComplete(results)} className="mt-4">
          Continue to Next Section
        </Button>
      </div>
    </motion.div>
  );

  return (
    <Card className="glassmorphism border-0 shadow-lg mb-8">
      <CardContent className="p-6">
        <AnimatePresence mode="wait">
          {showResults ? renderResults() : (
            <motion.div
              key={currentQuestionIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="text-center">
                <Badge variant="outline" className="mb-2">
                  Question {currentQuestionIndex + 1} of {assessment.questions.length}
                </Badge>
                <h3 className="text-xl font-semibold text-gray-800">{currentQuestion.question}</h3>
              </div>

              <div className="space-y-3">
                {currentQuestion.options.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleAnswer(option.value)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all duration-200 flex items-center gap-4 ${
                      answers[currentQuestion.id] === option.value
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full flex-shrink-0 ${answers[currentQuestion.id] === option.value ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                    <span>{option.text}</span>
                  </button>
                ))}
              </div>

              <div className="text-right">
                <Button
                  onClick={handleNext}
                  disabled={answers[currentQuestion.id] === undefined}
                  className="gap-2"
                >
                  {isLastQuestion ? "View Results" : "Next"}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}