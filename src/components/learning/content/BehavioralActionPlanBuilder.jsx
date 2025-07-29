import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Target, Shield, Download } from "lucide-react";
import { motion } from "framer-motion";

export default function BehavioralActionPlanBuilder({ title, description }) {
  const [actionPlan, setActionPlan] = useState({
    triggers: [],
    responses: {},
    goals: '',
    timeHorizon: '',
    riskTolerance: '',
    allocation: {},
    rules: []
  });

  const [currentStep, setCurrentStep] = useState(1);

  const commonTriggers = [
    "Market drops more than 10%",
    "Market drops more than 20%", 
    "Friends/social media discussing hot investments",
    "Major negative news headlines",
    "Portfolio underperforming for 3+ months",
    "Unexpected windfall (bonus, inheritance, etc.)",
    "Economic recession warnings",
    "Individual stock recommendations"
  ];

  const handleTriggerAdd = (trigger) => {
    if (!actionPlan.triggers.includes(trigger)) {
      setActionPlan(prev => ({
        ...prev,
        triggers: [...prev.triggers, trigger]
      }));
    }
  };

  const handleResponseAdd = (trigger, response) => {
    setActionPlan(prev => ({
      ...prev,
      responses: {
        ...prev.responses,
        [trigger]: response
      }
    }));
  };

  const generateActionPlan = () => {
    const plan = `
# MY BEHAVIORAL ACTION PLAN

**Created:** ${new Date().toLocaleDateString()}

## Investment Goals & Timeline
**Primary Goal:** ${actionPlan.goals}
**Time Horizon:** ${actionPlan.timeHorizon}  
**Risk Tolerance:** ${actionPlan.riskTolerance}

## My Behavioral Triggers & Responses

${actionPlan.triggers.map(trigger => `
**Trigger:** ${trigger}
**My Response:** ${actionPlan.responses[trigger] || 'Response not set'}
`).join('\n')}

## My Investment Rules
${actionPlan.rules.map(rule => `• ${rule}`).join('\n')}

## Emergency Contacts
- Financial Advisor: [Your advisor's contact]  
- Accountability Partner: [Trusted friend/family member]

**I commit to following this plan regardless of market conditions or emotions.**

**Signature:** _________________________ **Date:** _________
    `;
    
    return plan;
  };

  return (
    <Card className="glassmorphism border-0 shadow-lg mb-8">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-t-2xl">
        <CardTitle className="flex items-center gap-3 text-xl">
          <Shield className="w-6 h-6 text-blue-600" />
          {title}
        </CardTitle>
        {description && (
          <p className="text-gray-600 text-sm mt-2">{description}</p>
        )}
      </CardHeader>
      <CardContent className="p-8">
        {currentStep === 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Step 1: Identify Your Behavioral Triggers
              </h3>
              <p className="text-gray-600 mb-4">
                Select the situations that typically cause you to make emotional financial decisions:
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {commonTriggers.map((trigger, index) => (
                  <button
                    key={index}
                    onClick={() => handleTriggerAdd(trigger)}
                    className={`p-3 text-left border rounded-lg transition-all ${
                      actionPlan.triggers.includes(trigger)
                        ? 'border-blue-500 bg-blue-50 text-blue-900'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm">{trigger}</span>
                      {actionPlan.triggers.includes(trigger) && (
                        <Badge className="bg-blue-600 text-white text-xs">Selected</Badge>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="text-center">
              <Button
                onClick={() => setCurrentStep(2)}
                disabled={actionPlan.triggers.length === 0}
                className="bg-gradient-to-r from-blue-600 to-purple-500 hover:from-blue-700 hover:to-purple-600"
              >
                Next: Create Responses ({actionPlan.triggers.length} triggers selected)
              </Button>
            </div>
          </motion.div>
        )}

        {currentStep === 2 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Step 2: Create Your Response Scripts  
              </h3>
              <p className="text-gray-600 mb-6">
                For each trigger you selected, write out exactly what you'll do:
              </p>

              <div className="space-y-6">
                {actionPlan.triggers.map((trigger, index) => (
                  <div key={index} className="p-4 border border-gray-200 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-3">
                      <strong>Trigger:</strong> {trigger}
                    </h4>
                    <Textarea
                      placeholder="When this happens, I will... (be specific about the actions you'll take)"
                      value={actionPlan.responses[trigger] || ''}
                      onChange={(e) => handleResponseAdd(trigger, e.target.value)}
                      className="h-24"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => setCurrentStep(1)}
              >
                Back
              </Button>
              <Button
                onClick={() => setCurrentStep(3)}
                className="bg-gradient-to-r from-blue-600 to-purple-500 hover:from-blue-700 hover:to-purple-600"
              >
                Next: Set Investment Rules
              </Button>
            </div>
          </motion.div>
        )}

        {currentStep === 3 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Step 3: Set Your Investment Rules & Goals
              </h3>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Primary Investment Goal
                  </label>
                  <Input
                    placeholder="e.g., Retire comfortably by age 65"
                    value={actionPlan.goals}
                    onChange={(e) => setActionPlan(prev => ({ ...prev, goals: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Time Horizon
                  </label>
                  <Select
                    value={actionPlan.timeHorizon}
                    onValueChange={(value) => setActionPlan(prev => ({ ...prev, timeHorizon: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select time horizon" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="short">Short-term (1-3 years)</SelectItem>
                      <SelectItem value="medium">Medium-term (3-10 years)</SelectItem>
                      <SelectItem value="long">Long-term (10+ years)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Risk Tolerance  
                  </label>
                  <Select
                    value={actionPlan.riskTolerance}
                    onValueChange={(value) => setActionPlan(prev => ({ ...prev, riskTolerance: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select risk tolerance" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="conservative">Conservative</SelectItem>
                      <SelectItem value="moderate">Moderate</SelectItem>
                      <SelectItem value="aggressive">Aggressive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  My Investment Rules (What I Will NOT Do)
                </label>
                <Textarea
                  placeholder="e.g., I will not sell during market downturns based on emotions&#10;I will not try to time the market&#10;I will not check my portfolio more than once per month"
                  value={actionPlan.rules.join('\n')}
                  onChange={(e) => setActionPlan(prev => ({ 
                    ...prev, 
                    rules: e.target.value.split('\n').filter(rule => rule.trim()) 
                  }))}
                  className="h-32"
                />
              </div>
            </div>

            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => setCurrentStep(2)}
              >
                Back
              </Button>
              <Button
                onClick={() => setCurrentStep(4)}
                className="bg-gradient-to-r from-blue-600 to-purple-500 hover:from-blue-700 hover:to-purple-600"
              >
                Generate My Action Plan
              </Button>
            </div>
          </motion.div>
        )}

        {currentStep === 4 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Your Behavioral Action Plan is Ready!
              </h3>
              <div className="bg-gray-50 p-6 rounded-lg border">
                <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono">
                  {generateActionPlan()}
                </pre>
              </div>
            </div>

            <div className="text-center space-y-4">
              <Button
                onClick={() => {
                  const element = document.createElement('a');
                  const file = new Blob([generateActionPlan()], { type: 'text/plain' });
                  element.href = URL.createObjectURL(file);
                  element.download = 'My_Behavioral_Action_Plan.txt';
                  document.body.appendChild(element);
                  element.click();
                  document.body.removeChild(element);
                }}
                className="bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-700 hover:to-green-600 gap-2"
              >
                <Download className="w-4 h-4" />
                Download My Action Plan
              </Button>
              
              <div className="text-sm text-gray-600">
                Print this out and keep it handy for when emotions run high!
              </div>
            </div>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}