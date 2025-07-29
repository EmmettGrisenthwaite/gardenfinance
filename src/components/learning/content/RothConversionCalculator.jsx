
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from "recharts";
import { Calculator, TrendingUp, DollarSign, Zap, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

export default function RothConversionCalculator() {
  const [inputs, setInputs] = useState({
    currentAge: 45,
    retirementAge: 65,
    traditionalIRA: 500000,
    currentIncome: 80000,
    retirementIncome: 60000,
    currentTaxRate: 22,
    retirementTaxRate: 22,
    rateOfReturn: 7
  });

  const [conversionAmount, setConversionAmount] = useState([50000]);
  const [results, setResults] = useState(null);

  const calculateRothConversion = () => {
    const conversion = conversionAmount[0];
    const yearsToRetirement = inputs.retirementAge - inputs.currentAge;
    const yearsInRetirement = 30; // Assume 30 years in retirement
    
    // Tax calculations
    const conversionTax = conversion * (inputs.currentTaxRate / 100);
    // const afterTaxConversion = conversion - conversionTax; // This variable was declared but not used

    // Scenario 1: No Conversion
    const traditionalAtRetirement = inputs.traditionalIRA * Math.pow(1 + inputs.rateOfReturn/100, yearsToRetirement);
    
    // Assume RMDs starting at retirement
    let traditionalRMDs = [];
    let remainingTraditional = traditionalAtRetirement;
    
    for (let year = 0; year < yearsInRetirement; year++) {
      // Simplified RMD calculation, distributing current remaining balance over remaining years
      // This is a simplification and not how actual RMDs are calculated (which use IRS life expectancy tables)
      // For calculation purposes here, it serves to deplete the account over the retirement period.
      const rmdRate = 1 / (yearsInRetirement - year); 
      const rmd = remainingTraditional * rmdRate;
      const taxOnRMD = rmd * (inputs.retirementTaxRate / 100);
      const afterTaxRMD = rmd - taxOnRMD;
      
      traditionalRMDs.push({
        year: inputs.retirementAge + year,
        rmd: rmd,
        tax: taxOnRMD,
        afterTax: afterTaxRMD,
        remaining: remainingTraditional - rmd // This remaining value is before growth for the next iteration
      });
      
      // Update remaining balance for next year, accounting for growth and withdrawal
      remainingTraditional = (remainingTraditional - rmd) * (1 + inputs.rateOfReturn/100);
      // Ensure remainingTraditional doesn't go negative due to simplified RMD calculation in later years
      if (remainingTraditional < 0) remainingTraditional = 0;
    }
    
    // Scenario 2: With Conversion
    const remainingTraditionalAfterConversion = inputs.traditionalIRA - conversion;
    const remainingTradAtRetirement = remainingTraditionalAfterConversion * Math.pow(1 + inputs.rateOfReturn/100, yearsToRetirement);
    const rothAtRetirement = conversion * Math.pow(1 + inputs.rateOfReturn/100, yearsToRetirement);
    
    let conversionRMDs = [];
    let remainingTradWithConv = remainingTradAtRetirement;
    let remainingRoth = rothAtRetirement;
    
    for (let year = 0; year < yearsInRetirement; year++) {
      const rmdRate = 1 / (yearsInRetirement - year);
      const tradRMD = remainingTradWithConv * rmdRate;
      const taxOnTradRMD = tradRMD * (inputs.retirementTaxRate / 100);
      
      // For Roth, we assume a proportional withdrawal to match the traditional's RMD pattern,
      // ensuring the Roth account also gets drawn down over the retirement period.
      const rothWithdrawal = remainingRoth * rmdRate; 
      
      const totalAfterTax = (tradRMD - taxOnTradRMD) + rothWithdrawal; // Roth withdrawal is tax-free
      
      conversionRMDs.push({
        year: inputs.retirementAge + year,
        tradRMD: tradRMD,
        rothWithdrawal: rothWithdrawal,
        tax: taxOnTradRMD,
        afterTax: totalAfterTax,
        remainingTrad: remainingTradWithConv - tradRMD,
        remainingRoth: remainingRoth - rothWithdrawal
      });
      
      remainingTradWithConv = (remainingTradWithConv - tradRMD) * (1 + inputs.rateOfReturn/100);
      remainingRoth = (remainingRoth - rothWithdrawal) * (1 + inputs.rateOfReturn/100);

      if (remainingTradWithConv < 0) remainingTradWithConv = 0;
      if (remainingRoth < 0) remainingRoth = 0;
    }
    
    // Calculate lifetime values
    const totalNoConversion = traditionalRMDs.reduce((sum, year) => sum + year.afterTax, 0);
    const totalWithConversion = conversionRMDs.reduce((sum, year) => sum + year.afterTax, 0);
    const lifetimeBenefit = totalWithConversion - totalNoConversion;
    
    // Account for upfront tax cost
    const netBenefit = lifetimeBenefit - conversionTax;
    
    // Calculate tax savings
    const totalTaxNoConversion = traditionalRMDs.reduce((sum, year) => sum + year.tax, 0);
    const totalTaxWithConversion = conversionTax + conversionRMDs.reduce((sum, year) => sum + year.tax, 0);
    const totalTaxSavings = totalTaxNoConversion - totalTaxWithConversion;
    
    // Determine optimal bracket analysis
    const marginalBrackets = [
      { rate: 10, min: 0, max: 11600 }, // 2024 single filing standard deduction
      { rate: 12, min: 11601, max: 47150 },
      { rate: 22, min: 47151, max: 100525 },
      { rate: 24, min: 100526, max: 191950 },
      { rate: 32, min: 191951, max: 243725 },
      { rate: 35, min: 243726, max: 609350 },
      { rate: 37, min: 609351, max: Infinity }
    ];
    
    // Adjust marginal brackets for single filers to simplify; more robust would factor in filing status and deductions
    const currentBracket = marginalBrackets.find(b => 
      inputs.currentIncome >= b.min && inputs.currentIncome <= b.max
    );
    
    const spaceInBracket = currentBracket ? currentBracket.max - inputs.currentIncome : 0;
    // Suggest conversion up to the top of the current bracket or 10% of IRA, whichever is less.
    const optimalConversion = Math.min(Math.max(0, spaceInBracket), inputs.traditionalIRA * 0.1); 
    
    setResults({
      conversionAmount: conversion,
      conversionTax,
      traditionalAtRetirement,
      rothAtRetirement,
      lifetimeBenefit,
      netBenefit,
      totalTaxSavings,
      traditionalRMDs: traditionalRMDs.slice(0, 10), // Show first 10 years
      conversionRMDs: conversionRMDs.slice(0, 10),
      currentBracket,
      spaceInBracket,
      optimalConversion,
      // Ensure conversionTax is not zero to prevent division by zero
      paybackYears: (netBenefit < 0 && conversionTax > 0) ? (conversionTax / (Math.abs(lifetimeBenefit / yearsInRetirement))) : 0 // If net benefit is negative, it's a "payback" in terms of loss
    });
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getBracketColor = (rate) => {
    if (rate <= 12) return "bg-green-100 text-green-800";
    if (rate <= 22) return "bg-yellow-100 text-yellow-800";
    if (rate <= 32) return "bg-orange-100 text-orange-800";
    return "bg-red-100 text-red-800";
  };

  const chartData = results ? results.traditionalRMDs.map((traditional, index) => ({
    year: traditional.year,
    noConversion: traditional.afterTax,
    withConversion: results.conversionRMDs[index]?.afterTax || 0,
    taxSavings: (results.conversionRMDs[index]?.afterTax || 0) - traditional.afterTax
  })) : [];

  return (
    <Card className="glassmorphism border-0 shadow-lg mb-8">
      <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-t-2xl">
        <CardTitle className="flex items-center gap-3 text-xl">
          <Calculator className="w-6 h-6 text-green-600" />
          Interactive Roth Conversion Analyzer
        </CardTitle>
        <p className="text-gray-600 text-sm mt-2">
          Optimize your Roth conversion strategy with personalized tax bracket analysis
        </p>
      </CardHeader>
      <CardContent className="p-8">
        <div className="grid xl:grid-cols-3 gap-8">
          {/* Input Section */}
          <div className="xl:col-span-1 space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="currentAge">Current Age</Label>
                  <Input
                    id="currentAge"
                    type="number"
                    value={inputs.currentAge}
                    onChange={(e) => setInputs(prev => ({ 
                      ...prev, 
                      currentAge: parseInt(e.target.value) || 0 
                    }))}
                  />
                </div>
                <div>
                  <Label htmlFor="retirementAge">Retirement Age</Label>
                  <Input
                    id="retirementAge"
                    type="number"
                    value={inputs.retirementAge}
                    onChange={(e) => setInputs(prev => ({ 
                      ...prev, 
                      retirementAge: parseInt(e.target.value) || 0 
                    }))}
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Financial Details</h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="traditionalIRA">Traditional IRA/401k Balance ($)</Label>
                  <Input
                    id="traditionalIRA"
                    type="number"
                    value={inputs.traditionalIRA}
                    onChange={(e) => setInputs(prev => ({ 
                      ...prev, 
                      traditionalIRA: parseFloat(e.target.value) || 0 
                    }))}
                  />
                </div>
                <div>
                  <Label htmlFor="currentIncome">Current Annual Income ($)</Label>
                  <Input
                    id="currentIncome"
                    type="number"
                    value={inputs.currentIncome}
                    onChange={(e) => setInputs(prev => ({ 
                      ...prev, 
                      currentIncome: parseFloat(e.target.value) || 0 
                    }))}
                  />
                </div>
                <div>
                  <Label htmlFor="retirementIncome">Expected Retirement Income ($)</Label>
                  <Input
                    id="retirementIncome"
                    type="number"
                    value={inputs.retirementIncome}
                    onChange={(e) => setInputs(prev => ({ 
                      ...prev, 
                      retirementIncome: parseFloat(e.target.value) || 0 
                    }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="currentTaxRate">Current Tax Rate (%)</Label>
                    <Input
                      id="currentTaxRate"
                      type="number"
                      value={inputs.currentTaxRate}
                      onChange={(e) => setInputs(prev => ({ 
                        ...prev, 
                        currentTaxRate: parseFloat(e.target.value) || 0 
                      }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="retirementTaxRate">Retirement Tax Rate (%)</Label>
                    <Input
                      id="retirementTaxRate"
                      type="number"
                      value={inputs.retirementTaxRate}
                      onChange={(e) => setInputs(prev => ({ 
                        ...prev, 
                        retirementTaxRate: parseFloat(e.target.value) || 0 
                      }))}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="rateOfReturn">Expected Annual Return (%)</Label>
                  <Input
                    id="rateOfReturn"
                    type="number"
                    step="0.1"
                    value={inputs.rateOfReturn}
                    onChange={(e) => setInputs(prev => ({ 
                      ...prev, 
                      rateOfReturn: parseFloat(e.target.value) || 0 
                    }))}
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Conversion Amount</h3>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium text-gray-700">Conversion Amount ($)</label>
                  <Badge variant="outline" className="font-mono">
                    {formatCurrency(conversionAmount[0])}
                  </Badge>
                </div>
                <Slider
                  value={conversionAmount}
                  onValueChange={setConversionAmount}
                  max={inputs.traditionalIRA}
                  min={0}
                  step={5000}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>$0</span>
                  <span>{formatCurrency(inputs.traditionalIRA)}</span>
                </div>
              </div>
            </div>

            <Button
              onClick={calculateRothConversion}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600"
            >
              <Calculator className="w-4 h-4 mr-2" />
              Analyze Conversion
            </Button>
          </div>

          {/* Results Section */}
          <div className="xl:col-span-2">
            {results ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* Summary Cards */}
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="w-5 h-5 text-blue-600" />
                      <span className="text-sm font-medium text-blue-800">Conversion Tax</span>
                    </div>
                    <div className="text-2xl font-bold text-blue-900">
                      {formatCurrency(results.conversionTax)}
                    </div>
                    <div className="text-xs text-blue-700">
                      Upfront cost at {inputs.currentTaxRate}% rate
                    </div>
                  </div>

                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-5 h-5 text-green-600" />
                      <span className="text-sm font-medium text-green-800">Net Lifetime Benefit</span>
                    </div>
                    <div className="text-2xl font-bold text-green-900">
                      {formatCurrency(results.netBenefit)}
                    </div>
                    <div className="text-xs text-green-700">
                      After accounting for upfront tax
                    </div>
                  </div>

                  <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="w-5 h-5 text-purple-600" />
                      <span className="text-sm font-medium text-purple-800">Payback Period</span>
                    </div>
                    <div className="text-2xl font-bold text-purple-900">
                      {results.paybackYears > 0 ? `${results.paybackYears.toFixed(1)} years` : 'N/A'}
                    </div>
                    <div className="text-xs text-purple-700">
                      Time to recover conversion tax (if beneficial)
                    </div>
                  </div>
                </div>

                {/* Tax Bracket Analysis */}
                {results.currentBracket && (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-yellow-600 mt-1 flex-shrink-0" />
                      <div>
                        <h4 className="font-semibold text-yellow-900 mb-2">Tax Bracket Optimization</h4>
                        <div className="grid md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-medium">Current bracket:</span>
                            <Badge className={`ml-2 ${getBracketColor(results.currentBracket.rate)}`}>
                              {results.currentBracket.rate}%
                            </Badge>
                          </div>
                          <div>
                            <span className="font-medium">Room in bracket:</span>
                            <span className="ml-2 font-mono">{formatCurrency(results.spaceInBracket)}</span>
                          </div>
                        </div>
                        <p className="text-yellow-800 mt-2">
                          <span className="font-medium">Suggested conversion to fill current bracket:</span> {formatCurrency(results.optimalConversion)}.
                          This can optimize tax efficiency by avoiding higher brackets.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Retirement Income Comparison Chart */}
                <div>
                  <h4 className="text-md font-semibold text-gray-900 mb-3">Retirement Income Comparison (First 10 Years)</h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="year" />
                        <YAxis tickFormatter={(value) => `$${(value/1000).toFixed(0)}k`} />
                        <Tooltip formatter={(value) => [formatCurrency(value), ""]} />
                        <Legend />
                        <Bar dataKey="noConversion" fill="#ef4444" name="After-Tax Income (No Conversion)" />
                        <Bar dataKey="withConversion" fill="#10b981" name="After-Tax Income (With Conversion)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Detailed Year-by-Year Analysis */}
                <div>
                  <h4 className="text-md font-semibold text-gray-900 mb-3">Year-by-Year After-Tax Income (First 5 Years)</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left p-3 font-semibold">Year</th>
                          <th className="text-right p-3 font-semibold">No Conversion</th>
                          <th className="text-right p-3 font-semibold">With Conversion</th>
                          <th className="text-right p-3 font-semibold">Annual Benefit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {chartData.slice(0, 5).map((year, index) => (
                          <tr key={index} className="border-b border-gray-100">
                            <td className="p-3 font-medium">{year.year}</td>
                            <td className="p-3 text-right">{formatCurrency(year.noConversion)}</td>
                            <td className="p-3 text-right">{formatCurrency(year.withConversion)}</td>
                            <td className={`p-3 text-right font-semibold ${
                              year.taxSavings > 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {formatCurrency(year.taxSavings)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Strategic Recommendations */}
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h4 className="font-semibold text-green-900 mb-2">Strategic Recommendations</h4>
                  <div className="text-sm text-green-800 space-y-2">
                    {results.netBenefit > 0 ? (
                      <>
                        <p>✅ This conversion appears beneficial with a net lifetime benefit of {formatCurrency(results.netBenefit)}.</p>
                        <p>• Consider converting {formatCurrency(results.optimalConversion)} to optimize tax brackets.</p>
                        <p>• Spread conversions over multiple years to manage tax impact and avoid jumping into higher brackets.</p>
                      </>
                    ) : (
                      <>
                        <p>⚠️ Based on these inputs, this conversion may not be optimal for you, resulting in a net lifetime cost of {formatCurrency(Math.abs(results.netBenefit))}.</p>
                        <p>• Consider waiting for a lower income year or market downturn to convert at a lower tax cost.</p>
                        <p>• Reassess if tax rates, income expectations, or investment returns change significantly.</p>
                      </>
                    )}
                    <p>• Pay conversion taxes from non-retirement accounts if possible to maximize the growth of your Roth funds.</p>
                    <p>• Review your strategy annually as circumstances, tax laws, and market conditions change.</p>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="h-full flex items-center justify-center text-center">
                <div>
                  <Calculator className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">Roth Conversion Analyzer</h3>
                  <p className="text-gray-500 max-w-md">
                    Enter your financial details and a potential conversion amount to analyze the long-term impact 
                    of converting traditional retirement funds to Roth accounts.
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
