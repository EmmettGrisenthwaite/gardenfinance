
import React, { useState, useEffect } from "react";
import { Portfolio as PortfolioEntity } from "@/api/entities";
import { User } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, ArrowLeft, BarChart3 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";

import PortfolioAnalyzer from "../components/portfolio/PortfolioAnalyzer";
import PortfolioBuilder from "../components/portfolio/PortfolioBuilder";

export default function Portfolio() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [portfolios, setPortfolios] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const userData = await User.me();
      setUser(userData);
      
      const portfolioData = await PortfolioEntity.filter({ created_by: userData.email });
      setPortfolios(portfolioData);
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setIsLoading(false);
  };

  const refreshPortfolios = () => {
    loadData();
  };

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-12 bg-gray-200 rounded w-1/2"></div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 space-y-8 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="flex items-center gap-4"
      >
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate(createPageUrl("Dashboard"))}
          className="rounded-xl"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Portfolio Tools</h1>
          <p className="text-gray-600 mt-1">Analyze and optimize your investment portfolio</p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
      >
        <Tabs defaultValue="analyzer" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2 bg-white/50 border border-white/20">
            <TabsTrigger 
              value="analyzer" 
              className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              <BarChart3 className="w-4 h-4" />
              Analyzer
            </TabsTrigger>
            <TabsTrigger 
              value="builder"
              className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              <TrendingUp className="w-4 h-4" />
              Builder
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analyzer" className="space-y-6">
            <PortfolioAnalyzer 
              user={user}
              portfolios={portfolios}
              onRefresh={refreshPortfolios}
            />
          </TabsContent>

          <TabsContent value="builder" className="space-y-6">
            <PortfolioBuilder 
              user={user}
              portfolios={portfolios}
              onRefresh={refreshPortfolios}
            />
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
