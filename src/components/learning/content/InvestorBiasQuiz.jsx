import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Brain } from 'lucide-react';

export default function InvestorBiasQuiz() {
  return (
    <Card className="glassmorphism border-0 shadow-lg mb-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-xl">
          <Brain className="w-6 h-6 text-pink-600" />
          Interactive: Investor Bias Self-Assessment Quiz
        </CardTitle>
      </CardHeader>
      <CardContent className="text-center py-12">
        <p className="text-gray-600">Discover your investment biases with this quiz, coming soon.</p>
      </CardContent>
    </Card>
  );
}