import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Beaker } from 'lucide-react';

export default function PortfolioOptimizer() {
  return (
    <Card className="glassmorphism border-0 shadow-lg mb-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-xl">
          <Beaker className="w-6 h-6 text-indigo-600" />
          Interactive: Portfolio Optimizer & Efficiency Analyzer
        </CardTitle>
      </CardHeader>
      <CardContent className="text-center py-12">
        <p className="text-gray-600">Advanced portfolio optimization tool coming soon.</p>
      </CardContent>
    </Card>
  );
}