import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, ArrowRight, Target } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function AssetClassQuiz({ title, questions }) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [score, setScore] = useState(0);
  const [showResults, setShowResults] = useState(false);

  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;

  const handleAnswerSelect = (answer) => {
    setSelectedAnswer(answer);
    setShowFeedback(true);

    if (answer.value === "correct") {
      setScore(prev => prev + 1);
    }
  };

  const handleNext = () => {
    if (isLastQuestion) {
      setShowResults(true);
    } else {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setShowFeedback(false);
    }
  };

  const renderResults = () => {
    const percentage = Math.round((score / questions.length) * 100);
    const isGoodScore = percentage >= 70;

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center space-y-6"
      >
        <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center ${
          isGoodScore ? 'bg-green-100' : 'bg-yellow-100'
        }`}>
          {isGoodScore ? (
            <CheckCircle className="w-10 h-10 text-green-600" />
          ) : (
            <Target className="w-10 h-10 text-yellow-600" />
          )}
        </div>
        
        <div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">
            {isGoodScore ? "Great Job!" : "Keep Learning!"}
          </h3>
          <p className="text-gray-600">
            You scored {score} out of {questions.length} ({percentage}%)
          </p>
        </div>

        <div className={`p-4 rounded-lg ${
          isGoodScore ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'
        }`}>
          <p className={`text-sm ${
            isGoodScore ? 'text-green-800' : 'text-yellow-800'
          }`}>
            {isGoodScore 
              ? "You're ready to start building your portfolio! Understanding asset classes is the foundation of smart investing."
              : "Consider reviewing the lesson content. Understanding these basics will help you make better investment decisions."
            }
          </p>
        </div>
      </motion.div>
    );
  };

  return (
    <Card className="glassmorphism border-0 shadow-lg mb-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-xl">
          <Target className="w-6 h-6 text-blue-600" />
          {title}
        </CardTitle>
      </CardHeader>
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
                <Badge variant="outline" className="mb-4">
                  Question {currentQuestionIndex + 1} of {questions.length}
                </Badge>
                <h3 className="text-lg font-semibold text-gray-800 mb-6">
                  {currentQuestion.question}
                </h3>
              </div>

              <div className="space-y-3">
                {currentQuestion.options.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => !showFeedback && handleAnswerSelect(option)}
                    disabled={showFeedback}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all duration-200 ${
                      selectedAnswer === option
                        ? option.value === "correct"
                          ? "border-green-500 bg-green-50"
                          : "border-red-500 bg-red-50"
                        : showFeedback
                        ? option.value === "correct"
                          ? "border-green-500 bg-green-50"
                          : "border-gray-200 bg-gray-50"
                        : "border-gray-200 hover:bg-gray-50 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {showFeedback && option.value === "correct" && (
                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                      )}
                      {showFeedback && selectedAnswer === option && option.value !== "correct" && (
                        <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                      )}
                      <span className={`${
                        showFeedback && selectedAnswer === option && option.value !== "correct"
                          ? "text-red-700"
                          : showFeedback && option.value === "correct"
                          ? "text-green-700"
                          : "text-gray-800"
                      }`}>
                        {option.text}
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              {showFeedback && selectedAnswer && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 rounded-lg ${
                    selectedAnswer.value === "correct"
                      ? "bg-green-50 border border-green-200"
                      : "bg-red-50 border border-red-200"
                  }`}
                >
                  <p className={`text-sm ${
                    selectedAnswer.value === "correct" ? "text-green-800" : "text-red-800"
                  }`}>
                    {selectedAnswer.feedback}
                  </p>
                </motion.div>
              )}

              {showFeedback && (
                <div className="text-right">
                  <Button onClick={handleNext} className="gap-2">
                    {isLastQuestion ? "View Results" : "Next Question"}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}