import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Brain, Target, Clock, BookOpen } from "lucide-react";
import { motion } from "framer-motion";

export default function CoursePreAssessment({ module, onComplete, onBack }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [responses, setResponses] = useState({});

  const assessmentSteps = [
    {
      id: "experience",
      title: "What's your current experience level?",
      subtitle: "Help us tailor the content depth for you",
      type: "single_choice",
      options: [
        {
          value: "beginner",
          title: "Complete Beginner",
          description: "I'm new to this topic and want to start from the fundamentals",
          icon: "🌱"
        },
        {
          value: "some_knowledge", 
          title: "Some Knowledge",
          description: "I have basic understanding but want to go deeper",
          icon: "📚"
        },
        {
          value: "intermediate",
          title: "Intermediate",
          description: "I'm familiar with concepts and ready for advanced material",
          icon: "🎯"
        },
        {
          value: "advanced",
          title: "Advanced",
          description: "I want the most sophisticated, expert-level content",
          icon: "🧠"
        }
      ]
    },
    {
      id: "depth_preference",
      title: "How deep do you want to go?",
      subtitle: "Choose your learning intensity",
      type: "single_choice", 
      options: [
        {
          value: "overview",
          title: "High-Level Overview",
          description: "Key concepts and practical applications (20-30 min)",
          icon: "⚡"
        },
        {
          value: "comprehensive",
          title: "Comprehensive Deep Dive", 
          description: "Detailed theory, examples, and advanced applications (45-90 min)",
          icon: "🔬"
        },
        {
          value: "expert",
          title: "Expert Mastery Track",
          description: "Research-level depth with mathematical foundations (2+ hours)",
          icon: "🎓"
        }
      ]
    },
    {
      id: "learning_style",
      title: "How do you learn best?",
      subtitle: "We'll customize the content format",
      type: "multiple_choice",
      options: [
        {
          value: "theoretical",
          title: "Theory & Research",
          description: "Academic papers, studies, mathematical models",
          icon: "📊"
        },
        {
          value: "practical",
          title: "Hands-On Practice",
          description: "Interactive exercises, calculators, real scenarios",
          icon: "🛠️"
        },
        {
          value: "case_studies",
          title: "Case Studies",
          description: "Real-world examples and detailed analysis",
          icon: "📋"
        },
        {
          value: "visual",
          title: "Visual Learning", 
          description: "Charts, graphs, infographics, animations",
          icon: "📈"
        }
      ]
    },
    {
      id: "goals",
      title: "What's your primary goal?",
      subtitle: "This helps us focus on what matters most to you",
      type: "single_choice",
      options: [
        {
          value: "personal_application",
          title: "Personal Application",
          description: "I want to apply this to my own financial situation",
          icon: "🎯"
        },
        {
          value: "career_development",
          title: "Career Development",
          description: "This knowledge will help advance my professional goals",
          icon: "💼"
        },
        {
          value: "intellectual_curiosity",
          title: "Intellectual Curiosity",
          description: "I'm fascinated by the topic and want deep understanding",
          icon: "🧠"
        },
        {
          value: "teaching_others",
          title: "Teaching Others",
          description: "I want to be able to explain these concepts to others",
          icon: "👥"
        }
      ]
    }
  ];

  const currentStepData = assessmentSteps[currentStep];
  const isLastStep = currentStep === assessmentSteps.length - 1;

  const handleResponse = (stepId, value) => {
    if (currentStepData.type === "multiple_choice") {
      const currentValues = responses[stepId] || [];
      const newValues = currentValues.includes(value)
        ? currentValues.filter(v => v !== value)
        : [...currentValues, value];
      setResponses(prev => ({ ...prev, [stepId]: newValues }));
    } else {
      setResponses(prev => ({ ...prev, [stepId]: value }));
    }
  };

  const canProceed = () => {
    const response = responses[currentStepData.id];
    return response && (Array.isArray(response) ? response.length > 0 : true);
  };

  const nextStep = () => {
    if (isLastStep) {
      onComplete(responses);
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const getEstimatedDuration = () => {
    const depth = responses.depth_preference;
    const experience = responses.experience;
    
    if (depth === "expert" || experience === "advanced") return "2-4 hours";
    if (depth === "comprehensive") return "45-90 minutes";
    return "20-30 minutes";
  };

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={onBack}
          className="rounded-xl"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Brain className="w-6 h-6 text-purple-600" />
            Course Customization
          </h1>
          <p className="text-gray-600">
            {module.title}
          </p>
        </div>
      </div>

      {/* Progress Indicator */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex space-x-2">
          {assessmentSteps.map((_, index) => (
            <div
              key={index}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                index === currentStep
                  ? 'bg-purple-600 scale-125'
                  : index < currentStep
                  ? 'bg-green-600'
                  : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
          Step {currentStep + 1} of {assessmentSteps.length}
        </Badge>
      </div>

      {/* Assessment Content */}
      <motion.div
        key={currentStep}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="glassmorphism border-0 shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-xl mb-2">
              {currentStepData.title}
            </CardTitle>
            <p className="text-gray-600">
              {currentStepData.subtitle}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {currentStepData.options.map((option) => {
                const isSelected = currentStepData.type === "multiple_choice"
                  ? (responses[currentStepData.id] || []).includes(option.value)
                  : responses[currentStepData.id] === option.value;

                return (
                  <motion.div
                    key={option.value}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleResponse(currentStepData.id, option.value)}
                    className={`p-6 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                      isSelected
                        ? 'border-purple-500 bg-purple-50 shadow-md'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="text-3xl">{option.icon}</div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 mb-2">
                          {option.title}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {option.description}
                        </p>
                      </div>
                      {isSelected && (
                        <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center">
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Preview Section (shown on last step) */}
            {isLastStep && responses.depth_preference && (
              <div className="mt-8 p-6 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-200">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5 text-purple-600" />
                  Your Personalized Learning Path
                </h3>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-600" />
                    <span className="text-sm text-gray-700">
                      Duration: {getEstimatedDuration()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-gray-600" />
                    <span className="text-sm text-gray-700">
                      Level: {responses.experience?.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Brain className="w-4 h-4 text-gray-600" />
                    <span className="text-sm text-gray-700">
                      Depth: {responses.depth_preference?.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Navigation */}
      <div className="flex justify-between">
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
          disabled={!canProceed()}
          className="bg-gradient-to-r from-purple-600 to-indigo-500 hover:from-purple-700 hover:to-indigo-600 gap-2"
        >
          {isLastStep ? (
            <>
              Start Learning
              <Brain className="w-4 h-4" />
            </>
          ) : (
            <>
              Next
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}