import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText } from 'lucide-react';

export default function BehavioralActionPlan() {
  return (
    <Card className="glassmorphism border-0 shadow-lg mb-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-xl">
          <FileText className="w-6 h-6 text-blue-600" />
          Interactive: Behavioral Action Plan Generator
        </CardTitle>
      </CardHeader>
      <CardContent className="text-center py-12">
        <p className="text-gray-600">Generate your personalized action plan, coming soon.</p>
      </CardContent>
    </Card>
  );
}