import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Award, Repeat, Share2, Download } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ModuleCompletionPage({ module, onRestart, onBackToModules }) {
  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto flex items-center justify-center min-h-[80vh]">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, type: 'spring' }}
        className="w-full"
      >
        <Card className="glassmorphism border-0 shadow-2xl text-center">
          <CardHeader className="pb-4">
            <div className="w-24 h-24 bg-gradient-to-br from-emerald-500 to-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
              <Award className="w-12 h-12 text-white" />
            </div>
            <CardTitle className="text-2xl lg:text-3xl font-bold text-gray-900">
              Congratulations!
            </CardTitle>
            <p className="text-gray-600 text-lg">You've completed the "{module.title}" module.</p>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="bg-gradient-to-r from-gray-50 to-blue-50 p-6 rounded-xl border border-gray-200 text-left">
              <h4 className="font-semibold text-gray-900 mb-3">Key Takeaways:</h4>
              <ul className="space-y-2">
                {module.learningOutcomes.map((outcome, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full mt-2 flex-shrink-0"></div>
                    <span className="text-gray-700 text-sm">{outcome}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Button onClick={onRestart} variant="outline" className="gap-2">
                <Repeat className="w-4 h-4" />
                Review Module
              </Button>
              <Button onClick={() => alert('Feature coming soon!')} variant="outline" className="gap-2">
                <Share2 className="w-4 h-4" />
                Share Achievement
              </Button>
            </div>
            <Button onClick={onBackToModules} className="w-full bg-gradient-to-r from-purple-600 to-indigo-500 hover:from-purple-700 hover:to-indigo-600 gap-2">
              Back to Learning Center
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}