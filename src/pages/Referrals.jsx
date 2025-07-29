import React, { useState, useEffect } from "react";
import { User } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Users, Share, Copy, ArrowLeft, Gift, Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";

export default function Referrals() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [referralStats, setReferralStats] = useState({
    totalReferrals: 0,
    successfulReferrals: 0,
    pendingReferrals: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const userData = await User.me();
      setUser(userData);
      
      // In a real app, you'd fetch actual referral stats
      setReferralStats({
        totalReferrals: 5,
        successfulReferrals: 3,
        pendingReferrals: 2
      });
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setIsLoading(false);
  };

  const copyReferralLink = () => {
    const referralLink = `${window.location.origin}?ref=${user?.referral_code}`;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareReferralLink = async () => {
    const referralLink = `${window.location.origin}?ref=${user?.referral_code}`;
    const shareText = `Check out Fundsy - the best financial planning app for Gen Z! Use my code ${user?.referral_code} to get started. ${referralLink}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join me on Fundsy!',
          text: shareText,
          url: referralLink
        });
      } catch (error) {
        // Fallback to copy
        copyReferralLink();
      }
    } else {
      copyReferralLink();
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid md:grid-cols-3 gap-6">
            {Array(3).fill(0).map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
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
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Referral Program</h1>
          <p className="text-gray-600 mt-1">Share Fundsy with friends and earn rewards together</p>
        </div>
      </motion.div>

      {/* Referral Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        <Card className="glassmorphism border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-500">Total Referrals</p>
                <p className="text-2xl font-bold text-gray-900">{referralStats.totalReferrals}</p>
              </div>
              <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glassmorphism border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-500">Successful</p>
                <p className="text-2xl font-bold text-gray-900">{referralStats.successfulReferrals}</p>
              </div>
              <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center">
                <Trophy className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glassmorphism border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-500">Pending</p>
                <p className="text-2xl font-bold text-gray-900">{referralStats.pendingReferrals}</p>
              </div>
              <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center">
                <Gift className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Referral Code Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <Card className="glassmorphism border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Share className="w-5 h-5 text-pink-600" />
              Your Referral Code
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center space-y-4">
              <div className="inline-flex items-center gap-3 bg-gradient-to-r from-pink-50 to-purple-50 px-6 py-4 rounded-2xl border border-pink-200">
                <span className="text-3xl font-bold text-pink-600">{user?.referral_code}</span>
                <Badge className="bg-pink-100 text-pink-800">Your Code</Badge>
              </div>
              <p className="text-gray-600">Share this code with friends to help them get started!</p>
            </div>

            <div className="space-y-3">
              <div className="flex gap-3">
                <Input
                  readOnly
                  value={`${window.location.origin}?ref=${user?.referral_code}`}
                  className="h-12 bg-gray-50"
                />
                <Button
                  onClick={copyReferralLink}
                  variant="outline"
                  className="h-12 px-6 gap-2"
                >
                  <Copy className="w-4 h-4" />
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </div>

              <Button
                onClick={shareReferralLink}
                className="w-full h-12 bg-gradient-to-r from-pink-600 to-pink-500 hover:from-pink-700 hover:to-pink-600 gap-2"
              >
                <Share className="w-4 h-4" />
                Share with Friends
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* How it Works */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
      >
        <Card className="glassmorphism border-0 shadow-lg">
          <CardHeader>
            <CardTitle>How Referrals Work</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto">
                  <span className="text-2xl">1️⃣</span>
                </div>
                <h3 className="font-semibold">Share Your Code</h3>
                <p className="text-sm text-gray-600">
                  Send your referral link to friends who could benefit from better financial planning
                </p>
              </div>

              <div className="text-center space-y-3">
                <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto">
                  <span className="text-2xl">2️⃣</span>
                </div>
                <h3 className="font-semibold">They Sign Up</h3>
                <p className="text-sm text-gray-600">
                  Your friends create their Fundsy account and complete their financial assessment
                </p>
              </div>

              <div className="text-center space-y-3">
                <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mx-auto">
                  <span className="text-2xl">3️⃣</span>
                </div>
                <h3 className="font-semibold">Everyone Wins</h3>
                <p className="text-sm text-gray-600">
                  You both get premium features and exclusive financial tips for successful referrals
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}