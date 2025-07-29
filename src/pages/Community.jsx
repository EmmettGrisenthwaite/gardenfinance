import React, { useState, useEffect } from "react";
import { User } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, ArrowLeft, MessageSquare, ThumbsUp, TrendingUp, Plus, Search, Filter } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";

// Mock community data - in a real app this would come from your backend
const mockPosts = [
  {
    id: 1,
    author: "Sarah M.",
    title: "Just paid off my first credit card! 🎉",
    content: "After 8 months of following the debt avalanche method, I finally paid off my $2,400 credit card debt. The interest rate was killing me at 22% APR. Next up: my student loan!",
    category: "debt",
    likes: 24,
    comments: 8,
    timestamp: "2 hours ago",
    tags: ["debt-free", "credit-card", "milestone"]
  },
  {
    id: 2,
    author: "Mike R.",
    title: "Emergency fund fully funded at 22! 💪",
    content: "Started with $0 in savings 18 months ago. Today I hit my goal of $12,000 (6 months of expenses). The peace of mind is incredible. For anyone starting: even $25/week adds up!",
    category: "saving",
    likes: 31,
    comments: 12,
    timestamp: "5 hours ago",
    tags: ["emergency-fund", "saving", "young-adult"]
  },
  {
    id: 3,
    author: "Jenny K.",
    title: "Rookie mistake with my first investment 📉",
    content: "Put $1000 into a single stock based on a TikTok tip. Down 40% now. Lesson learned: diversification is key! Anyone have good ETF recommendations for beginners?",
    category: "investing",
    likes: 18,
    comments: 22,
    timestamp: "1 day ago",
    tags: ["investing", "lesson-learned", "beginner"]
  },
  {
    id: 4,
    author: "Alex T.",
    title: "Budget hack that saved me $200/month",
    content: "Started meal prepping on Sundays and buying generic brands. My grocery bill went from $400 to $200/month! That extra money is going straight to my house down payment fund.",
    category: "budgeting",
    likes: 42,
    comments: 15,
    timestamp: "2 days ago",
    tags: ["budgeting", "saving", "meal-prep"]
  }
];

const mockPopularTopics = [
  { name: "Emergency Funds", posts: 156, trend: "+12%" },
  { name: "Student Loans", posts: 243, trend: "+8%" },
  { name: "First Credit Card", posts: 189, trend: "+15%" },
  { name: "Investing Basics", posts: 298, trend: "+23%" },
  { name: "Side Hustles", posts: 167, trend: "+19%" }
];

export default function Community() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState(mockPosts);
  const [showNewPost, setShowNewPost] = useState(false);
  const [newPost, setNewPost] = useState({
    title: "",
    content: "",
    category: "general"
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const userData = await User.me();
      setUser(userData);
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setIsLoading(false);
  };

  const handleNewPost = () => {
    // In a real app, this would save to your backend
    const post = {
      id: posts.length + 1,
      author: user?.full_name || "You",
      title: newPost.title,
      content: newPost.content,
      category: newPost.category,
      likes: 0,
      comments: 0,
      timestamp: "Just now",
      tags: []
    };
    
    setPosts(prev => [post, ...prev]);
    setNewPost({ title: "", content: "", category: "general" });
    setShowNewPost(false);
  };

  const handleLike = (postId) => {
    setPosts(prev => prev.map(post => 
      post.id === postId 
        ? { ...post, likes: post.likes + 1 }
        : post
    ));
  };

  const getCategoryColor = (category) => {
    const colors = {
      debt: "bg-red-50 text-red-700 border-red-200",
      saving: "bg-green-50 text-green-700 border-green-200",
      investing: "bg-purple-50 text-purple-700 border-purple-200",
      budgeting: "bg-blue-50 text-blue-700 border-blue-200",
      general: "bg-gray-50 text-gray-700 border-gray-200"
    };
    return colors[category] || colors.general;
  };

  const filteredPosts = posts.filter(post => {
    const matchesSearch = post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         post.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || post.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="space-y-4">
            {Array(5).fill(0).map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
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
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(createPageUrl("Dashboard"))}
            className="rounded-xl"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Community Hub</h1>
            <p className="text-gray-600 mt-1">Connect with fellow students on their financial journey</p>
          </div>
        </div>
        <Button
          onClick={() => setShowNewPost(true)}
          className="bg-gradient-to-r from-emerald-600 to-blue-500 hover:from-emerald-700 hover:to-blue-600 gap-2"
        >
          <Plus className="w-4 h-4" />
          New Post
        </Button>
      </motion.div>

      <div className="grid lg:grid-cols-4 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6">
          {/* Search and Filters */}
          <Card className="glassmorphism border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search posts, topics, or users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={selectedCategory === "all" ? "default" : "outline"}
                    onClick={() => setSelectedCategory("all")}
                    size="sm"
                  >
                    All
                  </Button>
                  <Button
                    variant={selectedCategory === "debt" ? "default" : "outline"}
                    onClick={() => setSelectedCategory("debt")}
                    size="sm"
                  >
                    Debt
                  </Button>
                  <Button
                    variant={selectedCategory === "saving" ? "default" : "outline"}
                    onClick={() => setSelectedCategory("saving")}
                    size="sm"
                  >
                    Saving
                  </Button>
                  <Button
                    variant={selectedCategory === "investing" ? "default" : "outline"}
                    onClick={() => setSelectedCategory("investing")}
                    size="sm"
                  >
                    Investing
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* New Post Form */}
          {showNewPost && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card className="glassmorphism border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-emerald-600" />
                    Share Your Story
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input
                    placeholder="What's your financial win or question?"
                    value={newPost.title}
                    onChange={(e) => setNewPost(prev => ({ ...prev, title: e.target.value }))}
                  />
                  <Textarea
                    placeholder="Share details, tips, or ask for advice..."
                    value={newPost.content}
                    onChange={(e) => setNewPost(prev => ({ ...prev, content: e.target.value }))}
                    className="h-24"
                  />
                  <div className="flex justify-between items-center">
                    <select
                      value={newPost.category}
                      onChange={(e) => setNewPost(prev => ({ ...prev, category: e.target.value }))}
                      className="px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="general">General</option>
                      <option value="debt">Debt</option>
                      <option value="saving">Saving</option>
                      <option value="investing">Investing</option>
                      <option value="budgeting">Budgeting</option>
                    </select>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setShowNewPost(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleNewPost}
                        disabled={!newPost.title || !newPost.content}
                        className="bg-gradient-to-r from-emerald-600 to-blue-500"
                      >
                        Post
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Posts Feed */}
          <div className="space-y-4">
            {filteredPosts.map((post, index) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
              >
                <Card className="glassmorphism border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                          {post.author.charAt(0)}
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900">{post.author}</h3>
                          <p className="text-sm text-gray-500">{post.timestamp}</p>
                        </div>
                      </div>
                      <Badge className={`${getCategoryColor(post.category)} border`} variant="outline">
                        {post.category}
                      </Badge>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mt-3">{post.title}</h2>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-gray-700 leading-relaxed mb-4">{post.content}</p>
                    
                    {post.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {post.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="bg-gray-50 text-gray-600 text-xs">
                            #{tag}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleLike(post.id)}
                        className="gap-2 hover:bg-red-50 hover:border-red-200 hover:text-red-600"
                      >
                        <ThumbsUp className="w-4 h-4" />
                        {post.likes}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600"
                      >
                        <MessageSquare className="w-4 h-4" />
                        {post.comments}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          {/* Popular Topics */}
          <Card className="glassmorphism border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-orange-600" />
                Trending Topics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {mockPopularTopics.map((topic, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer">
                  <div>
                    <p className="font-medium text-gray-900">{topic.name}</p>
                    <p className="text-sm text-gray-500">{topic.posts} posts</p>
                  </div>
                  <Badge className="bg-green-50 text-green-700 border-green-200">
                    {topic.trend}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Community Stats */}
          <Card className="glassmorphism border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                Community Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-600">2,847</p>
                <p className="text-sm text-gray-500">Active Members</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-green-50 rounded-xl">
                  <p className="text-xl font-bold text-green-600">$2.1M</p>
                  <p className="text-xs text-gray-600">Debt Paid Off</p>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded-xl">
                  <p className="text-xl font-bold text-purple-600">156</p>
                  <p className="text-xs text-gray-600">Success Stories</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Tips */}
          <Card className="glassmorphism border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">💡 Community Guidelines</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 text-sm text-gray-600">
                <p>• Be supportive and encouraging</p>
                <p>• Share specific tips and experiences</p>
                <p>• Ask questions - no judgment here!</p>
                <p>• Celebrate wins, big and small</p>
                <p>• Keep financial details general</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}