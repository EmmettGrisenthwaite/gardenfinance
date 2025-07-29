import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

export default function WelcomeCard({ user }) {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const getMotivationalMessage = () => {
    const messages = [
      "Your financial future is looking bright! 💰",
      "Every dollar you plan today builds tomorrow! 🚀",
      "Smart money moves start with you! 💪",
      "Building wealth, one step at a time! ⭐",
      "Your financial wellness journey continues! 🌱"
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  };

  return (
    <Card className="border-0 shadow-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 text-white overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-r from-blue-600/90 to-emerald-600/90"></div>
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32"></div>
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-24 -translate-x-24"></div>
      
      <CardContent className="p-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="flex items-center justify-between"
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <h1 className="text-3xl lg:text-4xl font-bold">
                {getGreeting()}, {user?.full_name?.split(' ')[0] || 'there'}! 👋
              </h1>
              <p className="text-lg text-blue-100 font-medium">
                {getMotivationalMessage()}
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm px-3 py-1">
                <Sparkles className="w-4 h-4 mr-2" />
                <span className="font-semibold">
                  {user?.occupation?.replace('_', ' ').toUpperCase() || 'GETTING STARTED'}
                </span>
              </Badge>
              <Badge className="bg-emerald-500/20 text-emerald-100 border-emerald-400/30 backdrop-blur-sm px-3 py-1">
                🎯 Building Wealth
              </Badge>
            </div>
          </div>
          
          <div className="hidden md:block">
            <motion.div 
              className="w-28 h-28 bg-white/10 backdrop-blur-md rounded-3xl flex items-center justify-center shadow-2xl border border-white/20"
              whileHover={{ scale: 1.05, rotate: 5 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <TrendingUp className="w-12 h-12 text-white" />
            </motion.div>
          </div>
        </motion.div>
      </CardContent>
    </Card>
  );
}