import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, Zap, PieChart } from 'lucide-react';

const lessons = [
  { title: "Investing 101", icon: PieChart, color: "text-purple-600" },
  { title: "FIRE Basics", icon: Zap, color: "text-orange-600" },
  { title: "Budget Hacks", icon: BookOpen, color: "text-blue-600" },
  { title: "Credit Score Magic", icon: BookOpen, color: "text-green-600" },
];

export default function GetRichCurriculum() {
  return (
    <Card className="glassmorphism border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-blue-600" />
          Water with Knowledge
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-600 mb-4">
          Unlock these lessons as you complete tasks and grow your garden.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {lessons.map((lesson, index) => (
            <div key={index} className="flex flex-col items-center p-4 bg-white/50 rounded-xl border text-center">
              <lesson.icon className={`w-8 h-8 mb-2 ${lesson.color}`} />
              <p className="text-sm font-semibold text-gray-800">{lesson.title}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}