
import React, { useState } from "react";
import { User } from "@/api/entities";
import { InvokeLLM } from "@/api/integrations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, ArrowLeft, Sparkles, MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion, AnimatePresence } from "framer-motion";

export default function Onboarding() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [responses, setResponses] = useState({});
  const [recommendations, setRecommendations] = useState(null);

  const steps = [
    {
      id: "basics",
      title: "Let's start with the basics",
      subtitle: "Tell us about yourself",
      questions: [
        {
          key: "age",
          label: "How old are you?",
          type: "number",
          placeholder: "25"
        },
        {
          key: "occupation",
          label: "What's your current situation?",
          type: "select",
          options: [
            { value: "student", label: "College Student" },
            { value: "recent_grad", label: "Recent Graduate" },
            { value: "working_professional", label: "Working Professional" },
            { value: "intern", label: "Intern" },
            { value: "part_time_worker", label: "Part-time Worker" },
            { value: "unemployed", label: "Currently Unemployed" }
          ]
        }
      ]
    },
    {
      id: "income",
      title: "Your financial snapshot",
      subtitle: "Let's understand your current money situation",
      questions: [
        {
          key: "income_monthly",
          label: "What's your monthly income? (including all sources)",
          type: "number",
          placeholder: "3000",
          prefix: "$"
        },
        {
          key: "debt_total", 
          label: "Total debt (student loans, credit cards, etc.)",
          type: "number",
          placeholder: "15000",
          prefix: "$"
        },
        {
          key: "savings_current",
          label: "Current savings balance",
          type: "number", 
          placeholder: "2500",
          prefix: "$"
        }
      ]
    },
    {
      id: "goals",
      title: "Your financial dreams",
      subtitle: "What are you working toward?",
      questions: [
        {
          key: "financial_goals",
          label: "What are your main financial goals? (Select all that apply)",
          type: "multiselect",
          options: [
            "Build emergency fund",
            "Pay off debt",
            "Save for travel",
            "Buy a car",
            "Start investing",
            "Save for graduate school",
            "Move out on my own",
            "Build wealth for the future"
          ]
        },
        {
          key: "risk_tolerance",
          label: "How do you feel about investment risk?",
          type: "select",
          options: [
            { value: "conservative", label: "Conservative - I prefer stable, low-risk investments" },
            { value: "moderate", label: "Moderate - I'm okay with some risk for better returns" },
            { value: "aggressive", label: "Aggressive - I want maximum growth potential" }
          ]
        }
      ]
    },
    {
      id: "habits",
      title: "Your money habits",
      subtitle: "Help us understand your spending style",
      questions: [
        {
          key: "spending_style",
          label: "How would you describe your spending?",
          type: "select",
          options: [
            { value: "very_careful", label: "Very careful - I track every dollar" },
            { value: "somewhat_careful", label: "Somewhat careful - I watch major expenses" },
            { value: "average", label: "Average - I spend on what I need/want" },
            { value: "free_spender", label: "Free spender - I don't worry much about costs" }
          ]
        },
        {
          key: "biggest_challenge",
          label: "What's your biggest financial challenge?",
          type: "textarea",
          placeholder: "e.g., I spend too much on food delivery, struggle to save consistently, don't know how to invest..."
        }
      ]
    }
  ];

  const handleInputChange = (key, value) => {
    setResponses(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      generateRecommendations();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const generateRecommendations = async () => {
    setIsProcessing(true);
    
    try {
      const prompt = `
        As a financial advisor for Gen Z, analyze this user's profile and provide personalized recommendations:
        
        User Profile:
        - Age: ${responses.age}
        - Occupation: ${responses.occupation}
        - Monthly Income: $${responses.income_monthly}
        - Total Debt: $${responses.debt_total}
        - Current Savings: $${responses.savings_current}
        - Financial Goals: ${responses.financial_goals?.join(', ')}
        - Risk Tolerance: ${responses.risk_tolerance}
        - Spending Style: ${responses.spending_style}
        - Biggest Challenge: ${responses.biggest_challenge}
        
        Provide actionable, specific recommendations for:
        1. Budget allocation suggestions
        2. Debt payoff strategy (if applicable)
        3. Savings goals and timeline
        4. Investment recommendations
        5. Next steps to take this month
        
        Keep the tone encouraging, practical, and Gen Z-friendly.
      `;

      const result = await InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            budget_recommendation: {
              type: "object",
              properties: {
                housing: { type: "number" },
                food: { type: "number" },
                transportation: { type: "number" },
                entertainment: { type: "number" },
                savings: { type: "number" },
                debt_payments: { type: "number" },
                other: { type: "number" }
              }
            },
            key_insights: {
              type: "array",
              items: { type: "string" }
            },
            action_items: {
              type: "array", 
              items: { type: "string" }
            },
            motivational_message: { type: "string" }
          }
        }
      });

      setRecommendations(result);
      
      // Generate referral code
      const referralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      // Save user data
      await User.updateMyUserData({
        ...responses,
        onboarding_completed: true,
        referral_code: referralCode
      });

      // Move to completion step
      setCurrentStep(steps.length);
      
    } catch (error) {
      console.error("Error generating recommendations:", error);
      // Still mark onboarding as complete
      await User.updateMyUserData({
        ...responses,
        onboarding_completed: true,
        referral_code: Math.random().toString(36).substring(2, 8).toUpperCase()
      });
      setRecommendations(null); // Clear recommendations if there was an error
      setCurrentStep(steps.length);
    }
    
    setIsProcessing(false);
  };

  const currentStepData = steps[currentStep];
  const progress = ((currentStep + 1) / (steps.length + 1)) * 100;

  if (currentStep >= steps.length) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="max-w-2xl w-full"
        >
          <Card className="glassmorphism border-0 shadow-2xl">
            <CardHeader className="text-center pb-4">
              <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                <MessageCircle className="w-10 h-10 text-white" />
              </div>
              <CardTitle className="text-2xl font-bold text-gray-900">
                Your AI Advisor is Ready! 🤖
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {recommendations ? (
                <div className="space-y-6">
                  <div className="bg-gradient-to-r from-emerald-50 to-blue-50 p-6 rounded-2xl">
                    <h3 className="font-semibold text-gray-900 mb-3">✨ Here's a quick summary:</h3>
                    <p className="text-gray-700">{recommendations.motivational_message}</p>
                  </div>

                  {recommendations.action_items && (
                    <div className="space-y-3">
                      <h4 className="font-semibold text-gray-900">Your First Action Items</h4>
                      {recommendations.action_items.slice(0, 3).map((action, index) => (
                        <div key={index} className="flex items-start gap-3 p-3 bg-blue-50 rounded-xl">
                          <Badge className="bg-blue-600 text-white mt-0.5">{index + 1}</Badge>
                          <p className="text-gray-700 text-sm">{action}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-center text-gray-600">You're all set! Let's start talking about your finances.</p>
              )}

              <Button 
                onClick={() => navigate(createPageUrl("AIAdvisor"))}
                className="w-full h-12 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-lg gap-2 text-lg"
              >
                Start Chatting with Your Advisor
                <ArrowRight className="w-5 h-5" />
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-2xl w-full space-y-6">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Step {currentStep + 1} of {steps.length}</span>
            <span>{Math.round(progress)}% complete</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="glassmorphism border-0 shadow-2xl">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <MessageCircle className="w-6 h-6 text-emerald-600" />
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                    {currentStepData.id}
                  </Badge>
                </div>
                <CardTitle className="text-2xl font-bold text-gray-900">
                  {currentStepData.title}
                </CardTitle>
                <p className="text-gray-600">{currentStepData.subtitle}</p>
              </CardHeader>
              <CardContent className="space-y-6">
                {currentStepData.questions.map((question) => (
                  <div key={question.key} className="space-y-3">
                    <Label className="text-base font-medium text-gray-900">
                      {question.label}
                    </Label>
                    
                    {question.type === "number" && (
                      <div className="relative">
                        {question.prefix && (
                          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                            {question.prefix}
                          </span>
                        )}
                        <Input
                          type="number"
                          placeholder={question.placeholder}
                          value={responses[question.key] || ""}
                          onChange={(e) => handleInputChange(question.key, parseInt(e.target.value) || 0)}
                          className={`h-12 ${question.prefix ? 'pl-8' : ''}`}
                        />
                      </div>
                    )}

                    {question.type === "select" && (
                      <Select
                        value={responses[question.key] || ""}
                        onValueChange={(value) => handleInputChange(question.key, value)}
                      >
                        <SelectTrigger className="h-12">
                          <SelectValue placeholder="Select an option..." />
                        </SelectTrigger>
                        <SelectContent>
                          {question.options.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    {question.type === "multiselect" && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {question.options.map((option) => (
                          <div
                            key={option}
                            onClick={() => {
                              const current = responses[question.key] || [];
                              const updated = current.includes(option)
                                ? current.filter(item => item !== option)
                                : [...current, option];
                              handleInputChange(question.key, updated);
                            }}
                            className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                              (responses[question.key] || []).includes(option)
                                ? 'border-emerald-500 bg-emerald-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <p className="text-sm font-medium text-gray-900">{option}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {question.type === "textarea" && (
                      <Textarea
                        placeholder={question.placeholder}
                        value={responses[question.key] || ""}
                        onChange={(e) => handleInputChange(question.key, e.target.value)}
                        rows={4}
                        className="resize-none"
                      />
                    )}
                  </div>
                ))}

                <div className="flex justify-between pt-6">
                  <Button
                    variant="outline"
                    onClick={prevStep}
                    disabled={currentStep === 0}
                    className="gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Previous
                  </Button>
                  <Button
                    onClick={nextStep}
                    disabled={isProcessing}
                    className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 gap-2"
                  >
                    {isProcessing ? (
                      "Creating your plan..."
                    ) : currentStep === steps.length - 1 ? (
                      <>
                        Generate My Plan
                        <Sparkles className="w-4 h-4" />
                      </>
                    ) : (
                      <>
                        Next
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
