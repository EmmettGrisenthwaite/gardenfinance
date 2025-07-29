import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowRight, TrendingDown, AlertTriangle, CheckCircle, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function ReactToHeadlines({ title, scenarios }) {
  const [currentScenario, setCurrentScenario] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [responses, setResponses] = useState([]);
  const [showResults, setShowResults] = useState(false);

  const scenario = scenarios[currentScenario];
  const progress = ((currentScenario + 1) / scenarios.length) * 100;

  const handleOptionSelect = (option) => {
    setSelectedOption(option);
    setShowFeedback(true);
    
    const newResponse = {
      scenario: currentScenario,
      selected: option,
      correct: option.correct
    };
    setResponses(prev => [...prev, newResponse]);
  };

  const handleNext = () => {
    if (currentScenario < scenarios.length - 1) {
      setCurrentScenario(currentScenario + 1);
      setSelectedOption(null);
      setShowFeedback(false);
    } else {
      setShowResults(true);
    }
  };

  const correctCount = responses.filter(r => r.correct).length;
  const scorePercentage = Math.round((correctCount / scenarios.length) * 100);

  if (showResults) {
    return (
      <Card className="glassmorphism border-0 shadow-lg mb-8">
        <CardHeader className="bg-gradient-to-r from-emerald-50 to-blue-50 rounded-t-2xl">
          <CardTitle className="flex items-center gap-3 text-xl">
            <CheckCircle className="w-6 h-6 text-emerald-600" />
            Your Emotional Response Assessment Complete
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-white">{scorePercentage}%</span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              You got {correctCount} out of {scenarios.length} scenarios right
            </h3>
            
            {scorePercentage >= 80 ? (
              <p className="text-emerald-600 font-semibold">Excellent emotional discipline! You're well-equipped to handle market volatility.</p>
            ) : scorePercentage >= 60 ? (
              <p className="text-yellow-600 font-semibold">Good instincts, but some emotional triggers to work on. The upcoming lessons will help!</p>
            ) : (
              <p className="text-red-600 font-semibold">Your emotions could be costing you significant returns. The next lessons are crucial for your success!</p>
            )}
          </div>

          <div className="grid gap-4">
            <h4 className="font-semibold text-gray-900 mb-2">Your Response Summary:</h4>
            {responses.map((response, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-700">Scenario {index + 1}</span>
                {response.correct ? (
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                ) : (
                  <X className="w-5 h-5 text-red-500" />
                )}
              </div>
            ))}
          </div>

          <div className="mt-8 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
            <h4 className="font-semibold text-gray-900 mb-2">Key Takeaway:</h4>
            <p className="text-gray-700">
              {scorePercentage >= 80 
                ? "You demonstrate strong emotional control. Continue building on this foundation with systematic approaches to investing."
                : "Emotional decision-making is the #1 destroyer of investment returns. The good news? These responses can be trained and improved with the right systems."
              }
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glassmorphism border-0 shadow-lg mb-8">
      <CardHeader className="border-b border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <CardTitle className="flex items-center gap-3 text-xl">
            <TrendingDown className="w-6 h-6 text-red-600" />
            {title}
          </CardTitle>
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            Scenario {currentScenario + 1} of {scenarios.length}
          </Badge>
        </div>
        <Progress value={progress} className="h-2" />
      </CardHeader>
      <CardContent className="p-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentScenario}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {/* Breaking News Alert */}
            <div className="mb-8 p-6 bg-gradient-to-r from-red-50 to-orange-50 border-l-4 border-red-500 rounded-r-xl">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-red-600 mt-1 flex-shrink-0" />
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-red-600 text-white text-xs px-2 py-1">
                      BREAKING NEWS
                    </Badge>
                    <span className="text-xs text-gray-500">Market Alert</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {scenario.headline}
                  </h3>
                  <p className="text-gray-700">
                    {scenario.subtext}
                  </p>
                </div>
              </div>
            </div>

            {!showFeedback ? (
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-4">
                  What's your immediate reaction?
                </h4>
                <div className="space-y-3">
                  {scenario.options.map((option, index) => (
                    <motion.button
                      key={index}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleOptionSelect(option)}
                      className="w-full p-4 text-left bg-white hover:bg-gray-50 border border-gray-200 rounded-xl transition-all duration-200 hover:shadow-md group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-gray-800 font-medium">{option.text}</span>
                        <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className={`p-6 rounded-xl border-2 ${
                  selectedOption.correct 
                    ? 'border-emerald-200 bg-emerald-50' 
                    : 'border-red-200 bg-red-50'
                }`}>
                  <div className="flex items-start gap-3">
                    {selectedOption.correct ? (
                      <CheckCircle className="w-6 h-6 text-emerald-600 mt-1" />
                    ) : (
                      <X className="w-6 h-6 text-red-500 mt-1" />
                    )}
                    <div>
                      <h4 className={`font-semibold mb-2 ${
                        selectedOption.correct ? 'text-emerald-900' : 'text-red-900'
                      }`}>
                        You selected: "{selectedOption.text}"
                      </h4>
                      <p className={selectedOption.correct ? 'text-emerald-800' : 'text-red-800'}>
                        {selectedOption.correct ? scenario.correctFeedback : scenario.incorrectFeedback}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="text-center">
                  <Button
                    onClick={handleNext}
                    className="bg-gradient-to-r from-blue-600 to-indigo-500 hover:from-blue-700 hover:to-indigo-600 gap-2"
                  >
                    {currentScenario < scenarios.length - 1 ? (
                      <>
                        Next Scenario
                        <ArrowRight className="w-4 h-4" />
                      </>
                    ) : (
                      <>
                        View Results
                        <CheckCircle className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}