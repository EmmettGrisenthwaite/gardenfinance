import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, CheckCircle, BookOpen, Play, HelpCircle, FileText, Beaker, Calculator, Scale, Brain, Target } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Import content components
import MarkdownContent from "./content/MarkdownContent";
import VideoPlayer from "./content/VideoPlayer";
import BudgetingAssessment from "./content/BudgetingAssessment";
import CashFlowCalculator from "./content/CashFlowCalculator";
import BiasIdentificationQuiz from "./content/BiasIdentificationQuiz";
import AssetClassQuiz from "./content/AssetClassQuiz";
import RiskToleranceAssessment from "./content/RiskToleranceAssessment";
import PortfolioOptimizer from "./content/PortfolioOptimizer";
import InvestorBiasQuiz from "./content/InvestorBiasQuiz";
import MarketSimulator from "./content/MarketSimulator";
import BehavioralActionPlan from "./content/BehavioralActionPlan";
import ReactToHeadlines from "./content/ReactToHeadlines";
import BehavioralActionPlanBuilder from "./content/BehavioralActionPlanBuilder";
import BasicModelBuilder from "./content/BasicModelBuilder";
import DCFModelBuilder from "./content/DCFModelBuilder";
import EconomicCycleSimulator from "./content/EconomicCycleSimulator";
import FedPolicyCalculator from "./content/FedPolicyCalculator";
import HeadlineAnalyzer from "./content/HeadlineAnalyzer";
import AssetLocationOptimizer from "./content/AssetLocationOptimizer";
import RothConversionCalculator from "./content/RothConversionCalculator";
import EstateTaxCalculator from "./content/EstateTaxCalculator";

export default function LearningModule({ module, onComplete, onBack, preferences, user }) {
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
  const [completedLessons, setCompletedLessons] = useState([]);
  
  const currentLesson = module.lessons[currentLessonIndex];
  const progress = ((currentLessonIndex + 1) / module.lessons.length) * 100;
  const isLastLesson = currentLessonIndex === module.lessons.length - 1;
  const isFirstLesson = currentLessonIndex === 0;

  const handleNext = () => {
    if (!completedLessons.includes(currentLesson.id)) {
      setCompletedLessons(prev => [...prev, currentLesson.id]);
    }

    if (isLastLesson) {
      onComplete(); // Triggers transition to ModuleCompletionPage
    } else {
      setCurrentLessonIndex(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (!isFirstLesson) {
      setCurrentLessonIndex(prev => prev - 1);
    }
  };

  const getLessonIcon = (type) => {
    switch (type) {
      case 'comprehensive_analysis': return <FileText className="w-5 h-5 text-blue-600" />;
      case 'advanced_analysis': return <Calculator className="w-5 h-5 text-indigo-600" />;
      case 'research_deep_dive': return <Beaker className="w-5 h-5 text-purple-600" />;
      case 'theory_application': return <Scale className="w-5 h-5 text-orange-600" />;
      case 'bias_laboratory': return <Brain className="w-5 h-5 text-pink-600" />;
      case 'practical_design': return <Target className="w-5 h-5 text-emerald-600" />;
      case 'hands_on_modeling': return <Calculator className="w-5 h-5 text-purple-600" />;
      case 'advanced_valuation': return <Calculator className="w-5 h-5 text-indigo-600" />;
      case 'simulation_lab': return <Beaker className="w-5 h-5 text-green-600" />;
      case 'economic_analysis': return <Target className="w-5 h-5 text-blue-600" />;
      case 'policy_analysis': return <Scale className="w-5 h-5 text-purple-600" />;
      case 'global_analysis': return <FileText className="w-5 h-5 text-orange-600" />;
      case 'advanced_tax_analysis': return <Calculator className="w-5 h-5 text-green-600" />;
      case 'tax_strategy_planning': return <Target className="w-5 h-5 text-indigo-600" />;
      case 'estate_planning': return <Scale className="w-5 h-5 text-purple-600" />;
      default: return <BookOpen className="w-5 h-5 text-gray-600" />;
    }
  };

  const renderContentBlock = (block, index) => {
    // Filter content based on user's depth preference
    const userDepth = preferences?.depth_preference || "comprehensive";
    if (block.depth && !block.depth.includes(userDepth)) {
      return null;
    }

    switch (block.type) {
      case "markdown_text":
        return (
          <MarkdownContent
            key={index}
            title={block.title}
            content={block.value || block.content}
          />
        );
      
      case "video":
        return (
          <VideoPlayer
            key={index}
            title={block.title}
            url={block.url}
            description={block.description}
          />
        );
      
      case "budgeting_assessment":
        return (
          <BudgetingAssessment
            key={index}
            title={block.title}
            questions={block.questions}
            results={block.results}
          />
        );
      
      case "cash_flow_calculator":
        return (
          <CashFlowCalculator
            key={index}
            title={block.title}
            inputs={block.inputs}
          />
        );
      
      case "bias_identification_quiz":
        return (
          <BiasIdentificationQuiz
            key={index}
            title={block.title}
            questions={block.questions}
            profiles={block.profiles}
          />
        );

      case "asset_class_quiz":
        return (
          <AssetClassQuiz
            key={index}
            title={block.title}
            questions={block.questions}
          />
        );

      case "risk_tolerance_assessment":
        return (
          <RiskToleranceAssessment
            key={index}
            assessment={block.assessment}
            age={user?.age || 30}
            onComplete={handleNext}
          />
        );
      
      case "portfolio_optimizer":
        return <PortfolioOptimizer key={index} />;
      
      case "investor_bias_quiz":
        return <InvestorBiasQuiz key={index} />;

      case "market_simulator":
        return <MarketSimulator key={index} />;
      
      case "behavioral_action_plan":
        return <BehavioralActionPlan key={index} />;

      case "react_to_headlines":
        return (
          <ReactToHeadlines
            key={index}
            title={block.title}
            scenarios={block.scenarios}
          />
        );

      case "behavioral_action_plan_builder":
        return (
          <BehavioralActionPlanBuilder
            key={index}
            title={block.title}
            description={block.description}
          />
        );

      case "basic_model_builder":
        return (
          <BasicModelBuilder
            key={index}
            title={block.title}
            description={block.description}
          />
        );

      case "dcf_model_builder":
        return <DCFModelBuilder key={index} />;
      
      case "economic_cycle_simulator":
        return (
          <EconomicCycleSimulator
            key={index}
            title={block.title}
            description={block.description}
          />
        );

      case "fed_policy_calculator":
        return (
          <FedPolicyCalculator
            key={index}
            title={block.title}
            description={block.description}
          />
        );

      case "headline_analyzer":
        return (
          <HeadlineAnalyzer
            key={index}
            title={block.title}
          />
        );

      case "asset_location_optimizer":
        return <AssetLocationOptimizer key={index} />;

      case "roth_conversion_calculator":
        return <RothConversionCalculator key={index} />;

      case "estate_tax_calculator":
        return <EstateTaxCalculator key={index} />;
      
      default:
        return (
          <Card key={index} className="glassmorphism border-0 shadow-lg mb-8">
            <CardContent className="text-center py-12 space-y-4">
              <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto flex items-center justify-center">
                <HelpCircle className="w-8 h-8 text-gray-500" />
              </div>
              <h3 className="font-semibold text-lg text-gray-800">Interactive Component</h3>
              <p className="text-gray-600 max-w-md mx-auto">
                Advanced interactive component for "{block.type}" would appear here.
              </p>
            </CardContent>
          </Card>
        );
    }
  };

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
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
            <h1 className="text-2xl font-bold text-gray-900">{module.title}</h1>
            <p className="text-gray-600">
              Lesson {currentLessonIndex + 1} of {module.lessons.length}: {currentLesson.title}
            </p>
          </div>
        </div>
        <Badge className="bg-gradient-to-r from-purple-100 to-indigo-100 text-purple-800 border-purple-200">
          {Math.round(progress)}% Complete
        </Badge>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <Progress value={progress} className="h-2" />
        <div className="flex justify-between text-xs text-gray-500">
          <span>Progress</span>
          <span>{currentLessonIndex + 1} / {module.lessons.length}</span>
        </div>
      </div>

      {/* Lesson Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentLessonIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
          className="space-y-8"
        >
          {/* Lesson Header */}
          <Card className="glassmorphism border-0 shadow-lg">
            <CardHeader className="text-center py-8">
              <div className="flex items-center justify-center gap-3 mb-4">
                {getLessonIcon(currentLesson.type)}
                <CardTitle className="text-2xl">{currentLesson.title}</CardTitle>
              </div>
              <Badge variant="outline" className="capitalize">
                {currentLesson.type.replace(/_/g, ' ')}
              </Badge>
            </CardHeader>
          </Card>

          {/* Content Blocks */}
          {currentLesson.contentBlocks?.map((block, index) => 
            renderContentBlock(block, index)
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={isFirstLesson}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Previous
        </Button>

        <div className="flex items-center gap-2">
          {module.lessons.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentLessonIndex(index)}
              className={`w-3 h-3 rounded-full transition-all ${
                index === currentLessonIndex
                  ? 'bg-purple-600 scale-125'
                  : index < currentLessonIndex || completedLessons.includes(module.lessons[index].id)
                  ? 'bg-green-600'
                  : 'bg-gray-300 hover:bg-gray-400'
              }`}
            />
          ))}
        </div>

        <Button
          onClick={handleNext}
          className="bg-gradient-to-r from-purple-600 to-indigo-500 hover:from-purple-700 hover:to-indigo-600 gap-2"
        >
          {isLastLesson ? (
            <>
              Complete Module
              <CheckCircle className="w-4 h-4" />
            </>
          ) : (
            <>
              Next Lesson
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}