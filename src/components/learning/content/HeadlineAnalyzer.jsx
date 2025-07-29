import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Newspaper, TrendingUp, TrendingDown, Target, RotateCcw, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const headlines = [
  {
    id: 1,
    headline: "Federal Reserve Raises Interest Rates by 0.75%",
    context: "Inflation at 8.5%, unemployment at 3.6%",
    correctAnswers: {
      stocks: "down",
      bonds: "down", 
      dollar: "up"
    },
    explanation: {
      stocks: "Higher rates make borrowing more expensive and future earnings less valuable, typically hurting stocks initially.",
      bonds: "Existing bonds lose value when new bonds offer higher yields. Bond prices fall when rates rise.",
      dollar: "Higher U.S. rates attract foreign investment, increasing demand for dollars and strengthening the currency."
    },
    impact: "The Fed is aggressively fighting inflation. This signals more rate hikes may come, creating near-term market pressure."
  },
  {
    id: 2,
    headline: "U.S. GDP Growth Beats Expectations at 3.2%",
    context: "Economists predicted 2.8% growth, unemployment steady at 4.1%",
    correctAnswers: {
      stocks: "up",
      bonds: "down",
      dollar: "up"
    },
    explanation: {
      stocks: "Strong economic growth typically boosts corporate earnings and investor confidence, driving stocks higher.",
      bonds: "Good economic news may lead to higher rates or reduced stimulus, making bonds less attractive.",
      dollar: "A strong economy attracts international investment and suggests the Fed may maintain hawkish policy."
    },
    impact: "Beating expectations suggests the economy is resilient. However, it may also mean the Fed won't cut rates soon."
  },
  {
    id: 3,
    headline: "Unemployment Jumps to 6.2% as Layoffs Mount",
    context: "Previous month was 5.8%, initial jobless claims up 15%",
    correctAnswers: {
      stocks: "down",
      bonds: "up",
      dollar: "down"
    },
    explanation: {
      stocks: "Rising unemployment signals economic weakness, reducing corporate earnings expectations and investor confidence.",
      bonds: "Weak labor markets often lead to Fed stimulus or rate cuts, making bonds more attractive as a safe haven.",
      dollar: "Economic weakness may prompt Fed dovishness, reducing foreign demand for dollar-denominated investments."
    },
    impact: "Rising unemployment often precedes recession. The Fed may pivot to cutting rates to support employment."
  },
  {
    id: 4,
    headline: "China Announces New Trade Tariffs on U.S. Imports",
    context: "25% tariffs on $50B of goods, escalating trade tensions",
    correctAnswers: {
      stocks: "down",
      bonds: "up",
      dollar: "down"
    },
    explanation: {
      stocks: "Trade wars hurt global growth and corporate profits, especially for multinational companies and exporters.",
      bonds: "Trade uncertainty creates flight-to-quality demand for safe government bonds as a defensive investment.",
      dollar: "Trade wars can hurt U.S. export competitiveness and create global economic uncertainty, weakening the dollar."
    },
    impact: "Trade tensions create uncertainty and can disrupt supply chains, hurting economic growth on both sides."
  },
  {
    id: 5,
    headline: "Oil Prices Surge 8% on Middle East Supply Concerns",
    context: "Crude hits $85/barrel amid geopolitical tensions",
    correctAnswers: {
      stocks: "down",
      bonds: "down",
      dollar: "up"
    },
    explanation: {
      stocks: "Higher oil prices increase costs for most companies and may fuel inflation, hurting overall market sentiment.",
      bonds: "Oil price spikes often lead to inflation concerns, which erode the real value of fixed-income investments.",
      dollar: "Oil is priced in dollars, so higher prices increase global demand for dollars to purchase oil."
    },
    impact: "Energy price spikes act like a tax on consumers and businesses, potentially slowing economic growth while boosting inflation."
  }
];

export default function HeadlineAnalyzer({ title }) {
  const [currentHeadline, setCurrentHeadline] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState(0);
  const [gameComplete, setGameComplete] = useState(false);

  const headline = headlines[currentHeadline];

  const handleAnswer = (asset, direction) => {
    setUserAnswers(prev => ({
      ...prev,
      [asset]: direction
    }));
  };

  const checkAnswers = () => {
    let correctCount = 0;
    Object.keys(headline.correctAnswers).forEach(asset => {
      if (userAnswers[asset] === headline.correctAnswers[asset]) {
        correctCount++;
      }
    });
    
    const roundScore = Math.round((correctCount / 3) * 100);
    setScore(prev => prev + roundScore);
    setShowResults(true);
  };

  const nextHeadline = () => {
    if (currentHeadline < headlines.length - 1) {
      setCurrentHeadline(prev => prev + 1);
      setUserAnswers({});
      setShowResults(false);
    } else {
      setGameComplete(true);
    }
  };

  const restartGame = () => {
    setCurrentHeadline(0);
    setUserAnswers({});
    setShowResults(false);
    setScore(0);
    setGameComplete(false);
  };

  const getAnswerColor = (asset, direction) => {
    if (!showResults) {
      return userAnswers[asset] === direction ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200";
    }
    
    const isCorrect = headline.correctAnswers[asset] === direction;
    const wasSelected = userAnswers[asset] === direction;
    
    if (isCorrect && wasSelected) return "bg-green-600 text-white";
    if (isCorrect && !wasSelected) return "bg-green-200 text-green-800";
    if (!isCorrect && wasSelected) return "bg-red-600 text-white";
    return "bg-gray-100 text-gray-500";
  };

  const getAssetIcon = (asset) => {
    switch (asset) {
      case "stocks": return "📈";
      case "bonds": return "🏛️";
      case "dollar": return "💵";
      default: return "📊";
    }
  };

  const getDirectionIcon = (direction) => {
    return direction === "up" ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />;
  };

  const canSubmit = Object.keys(userAnswers).length === 3;

  if (gameComplete) {
    const finalScore = Math.round(score / headlines.length);
    const performance = finalScore >= 80 ? "Expert" : finalScore >= 60 ? "Good" : finalScore >= 40 ? "Learning" : "Beginner";
    
    return (
      <Card className="glassmorphism border-0 shadow-lg mb-8">
        <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-t-2xl">
          <CardTitle className="flex items-center gap-3 text-xl">
            <CheckCircle className="w-6 h-6 text-green-600" />
            Game Complete!
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6"
          >
            <div>
              <div className="text-4xl font-bold text-green-600 mb-2">{finalScore}%</div>
              <Badge className={`text-lg px-4 py-2 ${
                performance === "Expert" ? "bg-green-100 text-green-800" :
                performance === "Good" ? "bg-blue-100 text-blue-800" :
                performance === "Learning" ? "bg-yellow-100 text-yellow-800" :
                "bg-gray-100 text-gray-800"
              }`}>
                {performance} Level
              </Badge>
            </div>
            
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-gray-900">Market Analysis Skills</h3>
              <p className="text-gray-600">
                {performance === "Expert" && "Excellent! You have a strong grasp of how economic events affect markets."}
                {performance === "Good" && "Well done! You understand most market reactions to economic news."}
                {performance === "Learning" && "Good start! Keep studying how different events impact various asset classes."}
                {performance === "Beginner" && "Keep learning! Understanding market reactions takes practice and experience."}
              </p>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-2">Key Takeaways</h4>
              <ul className="text-sm text-blue-800 text-left space-y-1">
                <li>• Markets often move on surprises, not just the news itself</li>
                <li>• Context matters - the same news can have different impacts in different environments</li>
                <li>• Asset classes often move in opposite directions during major events</li>
                <li>• Understanding correlations helps predict market reactions</li>
              </ul>
            </div>

            <Button onClick={restartGame} className="bg-gradient-to-r from-blue-600 to-indigo-500 hover:from-blue-700 hover:to-indigo-600">
              <RotateCcw className="w-4 h-4 mr-2" />
              Play Again
            </Button>
          </motion.div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glassmorphism border-0 shadow-lg mb-8">
      <CardHeader className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-t-2xl">
        <CardTitle className="flex items-center gap-3 text-xl">
          <Newspaper className="w-6 h-6 text-purple-600" />
          {title || "Interactive Headline Analyzer Game"}
        </CardTitle>
        <div className="flex items-center justify-between mt-4">
          <Badge variant="outline">
            Question {currentHeadline + 1} of {headlines.length}
          </Badge>
          <div className="text-sm font-medium text-gray-600">
            Score: {Math.round(score / (currentHeadline + 1) * (currentHeadline > 0 ? 1 : 0))}%
          </div>
        </div>
        <Progress value={((currentHeadline + 1) / headlines.length) * 100} className="mt-2" />
      </CardHeader>
      <CardContent className="p-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentHeadline}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            {/* Headline */}
            <div className="p-6 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl border border-gray-200">
              <h3 className="text-xl font-bold text-gray-900 mb-2">📰 Breaking News</h3>
              <p className="text-lg font-semibold text-gray-800 mb-3">{headline.headline}</p>
              <p className="text-sm text-gray-600">
                <span className="font-medium">Context:</span> {headline.context}
              </p>
            </div>

            {/* Question */}
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Target className="w-5 h-5" />
                How will markets react? Predict the immediate impact:
              </h4>
              
              <div className="grid gap-6">
                {Object.keys(headline.correctAnswers).map((asset) => (
                  <div key={asset} className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{getAssetIcon(asset)}</span>
                      <h5 className="font-semibold text-gray-800 capitalize">{asset}</h5>
                    </div>
                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        onClick={() => handleAnswer(asset, "up")}
                        disabled={showResults}
                        className={`flex items-center gap-2 ${getAnswerColor(asset, "up")}`}
                      >
                        <TrendingUp className="w-4 h-4" />
                        Up
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleAnswer(asset, "down")}
                        disabled={showResults}
                        className={`flex items-center gap-2 ${getAnswerColor(asset, "down")}`}
                      >
                        <TrendingDown className="w-4 h-4" />
                        Down
                      </Button>
                    </div>
                    
                    {showResults && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                      >
                        <p className="text-sm text-gray-700">
                          <span className="font-semibold">Correct answer:</span> {headline.correctAnswers[asset]} {getDirectionIcon(headline.correctAnswers[asset])}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          {headline.explanation[asset]}
                        </p>
                      </motion.div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Results and Impact */}
            {showResults && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg"
              >
                <h4 className="font-semibold text-yellow-900 mb-2">Market Impact Analysis</h4>
                <p className="text-sm text-yellow-800">{headline.impact}</p>
              </motion.div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-500">
                {!showResults && canSubmit && "Ready to check your answers?"}
                {!showResults && !canSubmit && "Select your predictions for all three assets"}
                {showResults && "Great! Let's move to the next headline"}
              </div>
              <div className="flex gap-3">
                {!showResults ? (
                  <Button
                    onClick={checkAnswers}
                    disabled={!canSubmit}
                    className="bg-gradient-to-r from-purple-600 to-indigo-500 hover:from-purple-700 hover:to-indigo-600"
                  >
                    Check Answers
                  </Button>
                ) : (
                  <Button
                    onClick={nextHeadline}
                    className="bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600"
                  >
                    {currentHeadline < headlines.length - 1 ? "Next Headline" : "See Final Score"}
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}