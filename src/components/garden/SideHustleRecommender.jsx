import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, Lightbulb } from 'lucide-react';

const hustles = [
  { title: "Freelance on Upwork", description: "Offer your skills in writing, design, or coding.", icon: "✍️" },
  { title: "Campus Tutoring", description: "Help fellow students in subjects you excel at.", icon: "🎓" },
  { title: "Start a Niche TikTok", description: "Build an audience around a passion and monetize.", icon: "📱" },
  { title: "DoorDash or Uber Eats", description: "Flexible hours delivering food in your area.", icon: "🚗" },
  { title: "Sell Crafts on Etsy", description: "Turn your hobby into a business.", icon: "🎨" },
];

export default function SideHustleRecommender() {
  return (
    <Card className="glassmorphism border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="w-6 h-6 text-yellow-500" />
          Ways to Tend Your Garden
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {hustles.map((hustle, index) => (
            <div key={index} className="flex items-center gap-4 p-3 bg-white/50 rounded-xl border">
              <div className="text-2xl">{hustle.icon}</div>
              <div className="flex-1">
                <p className="font-semibold text-gray-800">{hustle.title}</p>
                <p className="text-sm text-gray-600">{hustle.description}</p>
              </div>
              <Button variant="ghost" size="icon">
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}