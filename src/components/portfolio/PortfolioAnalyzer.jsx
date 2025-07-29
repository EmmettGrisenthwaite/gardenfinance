
import React, { useState, useEffect } from "react";
import { Portfolio } from "@/api/entities";
import { InvokeLLM } from "@/api/integrations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Plus, Trash2, Zap, AlertTriangle, CheckCircle, TrendingUp, TrendingDown, RefreshCw, DollarSign, Beaker, Loader2, Calculator, Target, Lightbulb, ShieldCheck } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line, Legend } from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import StockAnalyzerDetail from "./StockAnalyzerDetail"; // Import the new component

export default function PortfolioAnalyzer({ user, portfolios, onRefresh }) {
  const [holdings, setHoldings] = useState([
    { symbol: "", name: "", shares: "", price: "", category: "stocks" }
  ]);
  const [portfolioName, setPortfolioName] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentPortfolio, setCurrentPortfolio] = useState(null);
  const [isUpdatingPrices, setIsUpdatingPrices] = useState(false);
  const [performanceData, setPerformanceData] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // New state for "What If" scenarios
  const [simulationInput, setSimulationInput] = useState({ changeType: 'add_cash', amount: 1000, symbol: '', shares: 10 });
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState(null);
  const [selectedStock, setSelectedStock] = useState(null); // New state for selected stock

  const currentUserPortfolio = portfolios.find(p => p.type === 'current');

  useEffect(() => {
    if (currentUserPortfolio) {
      setCurrentPortfolio(currentUserPortfolio);
      setPortfolioName(currentUserPortfolio.name);
      setHoldings(currentUserPortfolio.holdings || [
        { symbol: "", name: "", shares: "", price: "", category: "stocks" }
      ]);
      setAnalysis(currentUserPortfolio.analysis);
      setPerformanceData(currentUserPortfolio.performance_data);
      setLastUpdated(currentUserPortfolio.last_price_update ? new Date(currentUserPortfolio.last_price_update) : null);
    }
  }, [currentUserPortfolio]);

  const addHolding = () => {
    setHoldings([...holdings, { symbol: "", name: "", shares: "", price: "", category: "stocks" }]);
  };

  const removeHolding = (index) => {
    setHoldings(holdings.filter((_, i) => i !== index));
  };

  const updateHolding = (index, field, value) => {
    const updated = [...holdings];
    updated[index] = { ...updated[index], [field]: value };
    
    // Calculate value automatically
    if (field === 'shares' || field === 'price') {
      const shares = parseFloat(updated[index].shares) || 0;
      const price = parseFloat(updated[index].price) || 0;
      updated[index].value = shares * price;
      // Clear gain/loss data if price is manually updated
      if (field === 'price') {
        updated[index].gain_loss = undefined;
        updated[index].gain_loss_percent = undefined;
        updated[index].daily_change_percent = undefined;
        updated[index].week_52_high = undefined;
        updated[index].week_52_low = undefined;
      }
    }
    
    setHoldings(updated);
  };

  const updateAllPrices = async () => {
    if (!holdings.some(h => h.symbol)) return;
    
    setIsUpdatingPrices(true);
    try {
      const validHoldings = holdings.filter(h => h.symbol && h.category === 'stocks'); // Only update stock prices for now
      const symbols = validHoldings.map(h => h.symbol);
      
      let updatedHoldings = [...holdings];
      let totalCurrentValue = 0;
      let totalGainLoss = 0;

      if (symbols.length > 0) {
        const response = await InvokeLLM({
          prompt: `Get the latest stock market data for these ticker symbols: ${symbols.join(', ')}. For each symbol, provide the current price, daily change percentage, and 52-week high/low if available. Return only the JSON.`,
          add_context_from_internet: true,
          response_json_schema: {
            type: "object",
            properties: {
              stocks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    symbol: { type: "string" },
                    price: { type: "number" },
                    daily_change_percent: { type: "number" },
                    week_52_high: { type: "number" },
                    week_52_low: { type: "number" }
                  }
                }
              }
            }
          }
        });

        if (response?.stocks) {
          updatedHoldings = holdings.map(holding => {
            const stockData = response.stocks.find(s => s.symbol === holding.symbol);
            if (stockData && holding.category === 'stocks') {
              const oldValue = parseFloat(holding.shares) * parseFloat(holding.price);
              const newValue = parseFloat(holding.shares) * stockData.price;
              const gainLoss = newValue - oldValue;
              const gainLossPercent = oldValue > 0 ? ((gainLoss / oldValue) * 100) : 0;
              
              return {
                ...holding,
                price: stockData.price,
                daily_change_percent: stockData.daily_change_percent,
                week_52_high: stockData.week_52_high,
                week_52_low: stockData.week_52_low,
                value: newValue,
                gain_loss: gainLoss,
                gain_loss_percent: gainLossPercent
              };
            }
            return holding;
          });
        }
      }
      
      setHoldings(updatedHoldings);
      setLastUpdated(new Date());

      // Recalculate total value and performance metrics based on potentially updated holdings
      totalCurrentValue = updatedHoldings.reduce((sum, h) => sum + (h.value || 0), 0);
      totalGainLoss = updatedHoldings.reduce((sum, h) => sum + (h.gain_loss || 0), 0);
      const totalGainLossPercent = (totalCurrentValue - totalGainLoss) > 0 ? ((totalGainLoss / (totalCurrentValue - totalGainLoss)) * 100) : 0;
      
      const newPerformanceData = {
        total_value: totalCurrentValue,
        total_gain_loss: totalGainLoss,
        total_gain_loss_percent: totalGainLossPercent,
        top_performer: updatedHoldings.reduce((best, current) => 
          (current.gain_loss_percent || -Infinity) > (best?.gain_loss_percent || -Infinity) ? current : best, updatedHoldings[0] || {}),
        worst_performer: updatedHoldings.reduce((worst, current) => 
          (current.gain_loss_percent || Infinity) < (worst?.gain_loss_percent || Infinity) ? current : worst, updatedHoldings[0] || {})
      };
      
      setPerformanceData(newPerformanceData);
      
      // Save updated portfolio
      if (currentPortfolio) {
        await Portfolio.update(currentPortfolio.id, {
          holdings: updatedHoldings,
          performance_data: newPerformanceData,
          last_price_update: new Date().toISOString(),
          total_value: totalCurrentValue
        });
        // onRefresh(); // Removed to prevent state race condition
      } else if (updatedHoldings.some(h => h.symbol && h.shares && h.price)) { // If no current portfolio, create one
        await Portfolio.create({
          name: portfolioName || "My Portfolio",
          type: "current",
          holdings: updatedHoldings,
          performance_data: newPerformanceData,
          last_price_update: new Date().toISOString(),
          total_value: totalCurrentValue
        });
        onRefresh(); // Keep for new portfolio creation to update list
      }
    } catch (error) {
      console.error("Error updating prices:", error);
    }
    setIsUpdatingPrices(false);
  };

  const analyzePortfolio = async () => {
    setIsAnalyzing(true);
    
    try {
      const validHoldings = holdings.filter(h => h.symbol && h.shares && h.price);
      const totalValue = validHoldings.reduce((sum, h) => sum + (h.value || 0), 0);
      
      const portfolioData = {
        holdings: validHoldings.map(h => ({
          symbol: h.symbol,
          shares: h.shares,
          value: h.value
        })),
        total_value: totalValue,
        user_profile: {
          risk_tolerance: user?.risk_tolerance || 'moderate',
        }
      };

      const prompt = `
        As a senior financial analyst for a top-tier firm, conduct a comprehensive analysis of the following investment portfolio.

        PORTFOLIO DATA:
        ${JSON.stringify(portfolioData, null, 2)}

        ANALYSIS INSTRUCTIONS:
        1.  **Individual Stock Analysis:** For each holding, find its stock Beta.
        2.  **Portfolio Risk Calculation:** Calculate the weighted average Beta for the entire portfolio. Based on this portfolio Beta, determine a 'Risk Level' (Low, Moderate, High, Very High) and provide a concise explanation of what this Beta means (e.g., "A Beta of 1.2 suggests the portfolio is 20% more volatile than the overall market.").
        3.  **Portfolio Report Card:** Generate a "report card" with letter grades (A, B, C, D, F) for the following three categories. For each grade, provide a brief, insightful explanation (1-2 sentences).
            -   **Risk Management:** Grade based on the portfolio Beta and overall volatility. Is the risk level appropriate for a typical investor?
            -   **Diversification:** Grade based on sector concentration. Is the portfolio too concentrated in one area (e.g., tech)?
            -   **Performance & Growth Potential:** Grade based on the quality of the holdings and their potential for future growth.
        4.  **Actionable Recommendations:** Provide 3-4 specific, actionable recommendations to improve the portfolio's health, risk profile, or diversification.

        Return the entire analysis in a single, valid JSON object.
      `;

      const result = await InvokeLLM({
        prompt,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            risk_score: { type: "number" },
            diversification_score: { type: "number" },
            overall_grade: { type: "string" },
            portfolio_risk: {
              type: "object",
              properties: {
                portfolio_beta: { type: "number" },
                risk_level: { type: "string" },
                explanation: { type: "string" }
              }
            },
            report_card: {
              type: "object",
              properties: {
                risk_management: {
                  type: "object",
                  properties: {
                    grade: { type: "string" },
                    explanation: { type: "string" }
                  }
                },
                diversification: {
                  type: "object",
                  properties: {
                    grade: { type: "string" },
                    explanation: { type: "string" }
                  }
                },
                performance: {
                  type: "object",
                  properties: {
                    grade: { type: "string" },
                    explanation: { type: "string" }
                  }
                }
              }
            },
            sector_allocation: {
              type: "object",
              additionalProperties: { "type": "number" },
              description: "Allocation percentage for each market sector (e.g., {'Technology': 25, 'Healthcare': 15})."
            },
            recommendations: {
              type: "array",
              items: { type: "string" }
            },
            strengths: {
              type: "array",
              items: { type: "string" }
            },
            concerns: {
              type: "array",
              items: { type: "string" }
            }
          },
          required: ["portfolio_risk", "report_card", "recommendations"] // Ensure core analysis is present
        }
      });

      setAnalysis(result);

      // Save portfolio with enhanced analysis
      const portfolioToSave = {
        name: portfolioName || "My Portfolio",
        type: "current",
        total_value: totalValue,
        holdings: validHoldings,
        analysis: result,
        performance_data: performanceData,
        last_price_update: lastUpdated ? lastUpdated.toISOString() : null
      };

      if (currentPortfolio) {
        await Portfolio.update(currentPortfolio.id, portfolioToSave);
      } else {
        await Portfolio.create(portfolioToSave);
      }

      // onRefresh(); // <-- This was causing the analysis to disappear. It's removed now.
      
    } catch (error) {
      console.error("Error analyzing portfolio:", error);
    }
    
    setIsAnalyzing(false);
  };

  const runSimulation = async () => {
    setIsSimulating(true);
    setSimulationResult(null);

    let hypotheticalHoldingsDescription = '';
    let changeDescription = '';
    let promptContext = ''; // Context for the LLM based on change type

    if (simulationInput.changeType === 'add_cash') {
      changeDescription = `invest an additional $${simulationInput.amount.toLocaleString()} into the portfolio.`;
      promptContext = `The user wants to add $${simulationInput.amount.toLocaleString()} cash to their portfolio. Please suggest how this cash could be optimally allocated across new or existing holdings based on their current portfolio and user profile, and then analyze the hypothetical resulting portfolio.`
    } else { // buy_stock
      const symbol = simulationInput.symbol.toUpperCase();
      const shares = parseFloat(simulationInput.shares);

      if (!symbol || !shares || shares <= 0) {
        alert("Please enter a valid ticker symbol and number of shares greater than zero.");
        setIsSimulating(false);
        return;
      }

      changeDescription = `buy ${shares} shares of ${symbol}.`;

      try {
        // Fetch price for the new stock to calculate hypothetical value
        const priceResponse = await InvokeLLM({
          prompt: `What is the current market price of the stock with ticker symbol ${symbol}? Return only the price as a number.`,
          add_context_from_internet: true,
          response_json_schema: { type: "object", properties: { price: { type: "number" } } }
        });

        if (!priceResponse || typeof priceResponse.price !== 'number' || isNaN(priceResponse.price)) {
          throw new Error("Could not fetch valid price for symbol.");
        }

        const newHoldingValue = shares * priceResponse.price;

        // Describe the hypothetical holdings for the LLM prompt
        let currentHoldingDescriptionLines = holdings.filter(h => h.symbol && h.shares).map(h => `- ${h.symbol} (${h.name || h.category}): ${h.shares} shares`);

        let newStockEntry = '';
        const existingHolding = holdings.find(h => h.symbol === symbol);
        if (existingHolding) {
          // If already holds, describe increased shares
          const newShares = (parseFloat(existingHolding.shares) || 0) + shares;
          newStockEntry = `- ${symbol} (existing holding): shares increased from ${existingHolding.shares} to ${newShares}.`;
        } else {
          // If new, describe new entry
          newStockEntry = `- ${symbol} (new holding): ${shares} shares at $${priceResponse.price.toFixed(2)}.`;
        }
        
        hypotheticalHoldingsDescription = `
          After this change, the portfolio would hypothetically include:
          ${currentHoldingDescriptionLines.join('\n')}
          ${newStockEntry}
        `;

        promptContext = `The user is considering to ${changeDescription}. This would hypothetically add ${shares} shares of ${symbol} to their portfolio, with a current market value of $${newHoldingValue.toFixed(2)}.`;

      } catch (error) {
        console.error("Error fetching price for simulation:", error);
        alert("Could not run simulation: Failed to get current price for the specified stock. Please check the symbol and try again.");
        setIsSimulating(false);
        return;
      }
    }

    const originalPortfolioStr = `
      Current Portfolio State:
      - Total Value: $${(performanceData?.total_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      - Holdings (symbols & shares): ${holdings.filter(h => h.symbol).map(h => `${h.symbol}: ${h.shares} shares`).join(', ') || 'N/A'}
      - Risk Score (based on last analysis): ${analysis?.risk_score || 'N/A'}/10
      - Diversification Score (based on last analysis): ${analysis?.diversification_score || 'N/A'}/10
      - User Profile: Age: ${user?.age || 'N/A'}, Risk Tolerance: ${user?.risk_tolerance || 'N/A'}, Monthly Income: $${user?.income_monthly || 'N/A'}
    `;

    const prompt = `
      You are a sophisticated financial AI. A user wants to simulate a potential change to their investment portfolio.

      ${originalPortfolioStr}

      ${promptContext}

      ${hypotheticalHoldingsDescription || ''}

      Please analyze the *new hypothetical portfolio* after this change. Provide:
      1. A brief summary of the impact (2-3 sentences), focusing on overall change to the portfolio structure and risk/reward.
      2. The new estimated Total Value.
      3. The new estimated Risk Score (1-10, lower is less risky).
      4. The new estimated Diversification Score (1-10, higher is more diversified).
      5. Key pros (benefits/advantages) of making this change.
      6. Key cons (drawbacks/risks) of making this change.
      7. If the change involved adding cash (as specified in the promptContext), provide a 'suggested_allocation' in text format (e.g., "Allocate 50% to SPY, 30% to VOO, 20% to BND...").
      
      Return your analysis strictly in JSON format according to the provided schema.
    `;

    try {
      const result = await InvokeLLM({
        prompt,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            summary: { type: "string", description: "Brief summary of the impact (2-3 sentences)." },
            new_total_value: { type: "number", description: "Estimated new total portfolio value." },
            new_risk_score: { type: "number", description: "Estimated new risk score (1-10)." },
            new_diversification_score: { type: "number", description: "Estimated new diversification score (1-10)." },
            pros: { type: "array", items: { type: "string" }, description: "Key benefits/advantages of the change." },
            cons: { type: "array", items: { type: "string" }, description: "Key drawbacks/risks of the change." },
            suggested_allocation: { type: "string", description: "Allocation suggestion if cash was added. Only include if changeType was 'add_cash'." }
          },
          required: ["summary", "new_total_value", "new_risk_score", "new_diversification_score", "pros", "cons"]
        }
      });
      setSimulationResult(result);
    } catch (error) {
      console.error("Error running simulation:", error);
      alert("Failed to get simulation results from AI. Please try again.");
    }

    setIsSimulating(false);
  };

  const categoryColors = {
    stocks: "#3B82F6",
    etfs: "#10B981",
    bonds: "#F59E0B", 
    crypto: "#8B5CF6",
    cash: "#6B7280"
  };

  const getGradeColor = (grade) => {
    const colors = {
      'A': 'text-green-600 bg-green-50 border-green-200',
      'B': 'text-blue-600 bg-blue-50 border-blue-200',
      'C': 'text-yellow-600 bg-yellow-50 border-yellow-200',
      'D': 'text-orange-600 bg-orange-50 border-orange-200',
      'F': 'text-red-600 bg-red-50 border-red-200'
    };
    return colors[grade] || colors['C'];
  };

  const sectorColors = ["#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#C70039", "#900C3F", "#581845", "#FFC300"];

  // New helper for report card icons
  const getReportCardIcon = (category) => {
    switch (category) {
      case 'Risk Management':
        return <ShieldCheck className="w-8 h-8 text-blue-600" />;
      case 'Diversification':
        return <PieChart className="w-8 h-8 text-emerald-600" />;
      case 'Performance':
        return <TrendingUp className="w-8 h-8 text-purple-600" />;
      default:
        return <CheckCircle className="w-8 h-8 text-gray-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Real-time Performance Overview */}
      <AnimatePresence>
        {performanceData && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6"
          >
            <Card className="glassmorphism border-0 shadow-lg">
              <CardContent className="p-4 text-center">
                <DollarSign className="w-8 h-8 mx-auto mb-2 text-green-600" />
                <p className="text-2xl font-bold text-gray-900">
                  ${performanceData.total_value?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-sm text-gray-500">Total Value</p>
              </CardContent>
            </Card>
            
            <Card className="glassmorphism border-0 shadow-lg">
              <CardContent className="p-4 text-center">
                {performanceData.total_gain_loss >= 0 ? (
                  <TrendingUp className="w-8 h-8 mx-auto mb-2 text-green-600" />
                ) : (
                  <TrendingDown className="w-8 h-8 mx-auto mb-2 text-red-600" />
                )}
                <p className={`text-2xl font-bold ${performanceData.total_gain_loss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {performanceData.total_gain_loss >= 0 ? '+' : ''}${performanceData.total_gain_loss?.toFixed(2)}
                </p>
                <p className="text-sm text-gray-500">Total Gain/Loss</p>
              </CardContent>
            </Card>
            
            <Card className="glassmorphism border-0 shadow-lg">
              <CardContent className="p-4 text-center">
                <div className="text-xl">🏆</div>
                <p className="text-lg font-bold text-green-600">
                  {performanceData.top_performer?.symbol || 'N/A'}
                </p>
                <p className="text-sm text-gray-500">Top Performer</p>
                {performanceData.top_performer?.gain_loss_percent !== undefined && (
                  <p className="text-xs text-green-600">
                    +{performanceData.top_performer?.gain_loss_percent?.toFixed(2)}%
                  </p>
                )}
              </CardContent>
            </Card>
            
            <Card className="glassmorphism border-0 shadow-lg">
              <CardContent className="p-4 text-center">
                <div className="text-xl">📉</div>
                <p className="text-lg font-bold text-red-600">
                  {performanceData.worst_performer?.symbol || 'N/A'}
                </p>
                <p className="text-sm text-gray-500">Worst Performer</p>
                {performanceData.worst_performer?.gain_loss_percent !== undefined && (
                  <p className="text-xs text-red-600">
                    {performanceData.worst_performer?.gain_loss_percent?.toFixed(2)}%
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Portfolio Input Form */}
      <Card className="glassmorphism border-0 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-600" />
              Portfolio Analyzer
            </CardTitle>
            <div className="flex items-center gap-2">
              {lastUpdated && (
                <p className="text-xs text-gray-500">
                  Updated: {lastUpdated.toLocaleTimeString()}
                </p>
              )}
              <Button
                onClick={updateAllPrices}
                disabled={isUpdatingPrices || !holdings.some(h => h.symbol)}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isUpdatingPrices ? 'animate-spin' : ''}`} />
                {isUpdatingPrices ? 'Updating...' : 'Update Prices'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Portfolio Name</Label>
            <Input
              placeholder="My Investment Portfolio"
              value={portfolioName}
              onChange={(e) => setPortfolioName(e.target.value)}
              className="h-11"
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Holdings</h3>
              <Button onClick={addHolding} variant="outline" size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                Add Holding
              </Button>
            </div>

            {holdings.map((holding, index) => (
              <React.Fragment key={index}>
                <div 
                  className="grid grid-cols-12 gap-3 p-4 bg-white/50 rounded-xl border border-white/20 cursor-pointer hover:bg-white/80 transition-colors"
                  onClick={() => setSelectedStock(selectedStock === holding.symbol ? null : holding.symbol)}
                >
                  <div className="col-span-3">
                    <Input
                      placeholder="AAPL"
                      value={holding.symbol}
                      onChange={(e) => updateHolding(index, 'symbol', e.target.value.toUpperCase())}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="col-span-3">
                    <Input
                      placeholder="Apple Inc."
                      value={holding.name}
                      onChange={(e) => updateHolding(index, 'name', e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      placeholder="100"
                      value={holding.shares}
                      onChange={(e) => updateHolding(index, 'shares', e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="150.00"
                      value={holding.price}
                      onChange={(e) => updateHolding(index, 'price', e.target.value)}
                      className="h-9 text-sm"
                    />
                    {holding.daily_change_percent !== undefined && (
                      <p className={`text-xs mt-1 ${holding.daily_change_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {holding.daily_change_percent >= 0 ? '+' : ''}{holding.daily_change_percent.toFixed(2)}%
                      </p>
                    )}
                  </div>
                  <div className="col-span-1">
                    <Select value={holding.category} onValueChange={(value) => updateHolding(index, 'category', value)}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="stocks">Stock</SelectItem>
                        <SelectItem value="etfs">ETF</SelectItem>
                        <SelectItem value="bonds">Bond</SelectItem>
                        <SelectItem value="crypto">Crypto</SelectItem>
                        <SelectItem value="cash">Cash</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => { e.stopPropagation(); removeHolding(index); }} // Stop propagation to prevent opening details
                      disabled={holdings.length === 1}
                      className="h-9 w-9"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                  {(holding.value !== undefined || holding.gain_loss !== undefined) && (
                    <div className="col-span-12 mt-2 p-2 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-center text-sm">
                        {holding.value !== undefined && (
                          <span>Value: ${holding.value.toFixed(2)}</span>
                        )}
                        {holding.gain_loss !== undefined && (
                          <span className={holding.gain_loss >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {holding.gain_loss >= 0 ? '+' : ''}${holding.gain_loss.toFixed(2)} 
                            ({holding.gain_loss_percent?.toFixed(2)}%)
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <AnimatePresence>
                  {selectedStock === holding.symbol && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <StockAnalyzerDetail symbol={holding.symbol} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </React.Fragment>
            ))}
          </div>

          <Button
            onClick={analyzePortfolio}
            disabled={isAnalyzing || !holdings.some(h => h.symbol && h.shares && h.price)}
            className="w-full bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 gap-2"
          >
            <Zap className="w-4 h-4" />
            {isAnalyzing ? "Analyzing Portfolio..." : "Analyze My Portfolio"}
          </Button>
        </CardContent>
      </Card>

      {/* Analysis Results */}
      {analysis && (
        <div className="space-y-6">
          {/* Main Scores & Charts */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Portfolio Overview */}
            <Card className="glassmorphism border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg">Portfolio Health</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {analysis.overall_grade && (
                  <div className="text-center">
                    <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full text-2xl font-bold border-2 ${getGradeColor(analysis.overall_grade)}`}>
                      {analysis.overall_grade}
                    </div>
                    <p className="text-sm text-gray-500 mt-2">Overall Grade</p>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Risk Score</span>
                    <Badge variant={analysis.risk_score > 7 ? "destructive" : "secondary"}>
                      {analysis.risk_score}/10
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Diversification</span>
                    <Badge variant={analysis.diversification_score > 7 ? "default" : "secondary"}>
                      {analysis.diversification_score}/10
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Sector Allocation Chart */}
            {analysis.sector_allocation && typeof analysis.sector_allocation === 'object' && Object.keys(analysis.sector_allocation).length > 0 && (
              <Card className="glassmorphism border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg">Sector Allocation</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={Object.entries(analysis.sector_allocation)
                            .filter(([_, value]) => value > 0)
                            .map(([key, value]) => ({
                              name: key.charAt(0).toUpperCase() + key.slice(1),
                              value: value,
                            }))}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {Object.entries(analysis.sector_allocation)
                            .filter(([_, value]) => value > 0)
                            .map((_, index) => (
                              <Cell key={`cell-${index}`} fill={sectorColors[index % sectorColors.length]} />
                            ))}
                        </Pie>
                        <Tooltip formatter={(value, name) => [`${value.toFixed(2)}%`, name]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quick Stats */}
            <Card className="glassmorphism border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg">Portfolio Value</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-gray-900">
                    ${holdings.reduce((sum, h) => sum + (h.value || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-sm text-gray-500">Total Value</p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Holdings</span>
                    <span className="font-medium">{holdings.filter(h => h.symbol).length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Largest Position</span>
                    <span className="font-medium">
                      {holdings.sort((a, b) => (b.value || 0) - (a.value || 0))[0]?.symbol || '-'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* NEW: Detailed Analysis Report */}
          <Card className="glassmorphism border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-xl">
                <BarChart3 className="w-6 h-6 text-indigo-600" />
                Portfolio Analysis Report
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Risk Analysis Section */}
              {analysis.portfolio_risk && (
                <div className="p-6 bg-blue-50/50 rounded-2xl border-2 border-blue-100">
                  <h3 className="text-lg font-semibold text-blue-800 mb-4">Risk Analysis</h3>
                  <div className="grid md:grid-cols-2 gap-6 items-center">
                    <div className="text-center space-y-2">
                      <p className="text-5xl font-bold text-blue-700">{analysis.portfolio_risk.portfolio_beta?.toFixed(2)}</p>
                      <p className="font-semibold text-blue-900">Portfolio Beta</p>
                      <Badge className="bg-blue-200 text-blue-800">{analysis.portfolio_risk.risk_level} Risk</Badge>
                    </div>
                    <p className="text-blue-700 leading-relaxed text-sm">
                      {analysis.portfolio_risk.explanation}
                    </p>
                  </div>
                </div>
              )}

              {/* Report Card Section */}
              {analysis.report_card && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Portfolio Report Card</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {Object.entries({
                      'Risk Management': analysis.report_card.risk_management,
                      'Diversification': analysis.report_card.diversification,
                      'Performance': analysis.report_card.performance
                    }).map(([category, details]) => (
                      <Card key={category} className="shadow-md hover:shadow-lg transition-shadow">
                        <CardHeader className="flex flex-row items-start justify-between gap-4">
                          <div>
                            {getReportCardIcon(category)}
                            <p className="font-semibold mt-2 text-gray-700">{category}</p>
                          </div>
                          <div className={`text-4xl font-bold ${getGradeColor(details.grade)}`}>
                            {details.grade}
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-gray-600">{details.explanation}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Recommendations Section */}
              {Array.isArray(analysis.recommendations) && analysis.recommendations.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Actionable Recommendations</h3>
                  <div className="space-y-3">
                    {analysis.recommendations.map((rec, index) => (
                      <div key={index} className="flex items-start gap-3 p-4 bg-emerald-50/50 rounded-xl border border-emerald-100">
                        <Lightbulb className="w-5 h-5 text-emerald-600 mt-1 flex-shrink-0" />
                        <p className="text-sm text-emerald-800">{rec}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* NEW: Cross-Module Integration Panel */}
      {analysis && (analysis.budget_integration || analysis.goal_integration || analysis.learning_recommendations) && (
        <Card className="glassmorphism border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              Smart Integration Recommendations
            </CardTitle>
            <p className="text-sm text-gray-600">Personalized actions across your entire financial journey</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-3 gap-6">
              {/* Budget Integration */}
              {analysis.budget_integration && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-green-600" />
                    <h4 className="font-semibold text-green-700">Budget Optimization</h4>
                  </div>
                  {analysis.budget_integration.monthly_investment_target !== undefined && (
                    <div className="p-3 bg-green-50 rounded-lg">
                      <p className="text-sm font-medium text-green-800">
                        Target: ${analysis.budget_integration.monthly_investment_target.toLocaleString()} / month
                      </p>
                      <p className="text-xs text-green-600">
                        ({analysis.budget_integration.investment_percentage}% of income)
                      </p>
                    </div>
                  )}
                  {Array.isArray(analysis.budget_integration.suggestions) && analysis.budget_integration.suggestions.length > 0 && (
                    <div className="space-y-2">
                      {analysis.budget_integration.suggestions.map((suggestion, index) => (
                        <p key={index} className="text-sm text-gray-700 bg-green-50 p-2 rounded">
                          {suggestion}
                        </p>
                      ))}
                    </div>
                  )}
                  <Link to={createPageUrl("BudgetBuilder")}>
                    <Button variant="outline" size="sm" className="gap-2 text-green-700 border-green-200 hover:bg-green-50">
                      <Calculator className="w-4 h-4" />
                      Update Budget
                    </Button>
                  </Link>
                </div>
              )}

              {/* Goal Integration */}
              {analysis.goal_integration && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-purple-600" />
                    <h4 className="font-semibold text-purple-700">Goal Alignment</h4>
                  </div>
                  {Array.isArray(analysis.goal_integration.goal_specific_advice) && analysis.goal_integration.goal_specific_advice.length > 0 && (
                    <div className="space-y-2">
                      {analysis.goal_integration.goal_specific_advice.map((advice, index) => (
                        <p key={index} className="text-sm text-gray-700 bg-purple-50 p-2 rounded">
                          {advice}
                        </p>
                      ))}
                    </div>
                  )}
                  {Array.isArray(analysis.goal_integration.timeline_adjustments) && analysis.goal_integration.timeline_adjustments.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="text-xs font-medium text-purple-600">Timeline Adjustments:</h5>
                      {analysis.goal_integration.timeline_adjustments.map((adjustment, index) => (
                        <p key={index} className="text-xs text-gray-600 bg-purple-50 p-2 rounded">
                          {adjustment}
                        </p>
                      ))}
                    </div>
                  )}
                  <Link to={createPageUrl("Goals")}>
                    <Button variant="outline" size="sm" className="gap-2 text-purple-700 border-purple-200 hover:bg-purple-50">
                      <Target className="w-4 h-4" />
                      Review Goals
                    </Button>
                  </Link>
                </div>
              )}

              {/* Learning Integration */}
              {Array.isArray(analysis.learning_recommendations) && analysis.learning_recommendations.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-amber-600" />
                    <h4 className="font-semibold text-amber-700">Recommended Learning</h4>
                  </div>
                  <div className="space-y-2">
                    {analysis.learning_recommendations.slice(0, 3).map((recommendation, index) => (
                      <p key={index} className="text-sm text-gray-700 bg-amber-50 p-2 rounded">
                        {recommendation}
                      </p>
                    ))}
                  </div>
                  <Link to={createPageUrl("Learn")}>
                    <Button variant="outline" size="sm" className="gap-2 text-amber-700 border-amber-200 hover:bg-amber-50">
                      <Lightbulb className="w-4 h-4" />
                      Start Learning
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* "What If" Scenario Simulator */}
      {analysis && (
        <Card className="glassmorphism border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Beaker className="w-5 h-5 text-teal-600" />
              "What If" Scenario Simulator
            </CardTitle>
            <p className="text-sm text-gray-600">See how potential changes could impact your portfolio's future.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4 items-end">
              <div>
                <Label>What would you like to do?</Label>
                 <Select value={simulationInput.changeType} onValueChange={(value) => setSimulationInput(prev => ({...prev, changeType: value}))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="add_cash">Invest more cash</SelectItem>
                      <SelectItem value="buy_stock">Buy a specific stock</SelectItem>
                    </SelectContent>
                  </Select>
              </div>
              
              {simulationInput.changeType === 'add_cash' ? (
                <div>
                  <Label htmlFor="amount_invest">Amount to Invest</Label>
                  <Input id="amount_invest" type="number" value={simulationInput.amount} onChange={(e) => setSimulationInput(prev => ({...prev, amount: parseFloat(e.target.value)}))} placeholder="1000" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="ticker_symbol">Ticker Symbol</Label>
                    <Input id="ticker_symbol" value={simulationInput.symbol} onChange={(e) => setSimulationInput(prev => ({...prev, symbol: e.target.value.toUpperCase()}))} placeholder="AAPL" />
                  </div>
                  <div>
                    <Label htmlFor="num_shares">Number of Shares</Label>
                    <Input id="num_shares" type="number" value={simulationInput.shares} onChange={(e) => setSimulationInput(prev => ({...prev, shares: parseFloat(e.target.value)}))} placeholder="10" />
                  </div>
                </div>
              )}
            </div>
            <Button 
              onClick={runSimulation} 
              disabled={isSimulating || (simulationInput.changeType === 'buy_stock' && (!simulationInput.symbol || !simulationInput.shares))} 
              className="w-full bg-gradient-to-r from-teal-600 to-cyan-500 hover:from-teal-700 hover:to-cyan-600 gap-2"
            >
              {isSimulating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Beaker className="w-4 h-4" />}
              {isSimulating ? 'Simulating...' : 'Run Simulation'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Simulation Results */}
      <AnimatePresence>
        {simulationResult && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card className="glassmorphism border-0 shadow-lg bg-teal-50/50">
              <CardHeader>
                <CardTitle>Simulation Results</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <p className="italic text-gray-700">"{simulationResult.summary}"</p>

                <div className="grid md:grid-cols-3 gap-4 text-center">
                  <div className="p-4 bg-white rounded-lg shadow">
                    <p className="text-sm text-gray-500">New Total Value</p>
                    <p className="text-xl font-bold text-gray-800">
                      ${(simulationResult.new_total_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-gray-400">
                      Was: ${performanceData?.total_value?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 'N/A'}
                    </p>
                  </div>
                   <div className="p-4 bg-white rounded-lg shadow">
                    <p className="text-sm text-gray-500">New Risk Score</p>
                    <p className="text-xl font-bold text-gray-800">
                      {simulationResult.new_risk_score}/10
                    </p>
                     <p className="text-xs text-gray-400">
                       Was: {analysis?.risk_score || 'N/A'}/10
                     </p>
                  </div>
                   <div className="p-4 bg-white rounded-lg shadow">
                    <p className="text-sm text-gray-500">New Diversification</p>
                    <p className="text-xl font-bold text-gray-800">
                      {simulationResult.new_diversification_score}/10
                    </p>
                     <p className="text-xs text-gray-400">
                       Was: {analysis?.diversification_score || 'N/A'}/10
                     </p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold text-green-700 mb-2">✅ Pros</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                      {Array.isArray(simulationResult.pros) && simulationResult.pros.map((pro, i) => <li key={i}>{pro}</li>)}
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-orange-700 mb-2">⚠️ Cons / Risks</h4>
                     <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                      {Array.isArray(simulationResult.cons) && simulationResult.cons.map((con, i) => <li key={i}>{con}</li>)}
                    </ul>
                  </div>
                </div>

                {simulationResult.suggested_allocation && (
                  <div className="p-4 bg-white rounded-lg shadow">
                     <h4 className="font-semibold text-teal-700 mb-2">💡 Suggested Allocation</h4>
                     <p className="text-sm text-gray-700">{simulationResult.suggested_allocation}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
