import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Target } from 'lucide-react';

export default function ProgressTracker({ goal, currentNetWorth }) {
  const progress = Math.min((currentNetWorth / goal.amount) * 100, 100);

  return (
    <Card className="glassmorphism border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="w-6 h-6 text-amber-600" />
          Garden Progress
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between items-baseline">
            <p className="text-gray-600">Current Net Worth:</p>
            <p className="text-2xl font-bold text-emerald-600">${currentNetWorth.toLocaleString()}</p>
          </div>
          <div className="flex justify-between items-baseline">
            <p className="text-gray-600">Goal:</p>
            <p className="text-lg font-semibold text-gray-800">${goal.amount.toLocaleString()}</p>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <Progress value={progress} className="h-3 [&>div]:bg-gradient-to-r [&>div]:from-green-400 [&>div]:to-emerald-500" />
          <p className="text-center text-gray-600 text-sm">
            You are <span className="font-bold text-green-700">{Math.round(progress)}%</span> of the way to your <span className="font-bold text-gray-800">${goal.amount.toLocaleString()}</span> goal. Keep watering your seeds! 🌱
          </p>
        </div>
      </CardContent>
    </Card>
  );
}