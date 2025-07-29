import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Calculator, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";

export default function FedPolicyCalculator({ title, description }) {
  const [inputs, setInputs] = useState({
    mortgageBalance: 300000,
    mortgageRate: 3.5,
    savingsBalance: 50000,
    savingsRate: 1.0,
    creditCardBalance: 15000,
    creditCardRate: 18.5,
    loanBalance: 25000,
    loanRate: 6.0
  });

  const [rateChange, setRateChange] = useState([0]);
  const [results, setResults] = useState(null);

  const calculateRateImpact = () => {
    const rateAdjustment = rateChange[0];
    
    // Calculate new rates (some are more sensitive to Fed changes than others)
    const newMortgageRate = Math.max(0.1, inputs.mortgageRate + (rateAdjustment * 0.8)); // 80% correlation
    const newSavingsRate = Math.max(0.01, inputs.savingsRate + (rateAdjustment * 0.9)); // 90% correlation
    const newCreditCardRate = Math.max(5, inputs.creditCardRate + rateAdjustment); // 100% correlation
    const newLoanRate = Math.max(0.1, inputs.loanRate + (rateAdjustment * 0.85)); // 85% correlation

    // Calculate monthly payments and interest
    const calculateMonthlyPayment = (principal, rate, years = 30) => {
      const monthlyRate = rate / 100 / 12;
      const numPayments = years * 12;
      if (rate === 0) return principal / numPayments;
      return principal * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
             (Math.pow(1 + monthlyRate, numPayments) - 1);
    };

    // Current payments
    const currentMortgagePayment = calculateMonthlyPayment(inputs.mortgageBalance, inputs.mortgageRate);
    const currentLoanPayment = calculateMonthlyPayment(inputs.loanBalance, inputs.loanRate, 5);
    const currentCreditCardPayment = inputs.creditCardBalance * (inputs.creditCardRate / 100 / 12) + (inputs.creditCardBalance * 0.02); // Min payment approximation
    const currentSavingsIncome = inputs.savingsBalance * (inputs.savingsRate / 100 / 12);

    // New payments
    const newMortgagePayment = calculateMonthlyPayment(inputs.mortgageBalance, newMortgageRate);
    const newLoanPayment = calculateMonthlyPayment(inputs.loanBalance, newLoanRate, 5);
    const newCreditCardPayment = inputs.creditCardBalance * (newCreditCardRate / 100 / 12) + (inputs.creditCardBalance * 0.02);
    const newSavingsIncome = inputs.savingsBalance * (newSavingsRate / 100 / 12);

    // Calculate impacts
    const mortgageImpact = newMortgagePayment - currentMortgagePayment;
    const loanImpact = newLoanPayment - currentLoanPayment;
    const creditCardImpact = newCreditCardPayment - currentCreditCardPayment;
    const savingsImpact = newSavingsIncome - currentSavingsIncome;

    const totalMonthlyImpact = mortgageImpact + loanImpact + creditCardImpact - savingsImpact;
    const annualImpact = totalMonthlyImpact * 12;

    const impacts = [
      {
        category: "Mortgage",
        current: currentMortgagePayment,
        new: newMortgagePayment,
        impact: mortgageImpact,
        balance: inputs.mortgageBalance
      },
      {
        category: "Personal Loan", 
        current: currentLoanPayment,
        new: newLoanPayment,
        impact: loanImpact,
        balance: inputs.loanBalance
      },
      {
        category: "Credit Card",
        current: currentCreditCardPayment,
        new: newCreditCardPayment,
        impact: creditCardImpact,
        balance: inputs.creditCardBalance
      },
      {
        category: "Savings Income",
        current: -currentSavingsIncome, // Negative because it's income
        new: -newSavingsIncome,
        impact: -savingsImpact, // Negative because income increase reduces net cost
        balance: inputs.savingsBalance
      }
    ].filter(item => item.balance > 0);

    setResults({
      impacts,
      rateChanges: {
        mortgage: { old: inputs.mortgageRate, new: newMortgageRate },
        savings: { old: inputs.savingsRate, new: newSavingsRate },
        creditCard: { old: inputs.creditCardRate, new: newCreditCardRate },
        loan: { old: inputs.loanRate, new: newLoanRate }
      },
      totalMonthlyImpact,
      annualImpact,
      rateAdjustment
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

  const formatCurrencyDetailed = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const getImpactColor = (impact) => {
    if (Math.abs(impact) < 10) return "text-gray-600";
    return impact > 0 ? "text-red-600" : "text-green-600";
  };

  const getImpactIcon = (impact) => {
    if (Math.abs(impact) < 10) return null;
    return impact > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />;
  };

  return (
    <Card className="glassmorphism border-0 shadow-lg mb-8">
      <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-t-2xl">
        <CardTitle className="flex items-center gap-3 text-xl">
          <Calculator className="w-6 h-6 text-green-600" />
          {title || "Fed Rate Impact Calculator"}
        </CardTitle>
        {description && (
          <p className="text-gray-600 text-sm mt-2">{description}</p>
        )}
      </CardHeader>
      <CardContent className="p-8">
        <div className="grid xl:grid-cols-3 gap-8">
          {/* Input Section */}
          <div className="xl:col-span-1 space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Financial Profile</h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="mortgageBalance">Mortgage Balance ($)</Label>
                  <Input
                    id="mortgageBalance"
                    type="number"
                    value={inputs.mortgageBalance}
                    onChange={(e) => setInputs(prev => ({ 
                      ...prev, 
                      mortgageBalance: parseFloat(e.target.value) || 0 
                    }))}
                  />
                </div>

                <div>
                  <Label htmlFor="mortgageRate">Current Mortgage Rate (%)</Label>
                  <Input
                    id="mortgageRate"
                    type="number"
                    step="0.01"
                    value={inputs.mortgageRate}
                    onChange={(e) => setInputs(prev => ({ 
                      ...prev, 
                      mortgageRate: parseFloat(e.target.value) || 0 
                    }))}
                  />
                </div>

                <div>
                  <Label htmlFor="savingsBalance">Savings Balance ($)</Label>
                  <Input
                    id="savingsBalance"
                    type="number"
                    value={inputs.savingsBalance}
                    onChange={(e) => setInputs(prev => ({ 
                      ...prev, 
                      savingsBalance: parseFloat(e.target.value) || 0 
                    }))}
                  />
                </div>

                <div>
                  <Label htmlFor="savingsRate">Savings Interest Rate (%)</Label>
                  <Input
                    id="savingsRate"
                    type="number"
                    step="0.01"
                    value={inputs.savingsRate}
                    onChange={(e) => setInputs(prev => ({ 
                      ...prev, 
                      savingsRate: parseFloat(e.target.value) || 0 
                    }))}
                  />
                </div>

                <div>
                  <Label htmlFor="creditCardBalance">Credit Card Balance ($)</Label>
                  <Input
                    id="creditCardBalance"
                    type="number"
                    value={inputs.creditCardBalance}
                    onChange={(e) => setInputs(prev => ({ 
                      ...prev, 
                      creditCardBalance: parseFloat(e.target.value) || 0 
                    }))}
                  />
                </div>

                <div>
                  <Label htmlFor="loanBalance">Other Loan Balance ($)</Label>
                  <Input
                    id="loanBalance"
                    type="number"
                    value={inputs.loanBalance}
                    onChange={(e) => setInputs(prev => ({ 
                      ...prev, 
                      loanBalance: parseFloat(e.target.value) || 0 
                    }))}
                  />
                </div>
              </div>
            </div>

            {/* Rate Change Slider */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Fed Rate Change Scenario</h3>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium text-gray-700">Federal Funds Rate Change</label>
                  <Badge variant="outline" className="font-mono">
                    {rateChange[0] > 0 ? '+' : ''}{rateChange[0]}%
                  </Badge>
                </div>
                <Slider
                  value={rateChange}
                  onValueChange={setRateChange}
                  max={3}
                  min={-3}
                  step={0.25}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>-3% (Cut)</span>
                  <span>0% (No Change)</span>
                  <span>+3% (Raise)</span>
                </div>
              </div>
            </div>

            <Button
              onClick={calculateRateImpact}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600"
            >
              <Calculator className="w-4 h-4 mr-2" />
              Calculate Impact
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
                {/* Total Impact Summary */}
                <div className="text-center p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <DollarSign className="w-6 h-6 text-blue-600" />
                    <h3 className="text-xl font-semibold text-gray-900">Total Monthly Impact</h3>
                  </div>
                  <div className={`text-3xl font-bold ${getImpactColor(results.totalMonthlyImpact)}`}>
                    {results.totalMonthlyImpact > 0 ? '+' : ''}{formatCurrencyDetailed(results.totalMonthlyImpact)}
                  </div>
                  <div className={`text-sm ${getImpactColor(results.annualImpact)} mt-1`}>
                    ({formatCurrency(results.annualImpact)} annually)
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {results.rateAdjustment > 0 
                      ? "Higher rates increase your borrowing costs" 
                      : results.rateAdjustment < 0 
                      ? "Lower rates reduce your borrowing costs"
                      : "No rate change means no impact on your finances"
                    }
                  </p>
                </div>

                {/* Impact by Category */}
                <div>
                  <h4 className="text-md font-semibold text-gray-900 mb-3">Impact Breakdown</h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={results.impacts}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="category" />
                        <YAxis tickFormatter={(value) => `$${value.toFixed(0)}`} />
                        <Tooltip 
                          formatter={(value) => [formatCurrencyDetailed(value), "Monthly Impact"]}
                          labelFormatter={(label) => `${label} Impact`}
                        />
                        <Bar 
                          dataKey="impact" 
                          fill={(entry) => entry > 0 ? "#ef4444" : "#10b981"}
                          name="Monthly Impact ($)"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Detailed Breakdown Table */}
                <div>
                  <h4 className="text-md font-semibold text-gray-900 mb-3">Detailed Rate Changes</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left p-3 font-semibold">Category</th>
                          <th className="text-right p-3 font-semibold">Old Rate</th>
                          <th className="text-right p-3 font-semibold">New Rate</th>
                          <th className="text-right p-3 font-semibold">Monthly Impact</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.impacts.map((impact, index) => (
                          <tr key={index} className="border-b border-gray-100">
                            <td className="p-3 font-medium">{impact.category}</td>
                            <td className="p-3 text-right">
                              {impact.category === "Mortgage" && `${results.rateChanges.mortgage.old.toFixed(2)}%`}
                              {impact.category === "Personal Loan" && `${results.rateChanges.loan.old.toFixed(2)}%`}
                              {impact.category === "Credit Card" && `${results.rateChanges.creditCard.old.toFixed(2)}%`}
                              {impact.category === "Savings Income" && `${results.rateChanges.savings.old.toFixed(2)}%`}
                            </td>
                            <td className="p-3 text-right">
                              {impact.category === "Mortgage" && `${results.rateChanges.mortgage.new.toFixed(2)}%`}
                              {impact.category === "Personal Loan" && `${results.rateChanges.loan.new.toFixed(2)}%`}
                              {impact.category === "Credit Card" && `${results.rateChanges.creditCard.new.toFixed(2)}%`}
                              {impact.category === "Savings Income" && `${results.rateChanges.savings.new.toFixed(2)}%`}
                            </td>
                            <td className={`p-3 text-right font-semibold ${getImpactColor(impact.impact)}`}>
                              <div className="flex items-center justify-end gap-1">
                                {getImpactIcon(impact.impact)}
                                {impact.impact > 0 ? '+' : ''}{formatCurrencyDetailed(Math.abs(impact.impact))}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Strategic Recommendations */}
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <h4 className="font-semibold text-yellow-900 mb-2">Strategic Recommendations</h4>
                  <div className="text-sm text-yellow-800 space-y-2">
                    {results.rateAdjustment > 0 && (
                      <>
                        <p>• Consider paying down variable-rate debt before rates rise further</p>
                        <p>• Look for higher-yield savings accounts to capture better returns</p>
                        <p>• If buying a home, consider locking in mortgage rates now</p>
                      </>
                    )}
                    {results.rateAdjustment < 0 && (
                      <>
                        <p>• Consider refinancing fixed-rate debt to take advantage of lower rates</p>
                        <p>• Lock in longer-term CDs before rates fall further</p>
                        <p>• Good time for major purchases requiring financing</p>
                      </>
                    )}
                    {results.rateAdjustment === 0 && (
                      <p>• Focus on fundamental financial health rather than rate timing</p>
                    )}
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="h-full flex items-center justify-center text-center">
                <div>
                  <Calculator className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">Fed Policy Impact Calculator</h3>
                  <p className="text-gray-500">
                    Enter your financial details and adjust the Fed rate change scenario to see how monetary policy affects your monthly budget.
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