import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, DollarSign, AlertTriangle } from 'lucide-react';

export default function RealityCheck({ summary }) {
  const stats = [
    { label: 'Current Net Worth', value: summary.netWorth, icon: DollarSign, color: 'text-emerald-600' },
    { label: 'Investment Balance', value: summary.investmentBalance, icon: TrendingUp, color: 'text-purple-600' },
    { label: 'Monthly Surplus', value: summary.monthlySurplus, icon: DollarSign, color: 'text-blue-600' },
    { label: 'Debt Level', value: summary.debtLevel, icon: TrendingDown, color: 'text-red-600' },
  ];

  return (
    <Card className="glassmorphism border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-orange-500" />
          Reality Check
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {stats.map(stat => (
            <div key={stat.label} className="bg-white/50 p-4 rounded-xl border">
              <stat.icon className={`w-6 h-6 mb-2 ${stat.color}`} />
              <p className="text-sm text-gray-500">{stat.label}</p>
              <p className="text-lg font-bold text-gray-900">${stat.value.toLocaleString()}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-4">
          This is your current financial soil. Use this as your starting point to grow your garden.
        </p>
      </CardContent>
    </Card>
  );
}