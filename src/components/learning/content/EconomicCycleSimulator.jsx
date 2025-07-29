import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";
import { TrendingUp, TrendingDown, Activity, Zap, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function EconomicCycleSimulator({ title, description }) {
  const [variables, setVariables] = useState({
    interestRates: 3,
    consumerSpending: 50,
    governmentSpending: 50,
    businessInvestment: 50,
    globalDemand: 50
  });

  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState(null);

  const calculateEconomicImpact = () => {
    setIsRunning(true);
    
    // Simulate economic calculations
    setTimeout(() => {
      const gdpImpact = (
        (variables.consumerSpending - 50) * 0.4 +
        (variables.businessInvestment - 50) * 0.3 +
        (variables.governmentSpending - 50) * 0.2 +
        (variables.globalDemand - 50) * 0.1 -
        (variables.interestRates - 3) * 5
      ) / 10;

      const unemploymentImpact = -gdpImpact * 0.5 + Math.random() * 2 - 1;
      const inflationImpact = (
        (variables.consumerSpending - 50) * 0.03 +
        (variables.globalDemand - 50) * 0.02 +
        Math.max(0, gdpImpact) * 0.5
      ) / 10;

      const stockMarketImpact = gdpImpact * 3 + (3 - variables.interestRates) * 2 + Math.random() * 10 - 5;

      // Generate time series data
      const quarters = [];
      let baseGdp = 2.5;
      let baseUnemployment = 4.5;
      let baseInflation = 2.0;
      let baseStocks = 100;

      for (let i = 0; i <= 8; i++) {
        const quarterImpact = Math.sin((i / 8) * Math.PI) * 0.7 + 0.3; // Gradual impact over time
        
        baseGdp += (gdpImpact * quarterImpact) / 8;
        baseUnemployment += (unemploymentImpact * quarterImpact) / 8;
        baseInflation += (inflationImpact * quarterImpact) / 8;
        baseStocks += (stockMarketImpact * quarterImpact) / 8;

        quarters.push({
          quarter: `Q${(i % 4) + 1} ${Math.floor(i/4) + 1}`,
          gdp: Math.max(0, Number(baseGdp.toFixed(1))),
          unemployment: Math.max(0, Number(baseUnemployment.toFixed(1))),
          inflation: Number(baseInflation.toFixed(1)),
          stocks: Math.max(0, Number(baseStocks.toFixed(0)))
        });
      }

      // Determine economic phase
      let phase = "Expansion";
      if (baseGdp < 1) phase = "Contraction";
      else if (baseGdp > 4) phase = "Peak";
      else if (baseGdp < 2) phase = "Trough";

      // Generate insights
      const insights = [];
      if (variables.interestRates > 5) {
        insights.push("High interest rates are cooling economic activity and reducing investment.");
      }
      if (variables.consumerSpending < 30) {
        insights.push("Low consumer spending is dragging down GDP growth.");
      }
      if (baseInflation > 4) {
        insights.push("Rising inflation may force the Federal Reserve to raise interest rates.");
      }
      if (baseUnemployment > 7) {
        insights.push("High unemployment suggests the economy is in recession.");
      }
      if (stockMarketImpact > 10) {
        insights.push("Stock market gains may be creating wealth effects that boost spending.");
      }

      setResults({
        quarters,
        finalMetrics: {
          gdp: baseGdp,
          unemployment: baseUnemployment,
          inflation: baseInflation,
          stocks: baseStocks
        },
        phase,
        insights
      });
      setIsRunning(false);
    }, 2000);
  };

  const resetSimulation = () => {
    setVariables({
      interestRates: 3,
      consumerSpending: 50,
      businessInvestment: 50,
      governmentSpending: 50,
      globalDemand: 50
    });
    setResults(null);
  };

  const getPhaseColor = (phase) => {
    switch (phase) {
      case "Expansion": return "bg-green-100 text-green-800 border-green-200";
      case "Peak": return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "Contraction": return "bg-red-100 text-red-800 border-red-200";
      case "Trough": return "bg-blue-100 text-blue-800 border-blue-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getMetricIcon = (metric, value) => {
    const isGood = (metric === "gdp" && value > 2.5) || 
                   (metric === "unemployment" && value < 5) ||
                   (metric === "inflation" && value > 1.5 && value < 3.5) ||
                   (metric === "stocks" && value > 100);
    
    return isGood ? 
      <TrendingUp className="w-5 h-5 text-green-600" /> : 
      <TrendingDown className="w-5 h-5 text-red-600" />;
  };

  return (
    <Card className="glassmorphism border-0 shadow-lg mb-8">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-2xl">
        <CardTitle className="flex items-center gap-3 text-xl">
          <Activity className="w-6 h-6 text-blue-600" />
          {title || "Interactive Economic Cycle Simulator"}
        </CardTitle>
        {description && (
          <p className="text-gray-600 text-sm mt-2">{description}</p>
        )}
      </CardHeader>
      <CardContent className="p-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Controls Section */}
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Economic Variables</h3>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-gray-700">Interest Rates</label>
                    <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                      {variables.interestRates}%
                    </span>
                  </div>
                  <Slider
                    value={[variables.interestRates]}
                    onValueChange={(value) => setVariables(prev => ({ ...prev, interestRates: value[0] }))}
                    max={8}
                    min={0}
                    step={0.25}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Federal Reserve policy rate
                  </p>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-gray-700">Consumer Spending</label>
                    <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                      {variables.consumerSpending}%
                    </span>
                  </div>
                  <Slider
                    value={[variables.consumerSpending]}
                    onValueChange={(value) => setVariables(prev => ({ ...prev, consumerSpending: value[0] }))}
                    max={100}
                    min={0}
                    step={5}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Consumer confidence and spending levels
                  </p>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-gray-700">Business Investment</label>
                    <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                      {variables.businessInvestment}%
                    </span>
                  </div>
                  <Slider
                    value={[variables.businessInvestment]}
                    onValueChange={(value) => setVariables(prev => ({ ...prev, businessInvestment: value[0] }))}
                    max={100}
                    min={0}
                    step={5}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Corporate capital expenditure and expansion
                  </p>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-gray-700">Government Spending</label>
                    <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                      {variables.governmentSpending}%
                    </span>
                  </div>
                  <Slider
                    value={[variables.governmentSpending]}
                    onValueChange={(value) => setVariables(prev => ({ ...prev, governmentSpending: value[0] }))}
                    max={100}
                    min={0}
                    step={5}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Fiscal policy and public investment
                  </p>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-gray-700">Global Demand</label>
                    <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                      {variables.globalDemand}%
                    </span>
                  </div>
                  <Slider
                    value={[variables.globalDemand]}
                    onValueChange={(value) => setVariables(prev => ({ ...prev, globalDemand: value[0] }))}
                    max={100}
                    min={0}
                    step={5}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    International trade and export demand
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <Button
                  onClick={calculateEconomicImpact}
                  disabled={isRunning}
                  className="bg-gradient-to-r from-blue-600 to-indigo-500 hover:from-blue-700 hover:to-indigo-600"
                >
                  {isRunning ? (
                    <>
                      <Zap className="w-4 h-4 mr-2 animate-pulse" />
                      Running Simulation...
                    </>
                  ) : (
                    <>
                      <Activity className="w-4 h-4 mr-2" />
                      Run Economic Simulation
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={resetSimulation}>
                  Reset
                </Button>
              </div>
            </div>
          </div>

          {/* Results Section */}
          <div>
            {results ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* Economic Phase */}
                <div className="text-center">
                  <Badge className={`${getPhaseColor(results.phase)} text-lg px-4 py-2 border-2`}>
                    Economic Phase: {results.phase}
                  </Badge>
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm text-green-600 font-medium">GDP Growth</div>
                        <div className="text-2xl font-bold text-green-900">
                          {results.finalMetrics.gdp.toFixed(1)}%
                        </div>
                      </div>
                      {getMetricIcon("gdp", results.finalMetrics.gdp)}
                    </div>
                  </div>
                  <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm text-blue-600 font-medium">Unemployment</div>
                        <div className="text-2xl font-bold text-blue-900">
                          {results.finalMetrics.unemployment.toFixed(1)}%
                        </div>
                      </div>
                      {getMetricIcon("unemployment", results.finalMetrics.unemployment)}
                    </div>
                  </div>
                  <div className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm text-purple-600 font-medium">Inflation</div>
                        <div className="text-2xl font-bold text-purple-900">
                          {results.finalMetrics.inflation.toFixed(1)}%
                        </div>
                      </div>
                      {getMetricIcon("inflation", results.finalMetrics.inflation)}
                    </div>
                  </div>
                  <div className="p-4 bg-gradient-to-r from-orange-50 to-red-50 rounded-lg border border-orange-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm text-orange-600 font-medium">Stock Market</div>
                        <div className="text-2xl font-bold text-orange-900">
                          {results.finalMetrics.stocks}
                        </div>
                      </div>
                      {getMetricIcon("stocks", results.finalMetrics.stocks)}
                    </div>
                  </div>
                </div>

                {/* Economic Trends Chart */}
                <div>
                  <h4 className="text-md font-semibold text-gray-900 mb-3">Economic Trends Over Time</h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={results.quarters}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="quarter" />
                        <YAxis />
                        <Tooltip />
                        <Line type="monotone" dataKey="gdp" stroke="#10b981" strokeWidth={2} name="GDP Growth %" />
                        <Line type="monotone" dataKey="unemployment" stroke="#3b82f6" strokeWidth={2} name="Unemployment %" />
                        <Line type="monotone" dataKey="inflation" stroke="#8b5cf6" strokeWidth={2} name="Inflation %" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Economic Insights */}
                {results.insights.length > 0 && (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-5 h-5 text-yellow-600 mt-1 flex-shrink-0" />
                      <div>
                        <h4 className="font-semibold text-yellow-900 mb-2">Economic Insights</h4>
                        <ul className="text-sm text-yellow-800 space-y-1">
                          {results.insights.map((insight, index) => (
                            <li key={index} className="flex items-start gap-2">
                              <span className="w-1 h-1 bg-yellow-600 rounded-full mt-2 flex-shrink-0"></span>
                              {insight}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <div className="h-full flex items-center justify-center text-center">
                <div>
                  <Activity className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">Economic Laboratory</h3>
                  <p className="text-gray-500">
                    Adjust the economic variables on the left and run the simulation to see how they interact and affect key indicators like GDP, unemployment, and inflation.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}