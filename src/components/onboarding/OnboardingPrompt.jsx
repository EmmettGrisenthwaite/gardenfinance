import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";

export default function OnboardingPrompt() {
  return (
    <motion.div
      className="w-full"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="w-full max-w-lg mx-auto bg-gradient-to-br from-slate-50 to-white shadow-lg border-slate-200/60">
        <CardHeader className="items-center text-center">
          <div className="p-3 bg-emerald-100 rounded-full mb-3">
            <Sparkles className="w-8 h-8 text-emerald-600" />
          </div>
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-emerald-700 to-emerald-500 bg-clip-text text-transparent">
            Welcome to Garden!
          </CardTitle>
          <p className="text-slate-500 pt-1">Let's set up your financial profile to get started.</p>
        </CardHeader>
        <CardContent className="space-y-6 pt-0">
          <div className="text-center text-slate-600">
            <p>Ready to take control of your money?</p>
            <p>It only takes a few minutes.</p>
          </div>
          <Link to={createPageUrl("Onboarding?step=1")}>
            <Button size="lg" className="w-full bg-gradient-to-r from-emerald-600 to-blue-500 hover:from-emerald-700 hover:to-blue-600 shadow-md text-white font-bold">
              Let's Go!
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    </motion.div>
  );
}