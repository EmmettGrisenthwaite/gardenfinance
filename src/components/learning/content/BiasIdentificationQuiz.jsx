import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Brain, ArrowRight, Target, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function BiasIdentificationQuiz({ title, questions, profiles }) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [dominantBias, setDominantBias] = useState(null);

  const handleAnswer = (option) => {
    const newAnswers = [...answers, option];
    setAnswers(newAnswers);

    if (currentQuestion < questions.length - 1) {
      setTimeout(() => setCurrentQuestion(currentQuestion + 1), 300);
    } else {
      setTimeout(() => calculateResults(newAnswers), 300);
    }
  };

  const calculateResults = (allAnswers) => {
    const biasCount = {};
    
    allAnswers.forEach(answer => {
      const bias = answer.bias;
      if (bias !== "none" && bias !== "resistant") {
        biasCount[bias] = (biasCount[bias] || 0) + 1;
      }
    });

    // Find the most common bias
    const topBias = Object.entries(biasCount).reduce((a, b) => 
      (biasCount[a[0]] || 0) > (biasCount[b[0]] || 0) ? a : b
    );

    if (topBias && biasCount[topBias[0]] > 0) {
      setDominantBias(profiles[topBias[0]]);
    } else {
      // If no clear bias, show balanced profile
      setDominantBias({
        name: "Bias Resistant",
        description: "You show strong resistance to common financial biases. This is excellent, but staying vigilant is important.",
        actionPlan: [
          "Continue your balanced approach to financial decisions",
          "Stay aware - biases can emerge under stress",
          "Help others recognize their biases",
          "Review your decisions periodically for blind spots"
        ]
      });
    }

    setShowResults(true);
  };

  const resetQuiz = () => {
    setCurrentQuestion(0);
    setAnswers([]);
    setShowResults(false);
    setDominantBias(null);
  };

  const progress = ((currentQuestion + 1) / questions.length) * 100;

  if (showResults && dominantBias) {
    return (
      <Card className="glassmorphism border-0 shadow-lg mb-8">
        <CardHeader className="bg-gradient-to-r from-orange-50 to-red-50 rounded-t-2xl">
          <CardTitle className="flex items-center gap-3 text-xl">
            <Brain className="w-6 h-6 text-orange-600" />
            Your Bias Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">{dominantBias.name}</h3>
            <p className="text-gray-600 max-w-2xl mx-auto">{dominantBias.description}</p>
          </motion.div>

          <div className="bg-white rounded-xl p-6 border border-gray-100">
            <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-orange-600" />
              Your Action Plan:
            </h4>
            <div className="space-y-3">
              {dominantBias.actionPlan.map((action, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">
                    {index + 1}
                  </div>
                  <p className="text-gray-700">{action}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Results Summary */}
          <div className="mt-8 p-6 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl">
            <h4 className="font-semibold text-gray-900 mb-4">Your Response Analysis:</h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {questions.map((_, index) => {
                const answer = answers[index];
                const isGoodAnswer = answer?.bias === "none" || answer?.bias === "resistant";
                return (
                  <div key={index} className="text-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2 ${
                      isGoodAnswer ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                    }`}>
                      {index + 1}
                    </div>
                    <p className="text-xs text-gray-600">
                      {isGoodAnswer ? 'Bias Resistant' : 'Bias Detected'}
                    </p>
                  </div>
                );
              })}
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
            <Brain className="w-6 h-6 text-orange-600" />
            {title}
          </CardTitle>
          <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
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
            <div className="mb-6">
              <Badge variant="outline" className="mb-4 bg-blue-50 text-blue-700 border-blue-200">
                {currentQ.scenario}
              </Badge>
              <h3 className="text-xl font-semibold text-gray-900">
                {currentQ.question}
              </h3>
            </div>
            
            <div className="space-y-3">
              {currentQ.options.map((option, index) => (
                <motion.button
                  key={index}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleAnswer(option)}
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