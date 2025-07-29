import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart2 } from 'lucide-react';

export default function MarketSimulator() {
  return (
    <Card className="glassmorphism border-0 shadow-lg mb-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-xl">
          <BarChart2 className="w-6 h-6 text-emerald-600" />
          Interactive: Market Simulator
        </CardTitle>
      </CardHeader>
      <CardContent className="text-center py-12">
        <p className="text-gray-600">Test your emotional discipline in a simulated market, coming soon.</p>
      </CardContent>
    </Card>
  );
}