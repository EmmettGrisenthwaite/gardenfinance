import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { Calculator, Users, DollarSign, Gift, TrendingDown, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";

const STATE_EXEMPTIONS = {
  'None': { exemption: 0, rate: 0 },
  'Connecticut': { exemption: 12920000, rate: 12 },
  'Hawaii': { exemption: 5490000, rate: 20 },
  'Illinois': { exemption: 4000000, rate: 16 },
  'Maine': { exemption: 6010000, rate: 12 },
  'Massachusetts': { exemption: 2000000, rate: 16 },
  'Minnesota': { exemption: 3000000, rate: 16 },
  'New York': { exemption: 6580000, rate: 16 },
  'Oregon': { exemption: 1000000, rate: 20 },
  'Rhode Island': { exemption: 1733264, rate: 16 },
  'Vermont': { exemption: 5000000, rate: 16 },
  'Washington': { exemption: 2193000, rate: 20 },
  'DC': { exemption: 4521900, rate: 16 }
};

export default function EstateTaxCalculator() {
  const [inputs, setInputs] = useState({
    totalEstate: 5000000,
    marriageStatus: 'married',
    state: 'None',
    lifeInsurance: 500000,
    businessValue: 1000000,
    realEstate: 1500000,
    investments: 1500000,
    other: 500000,
    debts: 200000,
    charitableBequest: 0,
    currentAge: 55,
    spouseAge: 52,
    children: 2
  });

  const [giftingStrategy, setGiftingStrategy] = useState({
    annualGifts: 36000, // Married couple to one child
    recipients: 2,
    years: 10,
    giftTax: false
  });

  const [results, setResults] = useState(null);

  const calculateEstateTax = () => {
    const currentYear = 2024;
    const federalExemption = 13610000; // 2024 exemption
    const federalRate = 0.40;
    
    // Calculate adjusted gross estate
    const grossEstate = inputs.totalEstate + inputs.lifeInsurance;
    const adjustedGrossEstate = grossEstate - inputs.debts - inputs.charitableBequest;
    
    // State tax calculation
    const stateInfo = STATE_EXEMPTIONS[inputs.state];
    const stateExemption = stateInfo.exemption;
    const stateRate = stateInfo.rate / 100;
    
    // Federal estate tax
    let federalTax = 0;
    if (inputs.marriageStatus === 'single') {
      if (adjustedGrossEstate > federalExemption) {
        federalTax = (adjustedGrossEstate - federalExemption) * federalRate;
      }
    } else {
      // Married - assume proper planning with unlimited marital deduction
      // Estate tax typically occurs at second death
      if (adjustedGrossEstate > (federalExemption * 2)) {
        federalTax = (adjustedGrossEstate - (federalExemption * 2)) * federalRate;
      }
    }
    
    // State estate tax
    let stateTax = 0;
    if (stateExemption > 0 && adjustedGrossEstate > stateExemption) {
      const applicableExemption = inputs.marriageStatus === 'married' ? stateExemption * 2 : stateExemption;
      if (adjustedGrossEstate > applicableExemption) {
        stateTax = (adjustedGrossEstate - applicableExemption) * stateRate;
      }
    }
    
    const totalTax = federalTax + stateTax;
    const netToHeirs = adjustedGrossEstate - totalTax;
    
    // Gifting strategy analysis
    const maxAnnualGifting = giftingStrategy.annualGifts * giftingStrategy.recipients;
    const totalGiftsOverTime = maxAnnualGifting * giftingStrategy.years;
    
    // Estate with gifting strategy
    const estateAfterGifting = Math.max(0, adjustedGrossEstate - totalGiftsOverTime);
    
    // Recalculate taxes after gifting
    let federalTaxAfterGifting = 0;
    if (inputs.marriageStatus === 'single') {
      if (estateAfterGifting > federalExemption) {
        federalTaxAfterGifting = (estateAfterGifting - federalExemption) * federalRate;
      }
    } else {
      if (estateAfterGifting > (federalExemption * 2)) {
        federalTaxAfterGifting = (estateAfterGifting - (federalExemption * 2)) * federalRate;
      }
    }
    
    let stateTaxAfterGifting = 0;
    if (stateExemption > 0) {
      const applicableExemption = inputs.marriageStatus === 'married' ? stateExemption * 2 : stateExemption;
      if (estateAfterGifting > applicableExemption) {
        stateTaxAfterGifting = (estateAfterGifting - applicableExemption) * stateRate;
      }
    }
    
    const totalTaxAfterGifting = federalTaxAfterGifting + stateTaxAfterGifting;
    const netToHeirsAfterGifting = estateAfterGifting - totalTaxAfterGifting + totalGiftsOverTime;
    const taxSavingsFromGifting = totalTax - totalTaxAfterGifting;
    
    // Generate projections for different estate values
    const projections = [];
    for (let estateValue = 1000000; estateValue <= 20000000; estateValue += 1000000) {
      let projectedFederalTax = 0;
      let projectedStateTax = 0;
      
      const exemptionMultiplier = inputs.marriageStatus === 'married' ? 2 : 1;
      
      if (estateValue > federalExemption * exemptionMultiplier) {
        projectedFederalTax = (estateValue - federalExemption * exemptionMultiplier) * federalRate;
      }
      
      if (stateExemption > 0 && estateValue > stateExemption * exemptionMultiplier) {
        projectedStateTax = (estateValue - stateExemption * exemptionMultiplier) * stateRate;
      }
      
      projections.push({
        estateValue: estateValue,
        federalTax: projectedFederalTax,
        stateTax: projectedStateTax,
        totalTax: projectedFederalTax + projectedStateTax,
        effectiveRate: ((projectedFederalTax + projectedStateTax) / estateValue) * 100
      });
    }
    
    // Sunset analysis (2026 reversion)
    const postSunsetExemption = 6000000; // Estimated 2026 exemption
    let postSunsetFederalTax = 0;
    
    if (inputs.marriageStatus === 'single') {
      if (adjustedGrossEstate > postSunsetExemption) {
        postSunsetFederalTax = (adjustedGrossEstate - postSunsetExemption) * federalRate;
      }
    } else {
      if (adjustedGrossEstate > (postSunsetExemption * 2)) {
        postSunsetFederalTax = (adjustedGrossEstate - (postSunsetExemption * 2)) * federalRate;
      }
    }
    
    const postSunsetTotalTax = postSunsetFederalTax + stateTax;
    const additionalTaxFromSunset = postSunsetTotalTax - totalTax;
    
    setResults({
      grossEstate,
      adjustedGrossEstate,
      federalTax,
      stateTax,
      totalTax,
      netToHeirs,
      effectiveRate: (totalTax / adjustedGrossEstate) * 100,
      federalExemption: inputs.marriageStatus === 'married' ? federalExemption * 2 : federalExemption,
      stateExemption: inputs.marriageStatus === 'married' ? stateExemption * 2 : stateExemption,
      
      // Gifting analysis
      totalGiftsOverTime,
      estateAfterGifting,
      totalTaxAfterGifting,
      netToHeirsAfterGifting,
      taxSavingsFromGifting,
      
      // Projections
      projections,
      
      // Sunset analysis
      additionalTaxFromSunset,
      postSunsetTotalTax
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

  const formatPercent = (value) => {
    return value.toFixed(1) + '%';
  };

  return (
    <Card className="glassmorphism border-0 shadow-lg mb-8">
      <CardHeader className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-t-2xl">
        <CardTitle className="flex items-center gap-3 text-xl">
          <Calculator className="w-6 h-6 text-purple-600" />
          Interactive Estate Tax and Gifting Calculator
        </CardTitle>
        <p className="text-gray-600 text-sm mt-2">
          Estimate estate tax liability and optimize gifting strategies with current exemptions
        </p>
      </CardHeader>
      <CardContent className="p-8">
        <div className="grid xl:grid-cols-3 gap-8">
          {/* Input Section */}
          <div className="xl:col-span-1 space-y-6">
            {/* Basic Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="totalEstate">Total Estate Value ($)</Label>
                  <Input
                    id="totalEstate"
                    type="number"
                    value={inputs.totalEstate}
                    onChange={(e) => setInputs(prev => ({ 
                      ...prev, 
                      totalEstate: parseFloat(e.target.value) || 0 
                    }))}
                  />
                </div>
                
                <div>
                  <Label htmlFor="marriageStatus">Marriage Status</Label>
                  <Select 
                    value={inputs.marriageStatus} 
                    onValueChange={(value) => setInputs(prev => ({ ...prev, marriageStatus: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">Single</SelectItem>
                      <SelectItem value="married">Married</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="state">State of Residence</Label>
                  <Select 
                    value={inputs.state} 
                    onValueChange={(value) => setInputs(prev => ({ ...prev, state: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(STATE_EXEMPTIONS).map(state => (
                        <SelectItem key={state} value={state}>{state}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="currentAge">Your Age</Label>
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
                    <Label htmlFor="children">Number of Children</Label>
                    <Input
                      id="children"
                      type="number"
                      value={inputs.children}
                      onChange={(e) => setInputs(prev => ({ 
                        ...prev, 
                        children: parseInt(e.target.value) || 0 
                      }))}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Asset Details */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Asset Breakdown</h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="realEstate">Real Estate ($)</Label>
                  <Input
                    id="realEstate"
                    type="number"
                    value={inputs.realEstate}
                    onChange={(e) => setInputs(prev => ({ 
                      ...prev, 
                      realEstate: parseFloat(e.target.value) || 0 
                    }))}
                  />
                </div>
                <div>
                  <Label htmlFor="investments">Investments ($)</Label>
                  <Input
                    id="investments"
                    type="number"
                    value={inputs.investments}
                    onChange={(e) => setInputs(prev => ({ 
                      ...prev, 
                      investments: parseFloat(e.target.value) || 0 
                    }))}
                  />
                </div>
                <div>
                  <Label htmlFor="businessValue">Business Interests ($)</Label>
                  <Input
                    id="businessValue"
                    type="number"
                    value={inputs.businessValue}
                    onChange={(e) => setInputs(prev => ({ 
                      ...prev, 
                      businessValue: parseFloat(e.target.value) || 0 
                    }))}
                  />
                </div>
                <div>
                  <Label htmlFor="lifeInsurance">Life Insurance Death Benefit ($)</Label>
                  <Input
                    id="lifeInsurance"
                    type="number"
                    value={inputs.lifeInsurance}
                    onChange={(e) => setInputs(prev => ({ 
                      ...prev, 
                      lifeInsurance: parseFloat(e.target.value) || 0 
                    }))}
                  />
                </div>
                <div>
                  <Label htmlFor="debts">Total Debts ($)</Label>
                  <Input
                    id="debts"
                    type="number"
                    value={inputs.debts}
                    onChange={(e) => setInputs(prev => ({ 
                      ...prev, 
                      debts: parseFloat(e.target.value) || 0 
                    }))}
                  />
                </div>
                <div>
                  <Label htmlFor="charitableBequest">Charitable Bequests ($)</Label>
                  <Input
                    id="charitableBequest"
                    type="number"
                    value={inputs.charitableBequest}
                    onChange={(e) => setInputs(prev => ({ 
                      ...prev, 
                      charitableBequest: parseFloat(e.target.value) || 0 
                    }))}
                  />
                </div>
              </div>
            </div>

            {/* Gifting Strategy */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Gifting Strategy</h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="annualGifts">Annual Gifts per Recipient ($)</Label>
                  <Input
                    id="annualGifts"
                    type="number"
                    value={giftingStrategy.annualGifts}
                    onChange={(e) => setGiftingStrategy(prev => ({ 
                      ...prev, 
                      annualGifts: parseFloat(e.target.value) || 0 
                    }))}
                  />
                  <p className="text-xs text-gray-500 mt-1">2024 limit: $18k single, $36k married</p>
                </div>
                <div>
                  <Label htmlFor="recipients">Number of Recipients</Label>
                  <Input
                    id="recipients"
                    type="number"
                    value={giftingStrategy.recipients}
                    onChange={(e) => setGiftingStrategy(prev => ({ 
                      ...prev, 
                      recipients: parseInt(e.target.value) || 0 
                    }))}
                  />
                </div>
                <div>
                  <Label htmlFor="years">Years of Gifting</Label>
                  <Input
                    id="years"
                    type="number"
                    value={giftingStrategy.years}
                    onChange={(e) => setGiftingStrategy(prev => ({ 
                      ...prev, 
                      years: parseInt(e.target.value) || 0 
                    }))}
                  />
                </div>
              </div>
            </div>

            <Button
              onClick={calculateEstateTax}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-500 hover:from-purple-700 hover:to-indigo-600"
            >
              <Calculator className="w-4 h-4 mr-2" />
              Calculate Estate Tax
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
                {/* Estate Tax Summary */}
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="w-5 h-5 text-red-600" />
                      <span className="text-sm font-medium text-red-800">Total Estate Tax</span>
                    </div>
                    <div className="text-2xl font-bold text-red-900">
                      {formatCurrency(results.totalTax)}
                    </div>
                    <div className="text-xs text-red-700">
                      Effective rate: {formatPercent(results.effectiveRate)}
                    </div>
                  </div>

                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="w-5 h-5 text-green-600" />
                      <span className="text-sm font-medium text-green-800">Net to Heirs</span>
                    </div>
                    <div className="text-2xl font-bold text-green-900">
                      {formatCurrency(results.netToHeirs)}
                    </div>
                    <div className="text-xs text-green-700">
                      After taxes and expenses
                    </div>
                  </div>

                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Gift className="w-5 h-5 text-blue-600" />
                      <span className="text-sm font-medium text-blue-800">Gifting Savings</span>
                    </div>
                    <div className="text-2xl font-bold text-blue-900">
                      {formatCurrency(results.taxSavingsFromGifting)}
                    </div>
                    <div className="text-xs text-blue-700">
                      From {giftingStrategy.years}-year strategy
                    </div>
                  </div>
                </div>

                {/* Tax Breakdown */}
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-3">Tax Breakdown</h4>
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Gross Estate:</span>
                        <span className="font-mono">{formatCurrency(results.grossEstate)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Less: Debts & Charitable:</span>
                        <span className="font-mono">({formatCurrency(inputs.debts + inputs.charitableBequest)})</span>
                      </div>
                      <div className="flex justify-between font-semibold">
                        <span>Adjusted Gross Estate:</span>
                        <span className="font-mono">{formatCurrency(results.adjustedGrossEstate)}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Federal Exemption:</span>
                        <span className="font-mono">{formatCurrency(results.federalExemption)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Federal Tax (40%):</span>
                        <span className="font-mono">{formatCurrency(results.federalTax)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>State Tax:</span>
                        <span className="font-mono">{formatCurrency(results.stateTax)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sunset Provision Warning */}
                {results.additionalTaxFromSunset > 0 && (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-5 h-5 text-yellow-600 mt-1 flex-shrink-0" />
                      <div>
                        <h4 className="font-semibold text-yellow-900 mb-2">Tax Law Sunset Warning</h4>
                        <p className="text-yellow-800 text-sm mb-2">
                          Current high exemptions expire December 31, 2025. Under 2026 law:
                        </p>
                        <div className="text-sm space-y-1">
                          <p>• Additional estate tax: <span className="font-semibold">{formatCurrency(results.additionalTaxFromSunset)}</span></p>
                          <p>• Consider making large gifts before 2026 using current exemptions</p>
                          <p>• Consult with estate planning professional for advanced strategies</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Estate Tax Projections Chart */}
                <div>
                  <h4 className="text-md font-semibold text-gray-900 mb-3">Estate Tax by Estate Value</h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={results.projections}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="estateValue" 
                          tickFormatter={(value) => `$${(value/1000000).toFixed(0)}M`}
                        />
                        <YAxis 
                          tickFormatter={(value) => `$${(value/1000000).toFixed(1)}M`}
                        />
                        <Tooltip 
                          formatter={(value) => [formatCurrency(value), ""]}
                          labelFormatter={(value) => `Estate Value: ${formatCurrency(value)}`}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="federalTax" 
                          stroke="#ef4444" 
                          strokeWidth={2} 
                          name="Federal Tax"
                        />
                        <Line 
                          type="monotone" 
                          dataKey="stateTax" 
                          stroke="#f97316" 
                          strokeWidth={2} 
                          name="State Tax"
                        />
                        <Line 
                          type="monotone" 
                          dataKey="totalTax" 
                          stroke="#dc2626" 
                          strokeWidth={3} 
                          name="Total Tax"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Gifting Strategy Analysis */}
                {results.taxSavingsFromGifting > 0 && (
                  <div>
                    <h4 className="text-md font-semibold text-gray-900 mb-3">Gifting Strategy Impact</h4>
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="grid md:grid-cols-2 gap-4 text-sm">
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span>Total Gifts Over {giftingStrategy.years} Years:</span>
                            <span className="font-mono">{formatCurrency(results.totalGiftsOverTime)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Reduced Estate Value:</span>
                            <span className="font-mono">{formatCurrency(results.estateAfterGifting)}</span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span>Estate Tax After Gifting:</span>
                            <span className="font-mono">{formatCurrency(results.totalTaxAfterGifting)}</span>
                          </div>
                          <div className="flex justify-between font-semibold text-green-700">
                            <span>Tax Savings:</span>
                            <span className="font-mono">{formatCurrency(results.taxSavingsFromGifting)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-2">Strategic Recommendations</h4>
                  <div className="text-sm text-blue-800 space-y-2">
                    {results.totalTax > 0 ? (
                      <>
                        <p>• Your estate may be subject to significant taxes - planning is essential</p>
                        <p>• Consider annual gifting to reduce estate size over time</p>
                        <p>• Explore advanced strategies: trusts, charitable planning, business succession</p>
                        <p>• Life insurance can provide liquidity for tax payments</p>
                      </>
                    ) : (
                      <>
                        <p>• Your estate is currently below taxable thresholds</p>
                        <p>• Focus on basic estate planning: wills, powers of attorney, beneficiaries</p>
                        <p>• Monitor estate growth and tax law changes</p>
                      </>
                    )}
                    <p>• Review and update estate plan regularly</p>
                    <p>• Work with qualified estate planning professionals for complex situations</p>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="h-full flex items-center justify-center text-center">
                <div>
                  <Calculator className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">Estate Tax Calculator</h3>
                  <p className="text-gray-500 max-w-md">
                    Enter your estate details to estimate potential estate tax liability and evaluate 
                    the impact of different gifting strategies on your wealth transfer plan.
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