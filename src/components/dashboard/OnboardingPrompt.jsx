import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";

export default function OnboardingPrompt() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="max-w-lg w-full"
      >
        <Card className="glassmorphism border-0 shadow-2xl">
          <CardHeader className="text-center pb-2">
            <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg">
              <Sparkles className="w-10 h-10 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-emerald-700 to-emerald-500 bg-clip-text text-transparent">
              Welcome to Fundsy!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-0">
            <div className="text-center space-y-4">
              <p className="text-gray-600 text-lg">
                Ready to take control of your financial future? 💪
              </p>
              <p className="text-sm text-gray-500">
                Let's start with a quick conversation to understand your goals and create a personalized financial plan.
              </p>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                <span>5-minute personalized assessment</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                <span>Custom budget and investment recommendations</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                <span>Track your progress toward financial freedom</span>
              </div>
            </div>

            <Link to={createPageUrl("Onboarding")} className="block">
              <Button className="w-full h-12 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-lg gap-2 text-lg">
                Start My Financial Journey
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>

            <p className="text-xs text-center text-gray-400">
              Your data is secure and never shared with third parties
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}