import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, AlertCircle, Calculator, PieChart } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";

export default function DCFModelBuilder() {
  const [inputs, setInputs] = useState({
    initialRevenue: 10000000,
    revenueGrowthYears: [0.15, 0.12, 0.10, 0.08, 0.06],
    ebitdaMargin: 0.25,
    taxRate: 0.25,
    capexPercent: 0.05,
    nwcPercent: 0.02,
    wacc: 0.10,
    terminalGrowth: 0.03,
    depreciation: 0.04
  });

  const [results, setResults] = useState(null);
  const [sensitivityData, setSensitivityData] = useState(null);

  const calculateDCF = () => {
    const projections = [];
    let revenue = inputs.initialRevenue;

    // Calculate explicit forecast period
    for (let year = 1; year <= 5; year++) {
      const growthRate = inputs.revenueGrowthYears[year - 1];
      revenue *= (1 + growthRate);
      
      const ebitda = revenue * inputs.ebitdaMargin;
      const depreciation = revenue * inputs.depreciation;
      const ebit = ebitda - depreciation;
      const taxes = ebit * inputs.taxRate;
      const nopat = ebit - taxes;
      const capex = revenue * inputs.capexPercent;
      const nwcChange = revenue * inputs.nwcPercent * growthRate;
      const fcf = nopat + depreciation - capex - nwcChange;
      const pvFactor = Math.pow(1 + inputs.wacc, year);
      const presentValue = fcf / pvFactor;

      projections.push({
        year,
        revenue: Math.round(revenue),
        ebitda: Math.round(ebitda),
        fcf: Math.round(fcf),
        presentValue: Math.round(presentValue),
        growthRate: growthRate * 100
      });
    }

    // Terminal value calculation
    const terminalFCF = projections[4].fcf * (1 + inputs.terminalGrowth);
    const terminalValue = terminalFCF / (inputs.wacc - inputs.terminalGrowth);
    const pvTerminalValue = terminalValue / Math.pow(1 + inputs.wacc, 5);

    // Sum up enterprise value
    const pvOfProjections = projections.reduce((sum, p) => sum + p.presentValue, 0);
    const enterpriseValue = pvOfProjections + pvTerminalValue;

    // Sensitivity analysis
    const waccRange = [0.08, 0.09, 0.10, 0.11, 0.12];
    const terminalGrowthRange = [0.02, 0.025, 0.03, 0.035, 0.04];
    const sensitivity = [];

    waccRange.forEach(wacc => {
      terminalGrowthRange.forEach(tg => {
        const termFCF = projections[4].fcf * (1 + tg);
        const termVal = termFCF / (wacc - tg);
        const pvTerm = termVal / Math.pow(1 + wacc, 5);
        const pvProj = projections.reduce((sum, p) => sum + (p.fcf / Math.pow(1 + wacc, p.year)), 0);
        const ev = pvProj + pvTerm;
        
        sensitivity.push({
          wacc: wacc * 100,
          terminalGrowth: tg * 100,
          enterpriseValue: Math.round(ev)
        });
      });
    });

    setResults({
      projections,
      enterpriseValue: Math.round(enterpriseValue),
      pvOfProjections: Math.round(pvOfProjections),
      pvTerminalValue: Math.round(pvTerminalValue),
      terminalValue: Math.round(terminalValue),
      terminalValuePercent: (pvTerminalValue / enterpriseValue) * 100
    });

    setSensitivityData(sensitivity);
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatMillions = (value) => {
    return `$${(value / 1000000).toFixed(1)}M`;
  };

  return (
    <Card className="glassmorphism border-0 shadow-lg mb-8">
      <CardHeader className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-t-2xl">
        <CardTitle className="flex items-center gap-3 text-xl">
          <Calculator className="w-6 h-6 text-purple-600" />
          Interactive DCF Model Builder
        </CardTitle>
        <p className="text-gray-600 text-sm mt-2">
          Build a complete DCF valuation model with sensitivity analysis
        </p>
      </CardHeader>
      <CardContent className="p-8">
        <div className="grid xl:grid-cols-3 gap-8">
          {/* Input Section */}
          <div className="xl:col-span-1 space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">DCF Assumptions</h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="initialRevenue">Current Revenue ($)</Label>
                  <Input
                    id="initialRevenue"
                    type="number"
                    value={inputs.initialRevenue}
                    onChange={(e) => setInputs(prev => ({ 
                      ...prev, 
                      initialRevenue: parseFloat(e.target.value) || 0 
                    }))}
                  />
                </div>

                <div>
                  <Label>Revenue Growth Rates (%)</Label>
                  <div className="grid grid-cols-5 gap-1">
                    {inputs.revenueGrowthYears.map((rate, index) => (
                      <div key={index}>
                        <Input
                          placeholder={`Yr ${index + 1}`}
                          type="number"
                          step="0.01"
                          value={rate * 100}
                          onChange={(e) => {
                            const newRates = [...inputs.revenueGrowthYears];
                            newRates[index] = (parseFloat(e.target.value) || 0) / 100;
                            setInputs(prev => ({ ...prev, revenueGrowthYears: newRates }));
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="ebitdaMargin">EBITDA Margin (%)</Label>
                  <Input
                    id="ebitdaMargin"
                    type="number"
                    step="0.01"
                    value={inputs.ebitdaMargin * 100}
                    onChange={(e) => setInputs(prev => ({ 
                      ...prev, 
                      ebitdaMargin: (parseFloat(e.target.value) || 0) / 100 
                    }))}
                  />
                </div>

                <div>
                  <Label htmlFor="taxRate">Tax Rate (%)</Label>
                  <Input
                    id="taxRate"
                    type="number"
                    step="0.01"
                    value={inputs.taxRate * 100}
                    onChange={(e) => setInputs(prev => ({ 
                      ...prev, 
                      taxRate: (parseFloat(e.target.value) || 0) / 100 
                    }))}
                  />
                </div>

                <div>
                  <Label htmlFor="wacc">WACC (%)</Label>
                  <Input
                    id="wacc"
                    type="number"
                    step="0.01"
                    value={inputs.wacc * 100}
                    onChange={(e) => setInputs(prev => ({ 
                      ...prev, 
                      wacc: (parseFloat(e.target.value) || 0) / 100 
                    }))}
                  />
                </div>

                <div>
                  <Label htmlFor="terminalGrowth">Terminal Growth Rate (%)</Label>
                  <Input
                    id="terminalGrowth"
                    type="number"
                    step="0.01"
                    value={inputs.terminalGrowth * 100}
                    onChange={(e) => setInputs(prev => ({ 
                      ...prev, 
                      terminalGrowth: (parseFloat(e.target.value) || 0) / 100 
                    }))}
                  />
                </div>

                <div>
                  <Label htmlFor="capexPercent">Capex (% of Revenue)</Label>
                  <Input
                    id="capexPercent"
                    type="number"
                    step="0.01"
                    value={inputs.capexPercent * 100}
                    onChange={(e) => setInputs(prev => ({ 
                      ...prev, 
                      capexPercent: (parseFloat(e.target.value) || 0) / 100 
                    }))}
                  />
                </div>
              </div>

              <Button
                onClick={calculateDCF}
                className="w-full mt-6 bg-gradient-to-r from-purple-600 to-indigo-500 hover:from-purple-700 hover:to-indigo-600"
              >
                <Calculator className="w-4 h-4 mr-2" />
                Calculate DCF Value
              </Button>
            </div>
          </div>

          {/* Results Section */}
          <div className="xl:col-span-2">
            {results ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* Valuation Summary */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Valuation Summary</h3>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                      <div className="text-sm text-green-600 font-medium">Enterprise Value</div>
                      <div className="text-xl font-bold text-green-900">
                        {formatMillions(results.enterpriseValue)}
                      </div>
                    </div>
                    <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-200">
                      <div className="text-sm text-blue-600 font-medium">PV of FCF</div>
                      <div className="text-xl font-bold text-blue-900">
                        {formatMillions(results.pvOfProjections)}
                      </div>
                    </div>
                    <div className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-200">
                      <div className="text-sm text-purple-600 font-medium">PV Terminal Value</div>
                      <div className="text-xl font-bold text-purple-900">
                        {formatMillions(results.pvTerminalValue)}
                      </div>
                    </div>
                    <div className="p-4 bg-gradient-to-r from-orange-50 to-red-50 rounded-lg border border-orange-200">
                      <div className="text-sm text-orange-600 font-medium">Terminal Value %</div>
                      <div className="text-xl font-bold text-orange-900">
                        {results.terminalValuePercent.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* FCF Chart */}
                <div>
                  <h4 className="text-md font-semibold text-gray-900 mb-3">Free Cash Flow Projection</h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={results.projections}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="year" />
                        <YAxis tickFormatter={(value) => formatMillions(value)} />
                        <Tooltip formatter={(value) => [formatCurrency(value), "Free Cash Flow"]} />
                        <Line type="monotone" dataKey="fcf" stroke="#8b5cf6" strokeWidth={3} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Projections Table */}
                <div>
                  <h4 className="text-md font-semibold text-gray-900 mb-3">Detailed Projections</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left p-2 font-semibold">Year</th>
                          <th className="text-right p-2 font-semibold">Revenue</th>
                          <th className="text-right p-2 font-semibold">Growth</th>
                          <th className="text-right p-2 font-semibold">EBITDA</th>
                          <th className="text-right p-2 font-semibold">FCF</th>
                          <th className="text-right p-2 font-semibold">Present Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.projections.map((projection, index) => (
                          <tr key={index} className="border-b border-gray-100">
                            <td className="p-2">{projection.year}</td>
                            <td className="p-2 text-right">{formatMillions(projection.revenue)}</td>
                            <td className="p-2 text-right">{projection.growthRate.toFixed(1)}%</td>
                            <td className="p-2 text-right">{formatMillions(projection.ebitda)}</td>
                            <td className="p-2 text-right">{formatMillions(projection.fcf)}</td>
                            <td className="p-2 text-right">{formatMillions(projection.presentValue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Sensitivity Analysis Warning */}
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-600 mt-1" />
                    <div>
                      <h4 className="font-semibold text-yellow-900">Sensitivity Analysis</h4>
                      <p className="text-sm text-yellow-800 mt-1">
                        Small changes in WACC and terminal growth rate can significantly impact valuation. 
                        The terminal value represents {results.terminalValuePercent.toFixed(1)}% of total enterprise value.
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="h-full flex items-center justify-center text-center">
                <div>
                  <PieChart className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">Build Your DCF Model</h3>
                  <p className="text-gray-500">
                    Enter your assumptions and click "Calculate DCF Value" to see your valuation results.
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