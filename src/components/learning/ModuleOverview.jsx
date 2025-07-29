import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, Target, Clock, Brain, Play } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ModuleOverview({ module, onStart }) {
  // Add safety checks for undefined properties
  if (!module) {
    return <div>Loading...</div>;
  }

  const learningOutcomes = module.learningOutcomes || [];
  const lessons = module.lessons || [];
  const heroTitle = module.heroTitle || module.title || 'Learning Module';
  const heroSubtitle = module.heroSubtitle || module.description || '';

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="glassmorphism border-0 shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-purple-600 to-indigo-500 p-8 text-white">
            <h1 className="text-3xl lg:text-4xl font-bold mb-2">{heroTitle}</h1>
            <p className="text-lg text-indigo-100">{heroSubtitle}</p>
          </div>
          <CardContent className="p-8">
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="font-bold text-xl mb-4 text-gray-900">What You'll Learn</h3>
                <ul className="space-y-3">
                  {learningOutcomes.map((outcome, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <Target className="w-5 h-5 text-emerald-600 mt-1 flex-shrink-0" />
                      <span className="text-gray-700">{outcome}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-gradient-to-r from-gray-50 to-blue-50 p-6 rounded-xl border border-gray-200">
                <h3 className="font-bold text-xl mb-4 text-gray-900">Module Structure</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <BookOpen className="w-5 h-5 text-blue-600" />
                    <p className="font-semibold text-gray-800">{lessons.length} Lessons</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-blue-600" />
                    <p className="font-semibold text-gray-800">Estimated time: {module.duration || 'N/A'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Brain className="w-5 h-5 text-blue-600" />
                    <p className="font-semibold text-gray-800">Difficulty: {module.difficulty || 'N/A'}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="text-center mt-12">
              <Button onClick={onStart} size="lg" className="bg-gradient-to-r from-purple-600 to-indigo-500 hover:from-purple-700 hover:to-indigo-600 text-lg gap-3 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                <Play className="w-5 h-5" />
                Personalize My Course
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}