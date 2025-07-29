import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { Calculator, TrendingUp, DollarSign, Target, Zap } from "lucide-react";
import { motion } from "framer-motion";

const COLORS = {
  taxable: "#3b82f6",
  traditional: "#ef4444", 
  roth: "#10b981",
  hsa: "#8b5cf6"
};

const ACCOUNT_TYPES = [
  { key: "taxable", name: "Taxable Account", color: COLORS.taxable },
  { key: "traditional", name: "Traditional IRA/401k", color: COLORS.traditional },
  { key: "roth", name: "Roth IRA/401k", color: COLORS.roth },
  { key: "hsa", name: "Health Savings Account", color: COLORS.hsa }
];

export default function AssetLocationOptimizer() {
  const [portfolio, setPortfolio] = useState({
    usStocks: 40000,
    intlStocks: 20000,
    bonds: 25000,
    reits: 10000,
    commodities: 5000
  });

  const [accounts, setAccounts] = useState({
    taxable: 50000,
    traditional: 30000,
    roth: 15000,
    hsa: 5000
  });

  const [optimization, setOptimization] = useState(null);
  const [isOptimizing, setIsOptimizing] = useState(false);

  const totalPortfolio = Object.values(portfolio).reduce((sum, value) => sum + value, 0);
  const totalAccounts = Object.values(accounts).reduce((sum, value) => sum + value, 0);

  const optimizeAssetLocation = () => {
    setIsOptimizing(true);
    
    setTimeout(() => {
      // Asset location optimization logic
      const assetPriorities = {
        // Tax efficiency rankings (higher = better in taxable)
        usStocks: { 
          taxable: 9, traditional: 6, roth: 8, hsa: 8,
          reason: "Tax-efficient with qualified dividends and long-term capital gains treatment"
        },
        intlStocks: { 
          taxable: 8, traditional: 5, roth: 7, hsa: 7,
          reason: "Foreign tax credit available in taxable accounts"
        },
        bonds: { 
          taxable: 3, traditional: 9, roth: 4, hsa: 5,
          reason: "Interest taxed as ordinary income - better in tax-deferred accounts"
        },
        reits: { 
          taxable: 2, traditional: 8, roth: 6, hsa: 7,
          reason: "Non-qualified dividends taxed as ordinary income"
        },
        commodities: { 
          taxable: 1, traditional: 7, roth: 5, hsa: 6,
          reason: "Often taxed as ordinary income - inefficient in taxable"
        }
      };

      // Calculate optimal allocation
      const optimalAllocation = {};
      const currentAllocation = {};
      
      // Initialize allocations
      ACCOUNT_TYPES.forEach(account => {
        optimalAllocation[account.key] = {};
        currentAllocation[account.key] = {};
        Object.keys(portfolio).forEach(asset => {
          optimalAllocation[account.key][asset] = 0;
          currentAllocation[account.key][asset] = 0;
        });
      });

      // Simple allocation: assign assets to highest priority accounts first
      const sortedAssets = Object.keys(portfolio).sort((a, b) => {
        // Sort by tax efficiency difference between taxable and traditional
        const aDiff = assetPriorities[a].taxable - assetPriorities[a].traditional;
        const bDiff = assetPriorities[b].taxable - assetPriorities[b].traditional;
        return bDiff - aDiff;
      });

      let remainingCapacity = { ...accounts };
      
      // Allocate each asset type
      sortedAssets.forEach(asset => {
        let remainingAsset = portfolio[asset];
        
        // Try to allocate to accounts in priority order
        const accountPriority = ACCOUNT_TYPES.sort((a, b) => 
          assetPriorities[asset][b.key] - assetPriorities[asset][a.key]
        );
        
        accountPriority.forEach(account => {
          if (remainingAsset > 0 && remainingCapacity[account.key] > 0) {
            const allocation = Math.min(remainingAsset, remainingCapacity[account.key]);
            optimalAllocation[account.key][asset] = allocation;
            remainingAsset -= allocation;
            remainingCapacity[account.key] -= allocation;
          }
        });
      });

      // Calculate current (proportional) allocation for comparison
      ACCOUNT_TYPES.forEach(account => {
        const accountPortion = accounts[account.key] / totalAccounts;
        Object.keys(portfolio).forEach(asset => {
          currentAllocation[account.key][asset] = portfolio[asset] * accountPortion;
        });
      });

      // Calculate tax savings estimate
      const calculateTaxDrag = (allocation, isOptimal = false) => {
        let totalDrag = 0;
        
        ACCOUNT_TYPES.forEach(account => {
          Object.keys(portfolio).forEach(asset => {
            const amount = allocation[account.key][asset];
            if (amount > 0) {
              let dragRate = 0;
              
              // Simplified tax drag calculation
              if (account.key === 'taxable') {
                if (asset === 'bonds' || asset === 'reits') dragRate = 0.025; // High tax drag
                else if (asset === 'commodities') dragRate = 0.03;
                else dragRate = 0.01; // Low tax drag for stocks
              }
              // No drag for tax-advantaged accounts
              
              totalDrag += amount * dragRate;
            }
          });
        });
        
        return totalDrag;
      };

      const currentTaxDrag = calculateTaxDrag(currentAllocation);
      const optimalTaxDrag = calculateTaxDrag(optimalAllocation, true);
      const annualSavings = currentTaxDrag - optimalTaxDrag;

      // Generate recommendations
      const recommendations = [];
      
      // Compare allocations and generate specific recommendations
      Object.keys(portfolio).forEach(asset => {
        const currentTaxable = currentAllocation.taxable[asset];
        const optimalTaxable = optimalAllocation.taxable[asset];
        const difference = optimalTaxable - currentTaxable;
        
        if (Math.abs(difference) > 1000) {
          if (difference > 0) {
            recommendations.push({
              type: "move_to_taxable",
              asset,
              amount: Math.abs(difference),
              reason: assetPriorities[asset].reason
            });
          } else {
            recommendations.push({
              type: "move_from_taxable",
              asset,
              amount: Math.abs(difference),
              reason: assetPriorities[asset].reason
            });
          }
        }
      });

      setOptimization({
        currentAllocation,
        optimalAllocation,
        currentTaxDrag,
        optimalTaxDrag,
        annualSavings,
        recommendations,
        assetPriorities
      });
      
      setIsOptimizing(false);
    }, 2000);
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getAssetName = (key) => {
    const names = {
      usStocks: "US Stocks",
      intlStocks: "International Stocks", 
      bonds: "Bonds",
      reits: "REITs",
      commodities: "Commodities"
    };
    return names[key] || key;
  };

  const pieChartData = Object.keys(portfolio).map(asset => ({
    name: getAssetName(asset),
    value: portfolio[asset],
    percentage: ((portfolio[asset] / totalPortfolio) * 100).toFixed(1)
  }));

  const accountData = ACCOUNT_TYPES.map(account => ({
    name: account.name,
    value: accounts[account.key],
    percentage: ((accounts[account.key] / totalAccounts) * 100).toFixed(1)
  }));

  return (
    <Card className="glassmorphism border-0 shadow-lg mb-8">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-2xl">
        <CardTitle className="flex items-center gap-3 text-xl">
          <Calculator className="w-6 h-6 text-blue-600" />
          Interactive Asset Location Optimizer
        </CardTitle>
        <p className="text-gray-600 text-sm mt-2">
          Find the optimal placement for your investments across taxable and tax-advantaged accounts
        </p>
      </CardHeader>
      <CardContent className="p-8">
        <div className="grid xl:grid-cols-3 gap-8">
          {/* Input Section */}
          <div className="xl:col-span-1 space-y-6">
            {/* Portfolio Allocation */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Portfolio Composition</h3>
              <div className="space-y-4">
                {Object.keys(portfolio).map(asset => (
                  <div key={asset}>
                    <Label htmlFor={asset}>{getAssetName(asset)} ($)</Label>
                    <Input
                      id={asset}
                      type="number"
                      value={portfolio[asset]}
                      onChange={(e) => setPortfolio(prev => ({ 
                        ...prev, 
                        [asset]: parseFloat(e.target.value) || 0 
                      }))}
                    />
                  </div>
                ))}
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Total Portfolio:</span>
                    <span className="font-bold text-blue-600">{formatCurrency(totalPortfolio)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Account Balances */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Balances</h3>
              <div className="space-y-4">
                {ACCOUNT_TYPES.map(account => (
                  <div key={account.key}>
                    <Label htmlFor={account.key}>{account.name} ($)</Label>
                    <Input
                      id={account.key}
                      type="number"
                      value={accounts[account.key]}
                      onChange={(e) => setAccounts(prev => ({ 
                        ...prev, 
                        [account.key]: parseFloat(e.target.value) || 0 
                      }))}
                    />
                  </div>
                ))}
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Total Accounts:</span>
                    <span className="font-bold text-green-600">{formatCurrency(totalAccounts)}</span>
                  </div>
                </div>
              </div>
            </div>

            <Button
              onClick={optimizeAssetLocation}
              disabled={isOptimizing || totalPortfolio !== totalAccounts}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-500 hover:from-blue-700 hover:to-indigo-600"
            >
              {isOptimizing ? (
                <>
                  <Zap className="w-4 h-4 mr-2 animate-pulse" />
                  Optimizing...
                </>
              ) : (
                <>
                  <Target className="w-4 h-4 mr-2" />
                  Optimize Asset Location
                </>
              )}
            </Button>
            
            {totalPortfolio !== totalAccounts && (
              <p className="text-sm text-amber-600 text-center">
                ⚠️ Portfolio total must equal account total to optimize
              </p>
            )}
          </div>

          {/* Results Section */}
          <div className="xl:col-span-2">
            {optimization ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* Savings Summary */}
                <div className="text-center p-6 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <DollarSign className="w-6 h-6 text-green-600" />
                    <h3 className="text-xl font-semibold text-gray-900">Estimated Annual Tax Savings</h3>
                  </div>
                  <div className="text-3xl font-bold text-green-600">
                    {formatCurrency(optimization.annualSavings)}
                  </div>
                  <div className="text-sm text-gray-600 mt-2">
                    Current drag: {formatCurrency(optimization.currentTaxDrag)} → 
                    Optimized drag: {formatCurrency(optimization.optimalTaxDrag)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Over 30 years: {formatCurrency(optimization.annualSavings * 30)}+ in potential savings
                  </div>
                </div>

                {/* Asset Location Priorities */}
                <div>
                  <h4 className="text-md font-semibold text-gray-900 mb-3">Asset Location Priorities</h4>
                  <div className="space-y-3">
                    {Object.keys(optimization.assetPriorities).map(asset => (
                      <div key={asset} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex justify-between items-start mb-2">
                          <h5 className="font-semibold text-gray-800">{getAssetName(asset)}</h5>
                          <div className="flex gap-2">
                            {ACCOUNT_TYPES.map(account => (
                              <Badge 
                                key={account.key}
                                className={`text-xs ${
                                  optimization.assetPriorities[asset][account.key] >= 7 
                                    ? 'bg-green-100 text-green-800' 
                                    : optimization.assetPriorities[asset][account.key] >= 5
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-red-100 text-red-800'
                                }`}
                                variant="outline"
                              >
                                {account.key}: {optimization.assetPriorities[asset][account.key]}/10
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <p className="text-sm text-gray-600">
                          {optimization.assetPriorities[asset].reason}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recommendations */}
                {optimization.recommendations.length > 0 && (
                  <div>
                    <h4 className="text-md font-semibold text-gray-900 mb-3">Optimization Recommendations</h4>
                    <div className="space-y-3">
                      {optimization.recommendations.map((rec, index) => (
                        <div key={index} className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex items-start gap-3">
                            <div className={`w-2 h-2 rounded-full mt-2 ${
                              rec.type === 'move_to_taxable' ? 'bg-blue-600' : 'bg-orange-600'
                            }`}></div>
                            <div className="flex-1">
                              <h5 className="font-semibold text-gray-900 mb-1">
                                {rec.type === 'move_to_taxable' ? 'Move to Taxable Account' : 'Move from Taxable Account'}
                              </h5>
                              <p className="text-sm text-gray-700 mb-2">
                                <span className="font-medium">{getAssetName(rec.asset)}:</span> {formatCurrency(rec.amount)}
                              </p>
                              <p className="text-xs text-gray-600">{rec.reason}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Current vs Optimal Allocation Comparison */}
                <div>
                  <h4 className="text-md font-semibold text-gray-900 mb-3">Current vs. Optimal Allocation</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left p-3 font-semibold">Asset Class</th>
                          <th className="text-right p-3 font-semibold">Taxable Current</th>
                          <th className="text-right p-3 font-semibold">Taxable Optimal</th>
                          <th className="text-right p-3 font-semibold">Difference</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.keys(portfolio).map(asset => {
                          const currentTaxable = optimization.currentAllocation.taxable[asset];
                          const optimalTaxable = optimization.optimalAllocation.taxable[asset];
                          const difference = optimalTaxable - currentTaxable;
                          
                          return (
                            <tr key={asset} className="border-b border-gray-100">
                              <td className="p-3 font-medium">{getAssetName(asset)}</td>
                              <td className="p-3 text-right">{formatCurrency(currentTaxable)}</td>
                              <td className="p-3 text-right">{formatCurrency(optimalTaxable)}</td>
                              <td className={`p-3 text-right font-semibold ${
                                Math.abs(difference) < 100 ? 'text-gray-600' :
                                difference > 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {difference > 0 ? '+' : ''}{formatCurrency(difference)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="h-full flex items-center justify-center text-center">
                <div>
                  <Calculator className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">Asset Location Optimizer</h3>
                  <p className="text-gray-500 max-w-md">
                    Enter your portfolio composition and account balances to discover the optimal placement 
                    for tax efficiency. This can save you thousands annually in unnecessary taxes.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Portfolio and Account Visualization */}
        {!optimization && (
          <div className="grid md:grid-cols-2 gap-6 mt-8">
            <div>
              <h4 className="text-md font-semibold text-gray-900 mb-3">Portfolio Allocation</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percentage }) => `${name}: ${percentage}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={`hsl(${index * 45}, 70%, 60%)`} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div>
              <h4 className="text-md font-semibold text-gray-900 mb-3">Account Distribution</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={accountData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percentage }) => `${name}: ${percentage}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {accountData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={ACCOUNT_TYPES[index].color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}