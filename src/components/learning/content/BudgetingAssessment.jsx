import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Target, ArrowRight, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function BudgetingAssessment({ title, questions, results }) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [result, setResult] = useState(null);

  const handleAnswer = (questionId, option) => {
    const newAnswers = { ...answers, [questionId]: option };
    setAnswers(newAnswers);

    if (currentQuestion < questions.length - 1) {
      setTimeout(() => setCurrentQuestion(currentQuestion + 1), 300);
    } else {
      setTimeout(() => calculateResults(newAnswers), 300);
    }
  };

  const calculateResults = (allAnswers) => {
    const scores = { zbb: 0, percentage: 0, envelope: 0, value: 0 };
    
    Object.values(allAnswers).forEach(answer => {
      Object.entries(answer.score).forEach(([method, score]) => {
        scores[method] += score;
      });
    });

    const topMethod = Object.entries(scores).reduce((a, b) => 
      scores[a[0]] > scores[b[0]] ? a : b
    )[0];

    setResult(results[topMethod]);
    setShowResults(true);
  };

  const resetQuiz = () => {
    setCurrentQuestion(0);
    setAnswers({});
    setShowResults(false);
    setResult(null);
  };

  const progress = ((currentQuestion + 1) / questions.length) * 100;

  if (showResults && result) {
    return (
      <Card className="glassmorphism border-0 shadow-lg mb-8">
        <CardHeader className="bg-gradient-to-r from-emerald-50 to-blue-50 rounded-t-2xl">
          <CardTitle className="flex items-center gap-3 text-xl">
            <Target className="w-6 h-6 text-emerald-600" />
            Your Ideal Budgeting Method
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">{result.name}</h3>
            <p className="text-gray-600 max-w-2xl mx-auto">{result.description}</p>
          </motion.div>

          <div className="bg-white rounded-xl p-6 border border-gray-100">
            <h4 className="font-semibold text-gray-900 mb-4">Implementation Steps:</h4>
            <div className="space-y-3">
              {result.steps.map((step, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">
                    {index + 1}
                  </div>
                  <p className="text-gray-700">{step}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-center mt-8">
            <Button onClick={resetQuiz} variant="outline" className="gap-2">
              Take Quiz Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentQ = questions[currentQuestion];

  return (
    <Card className="glassmorphism border-0 shadow-lg mb-8">
      <CardHeader className="border-b border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <CardTitle className="flex items-center gap-3 text-xl">
            <Target className="w-6 h-6 text-purple-600" />
            {title}
          </CardTitle>
          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
            Question {currentQuestion + 1} of {questions.length}
          </Badge>
        </div>
        <Progress value={progress} className="h-2" />
      </CardHeader>
      <CardContent className="p-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestion}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <h3 className="text-xl font-semibold text-gray-900 mb-6">
              {currentQ.question}
            </h3>
            
            <div className="space-y-3">
              {currentQ.options.map((option, index) => (
                <motion.button
                  key={index}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleAnswer(currentQ.id, option)}
                  className="w-full p-4 text-left bg-white hover:bg-gray-50 border border-gray-200 rounded-xl transition-all duration-200 hover:shadow-md group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-gray-800 font-medium">{option.text}</span>
                    <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}