import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calculator, TrendingUp, AlertCircle, CheckCircle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";

export default function BasicModelBuilder({ title, description }) {
  const [inputs, setInputs] = useState({
    initialRevenue: 1000000,
    growthRate: 0.08,
    grossMargin: 0.60,
    opexGrowth: 0.05,
    initialOpex: 400000,
    taxRate: 0.25,
    years: 5
  });

  const [results, setResults] = useState(null);
  const [errors, setErrors] = useState({});

  const validateInputs = () => {
    const newErrors = {};
    
    if (inputs.initialRevenue <= 0) newErrors.initialRevenue = "Revenue must be positive";
    if (inputs.growthRate < -0.5 || inputs.growthRate > 2) newErrors.growthRate = "Growth rate should be between -50% and 200%";
    if (inputs.grossMargin < 0 || inputs.grossMargin > 1) newErrors.grossMargin = "Gross margin should be between 0% and 100%";
    if (inputs.taxRate < 0 || inputs.taxRate > 0.6) newErrors.taxRate = "Tax rate should be between 0% and 60%";
    if (inputs.years < 1 || inputs.years > 20) newErrors.years = "Years should be between 1 and 20";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const calculateProjections = () => {
    if (!validateInputs()) return;

    const projections = [];
    let revenue = inputs.initialRevenue;
    let opex = inputs.initialOpex;

    for (let year = 1; year <= inputs.years; year++) {
      revenue *= (1 + inputs.growthRate);
      opex *= (1 + inputs.opexGrowth);
      
      const grossProfit = revenue * inputs.grossMargin;
      const ebit = grossProfit - opex;
      const taxes = Math.max(0, ebit * inputs.taxRate);
      const netIncome = ebit - taxes;
      const netMargin = revenue > 0 ? netIncome / revenue : 0;

      projections.push({
        year,
        revenue: Math.round(revenue),
        grossProfit: Math.round(grossProfit),
        opex: Math.round(opex),
        ebit: Math.round(ebit),
        netIncome: Math.round(netIncome),
        netMargin: netMargin * 100,
        revenueGrowth: inputs.growthRate * 100
      });
    }

    // Calculate metrics
    const finalRevenue = projections[projections.length - 1].revenue;
    const cagr = Math.pow(finalRevenue / inputs.initialRevenue, 1 / inputs.years) - 1;
    const avgNetMargin = projections.reduce((sum, p) => sum + p.netMargin, 0) / projections.length;
    const totalNetIncome = projections.reduce((sum, p) => sum + p.netIncome, 0);

    setResults({
      projections,
      metrics: {
        cagr: cagr * 100,
        avgNetMargin,
        totalNetIncome,
        finalRevenue
      }
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

  return (
    <Card className="glassmorphism border-0 shadow-lg mb-8">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-2xl">
        <CardTitle className="flex items-center gap-3 text-xl">
          <Calculator className="w-6 h-6 text-blue-600" />
          {title || "Interactive Financial Model Builder"}
        </CardTitle>
        {description && (
          <p className="text-gray-600 text-sm mt-2">{description}</p>
        )}
      </CardHeader>
      <CardContent className="p-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Input Section */}
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Model Assumptions</h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="initialRevenue">Initial Revenue ($)</Label>
                  <Input
                    id="initialRevenue"
                    type="number"
                    value={inputs.initialRevenue}
                    onChange={(e) => setInputs(prev => ({ ...prev, initialRevenue: parseFloat(e.target.value) || 0 }))}
                    className={errors.initialRevenue ? "border-red-500" : ""}
                  />
                  {errors.initialRevenue && (
                    <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errors.initialRevenue}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="growthRate">Annual Revenue Growth Rate (%)</Label>
                  <Input
                    id="growthRate"
                    type="number"
                    step="0.01"
                    value={inputs.growthRate * 100}
                    onChange={(e) => setInputs(prev => ({ ...prev, growthRate: (parseFloat(e.target.value) || 0) / 100 }))}
                    className={errors.growthRate ? "border-red-500" : ""}
                  />
                  {errors.growthRate && (
                    <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errors.growthRate}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="grossMargin">Gross Margin (%)</Label>
                  <Input
                    id="grossMargin"
                    type="number"
                    step="0.01"
                    value={inputs.grossMargin * 100}
                    onChange={(e) => setInputs(prev => ({ ...prev, grossMargin: (parseFloat(e.target.value) || 0) / 100 }))}
                    className={errors.grossMargin ? "border-red-500" : ""}
                  />
                  {errors.grossMargin && (
                    <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errors.grossMargin}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="initialOpex">Initial Operating Expenses ($)</Label>
                  <Input
                    id="initialOpex"
                    type="number"
                    value={inputs.initialOpex}
                    onChange={(e) => setInputs(prev => ({ ...prev, initialOpex: parseFloat(e.target.value) || 0 }))}
                  />
                </div>

                <div>
                  <Label htmlFor="opexGrowth">OpEx Growth Rate (%)</Label>
                  <Input
                    id="opexGrowth"
                    type="number"
                    step="0.01"
                    value={inputs.opexGrowth * 100}
                    onChange={(e) => setInputs(prev => ({ ...prev, opexGrowth: (parseFloat(e.target.value) || 0) / 100 }))}
                  />
                </div>

                <div>
                  <Label htmlFor="taxRate">Tax Rate (%)</Label>
                  <Input
                    id="taxRate"
                    type="number"
                    step="0.01"
                    value={inputs.taxRate * 100}
                    onChange={(e) => setInputs(prev => ({ ...prev, taxRate: (parseFloat(e.target.value) || 0) / 100 }))}
                    className={errors.taxRate ? "border-red-500" : ""}
                  />
                  {errors.taxRate && (
                    <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errors.taxRate}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="years">Forecast Years</Label>
                  <Input
                    id="years"
                    type="number"
                    min="1"
                    max="20"
                    value={inputs.years}
                    onChange={(e) => setInputs(prev => ({ ...prev, years: parseInt(e.target.value) || 5 }))}
                    className={errors.years ? "border-red-500" : ""}
                  />
                  {errors.years && (
                    <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errors.years}
                    </p>
                  )}
                </div>
              </div>

              <Button
                onClick={calculateProjections}
                className="w-full mt-6 bg-gradient-to-r from-blue-600 to-indigo-500 hover:from-blue-700 hover:to-indigo-600"
              >
                <Calculator className="w-4 h-4 mr-2" />
                Calculate Projections
              </Button>
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
                {/* Key Metrics */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    Key Metrics
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <div className="text-sm text-green-600 font-medium">Revenue CAGR</div>
                      <div className="text-2xl font-bold text-green-900">
                        {results.metrics.cagr.toFixed(1)}%
                      </div>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="text-sm text-blue-600 font-medium">Avg Net Margin</div>
                      <div className="text-2xl font-bold text-blue-900">
                        {results.metrics.avgNetMargin.toFixed(1)}%
                      </div>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                      <div className="text-sm text-purple-600 font-medium">Total Net Income</div>
                      <div className="text-xl font-bold text-purple-900">
                        {formatCurrency(results.metrics.totalNetIncome)}
                      </div>
                    </div>
                    <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                      <div className="text-sm text-orange-600 font-medium">Final Revenue</div>
                      <div className="text-xl font-bold text-orange-900">
                        {formatCurrency(results.metrics.finalRevenue)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Revenue Chart */}
                <div>
                  <h4 className="text-md font-semibold text-gray-900 mb-3">Revenue Projection</h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={results.projections}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="year" />
                        <YAxis tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`} />
                        <Tooltip formatter={(value) => [formatCurrency(value), "Revenue"]} />
                        <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Detailed Projections Table */}
                <div>
                  <h4 className="text-md font-semibold text-gray-900 mb-3">Detailed Projections</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left p-2 font-semibold">Year</th>
                          <th className="text-right p-2 font-semibold">Revenue</th>
                          <th className="text-right p-2 font-semibold">Gross Profit</th>
                          <th className="text-right p-2 font-semibold">EBIT</th>
                          <th className="text-right p-2 font-semibold">Net Income</th>
                          <th className="text-right p-2 font-semibold">Net Margin</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.projections.map((projection, index) => (
                          <tr key={index} className="border-b border-gray-100">
                            <td className="p-2">{projection.year}</td>
                            <td className="p-2 text-right">{formatCurrency(projection.revenue)}</td>
                            <td className="p-2 text-right">{formatCurrency(projection.grossProfit)}</td>
                            <td className="p-2 text-right">{formatCurrency(projection.ebit)}</td>
                            <td className="p-2 text-right">{formatCurrency(projection.netIncome)}</td>
                            <td className="p-2 text-right">{projection.netMargin.toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="h-full flex items-center justify-center text-center">
                <div>
                  <TrendingUp className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">Build Your Model</h3>
                  <p className="text-gray-500">
                    Enter your assumptions on the left and click "Calculate Projections" to see your financial model results.
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