

import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { 
  MessageCircle,
  LayoutDashboard, 
  Calculator, 
  TrendingUp, 
  Target, 
  Users,
  Menu,
  X,
  Sprout, // Changed from Shield
  User,
  CreditCard,
  BookOpen,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const navigationItems = [
  {
    title: "Dashboard",
    url: createPageUrl("Dashboard"),
    icon: LayoutDashboard,
    color: "text-blue-600"
  },
  {
    title: "AI Advisor",
    url: createPageUrl("AIAdvisor"),
    icon: MessageCircle,
    color: "text-emerald-600"
  },
  { // Changed from "Get Rich Plan"
    title: "Grow your Garden",
    url: createPageUrl("GrowYourGarden"), // Changed URL
    icon: Sprout, // Changed Icon
    color: "text-green-500"
  },
  {
    title: "Budget Builder",
    url: createPageUrl("BudgetBuilder"),
    icon: Calculator,
    color: "text-indigo-600"
  },
  {
    title: "Debt Manager",
    url: createPageUrl("DebtManager"),
    icon: CreditCard,
    color: "text-red-600"
  },
  {
    title: "Portfolio Tools",
    url: createPageUrl("Portfolio"),
    icon: TrendingUp,
    color: "text-purple-600"
  },
  {
    title: "Goals",
    url: createPageUrl("Goals"),
    icon: Target,
    color: "text-amber-600"
  },
  {
    title: "Learn",
    url: createPageUrl("Learn"),
    icon: BookOpen,
    color: "text-green-600"
  },
  {
    title: "Community",
    url: createPageUrl("Community"),
    icon: Users,
    color: "text-pink-600"
  }
];

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <style>{`
        :root {
          --primary-navy: #1e3a8a;
          --primary-emerald: #10b981;
          --accent-gold: #fbbf24;
          --accent-coral: #f87171;
          --light-blue: #60a5fa;
          --background-gray: #f8fafc;
          --text-primary: #1e293b;
          --text-secondary: #64748b;
          --border-subtle: #e2e8f0;
          --shadow-soft: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          --shadow-medium: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
          --shadow-large: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        }
        
        .professional-glass {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(226, 232, 240, 0.8);
          box-shadow: var(--shadow-soft);
        }
        
        .nav-item-active {
          background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
          color: white;
          box-shadow: var(--shadow-medium);
        }
        
        .nav-item-hover {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .nav-item-hover:hover {
          background: rgba(30, 58, 138, 0.05);
          transform: translateX(4px);
          box-shadow: var(--shadow-soft);
        }
        
        .brand-gradient {
          background: linear-gradient(135deg, #1e3a8a 0%, #10b981 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        
        .glassmorphism {
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.2);
        }
      `}</style>

      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          {/* Desktop Sidebar */}
          <Sidebar className="hidden lg:flex border-r-0 professional-glass border-r border-slate-200">
            <SidebarHeader className="p-6 border-b border-slate-200/60">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-600 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg">
                    <Sprout className="w-6 h-6 text-white" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-white"></div>
                </div>
                <div>
                  <h2 className="text-xl font-bold brand-gradient">
                    Garden
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">AI Financial Advisor</p>
                </div>
              </div>
            </SidebarHeader>
            
            <SidebarContent className="p-4">
              <SidebarGroup>
                <SidebarGroupLabel className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 mb-3">
                  Financial Tools
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu className="space-y-1">
                    {navigationItems.map((item) => {
                      const isActive = location.pathname === item.url;
                      return (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton
                            asChild
                            className={`
                              h-11 rounded-xl font-medium transition-all duration-200
                              ${isActive 
                                ? 'nav-item-active text-white' 
                                : 'nav-item-hover hover:bg-slate-50 text-slate-700'
                              }
                            `}
                          >
                            <Link to={item.url}>
                              <item.icon className={`w-5 h-5 ${isActive ? 'text-white' : item.color}`} />
                              <span className="ml-3">{item.title}</span>
                              {item.title === "Community" && (
                                <Badge className="ml-auto bg-pink-100 text-pink-700 border-pink-200 text-xs">
                                  New
                                </Badge>
                              )}
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>

            <SidebarFooter className="p-4 border-t border-slate-200/60">
              <div className="bg-gradient-to-r from-emerald-50 to-blue-50 p-4 rounded-xl border border-emerald-200">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
                    <User className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">Welcome back!</p>
                    <p className="text-xs text-slate-500">Your financial journey continues</p>
                  </div>
                </div>
              </div>
            </SidebarFooter>
          </Sidebar>

          {/* Mobile Navigation */}
          <div className="lg:hidden fixed top-0 left-0 right-0 z-50 professional-glass border-b border-slate-200">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-green-600 to-emerald-500 rounded-lg flex items-center justify-center">
                  <Sprout className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-lg font-bold brand-gradient">Garden</h2>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="rounded-lg"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>
            </div>

            {/* Mobile Menu Overlay */}
            {mobileMenuOpen && (
              <div className="fixed inset-0 top-16 bg-black/20 backdrop-blur-sm z-40">
                <div className="professional-glass m-4 rounded-2xl shadow-2xl">
                  <div className="p-4">
                    <div className="grid gap-2">
                      {navigationItems.map((item) => {
                        const isActive = location.pathname === item.url;
                        return (
                          <Link
                            key={item.title}
                            to={item.url}
                            onClick={() => setMobileMenuOpen(false)}
                            className={`
                              flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all
                              ${isActive 
                                ? 'nav-item-active text-white' 
                                : 'hover:bg-slate-50 text-slate-700'
                              }
                            `}
                          >
                            <item.icon className={`w-5 h-5 ${isActive ? 'text-white' : item.color}`} />
                            <span>{item.title}</span>
                            {item.title === "Community" && (
                              <Badge className="ml-auto bg-pink-100 text-pink-700 border-pink-200 text-xs">
                                New
                              </Badge>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Main Content */}
          <div className="flex-1 lg:pl-0 pt-16 lg:pt-0">
            <main className="min-h-screen">
              {children}
            </main>
          </div>
        </div>
      </SidebarProvider>
    </div>
  );
}

