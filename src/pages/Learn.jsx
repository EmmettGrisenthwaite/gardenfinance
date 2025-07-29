
import React, { useState, useEffect } from "react";
import { User } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BookOpen, ArrowLeft, Play, CheckCircle, Brain, Target, Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";

import ModuleOverview from "../components/learning/ModuleOverview";
import CoursePreAssessment from "../components/learning/CoursePreAssessment";
import LearningModule from "../components/learning/LearningModule";
import ModuleCompletionPage from "../components/learning/ModuleCompletionPage";
import RiskToleranceAssessment from "../components/learning/content/RiskToleranceAssessment";
import PortfolioOptimizer from "../components/learning/content/PortfolioOptimizer";
import InvestorBiasQuiz from "../components/learning/content/InvestorBiasQuiz";
import MarketSimulator from "../components/learning/content/MarketSimulator";
import BehavioralActionPlan from "../components/learning/content/BehavioralActionPlan";


const learningModules = [
  {
    id: "advanced-budgeting",
    title: "Advanced Budgeting & Cash Flow Management",
    description: "Master sophisticated budgeting techniques, cash flow forecasting, and financial planning methodologies",
    difficulty: "Beginner to Expert",
    duration: "45 min",
    icon: "💰",
    category: "Personal Finance",
    expertTopics: ["Zero-based budgeting", "Cash flow optimization", "Behavioral economics", "Financial psychology"],
    heroTitle: "Master Your Money Flow",
    heroSubtitle: "Advanced budgeting techniques and cash flow forecasting for financial success",
    learningOutcomes: [
      "Develop a personalized budgeting system that fits your lifestyle",
      "Master cash flow analysis and forecasting techniques",
      "Identify and overcome psychological biases in financial decisions",
      "Create automated systems for long-term financial success"
    ],
    lessons: [
      {
        id: 1,
        title: "Budgeting Philosophy & Framework Selection",
        type: "comprehensive_analysis",
        contentBlocks: [
          {
            type: "markdown_text",
            depth: ["overview", "comprehensive", "expert"],
            title: "Comparing Budgeting Methodologies: Pros and Cons for Modern Finances",
            value: `# Comparing Budgeting Methodologies: Pros and Cons for Modern Finances

In today's complex financial landscape, choosing the right budgeting method can mean the difference between financial stress and financial freedom. This comprehensive guide examines the most effective budgeting methodologies, their advantages and limitations, and how to select the approach that best fits your lifestyle and goals.

## The Evolution of Personal Budgeting

Traditional budgeting has evolved from simple income-expense tracking to sophisticated frameworks that incorporate behavioral psychology, technology, and personalized financial goals. Understanding these methodologies helps you make an informed choice about managing your money.

## 1. Zero-Based Budgeting (ZBB)

### How It Works
Zero-based budgeting requires you to allocate every dollar of income to specific categories until your income minus expenses equals zero. This doesn't mean spending everything—savings and investments are treated as expenses.

### Pros:
- **Complete Financial Awareness**: Forces you to account for every dollar
- **Eliminates Waste**: Identifies and cuts unnecessary spending
- **Goal Alignment**: Ensures spending matches priorities
- **Flexibility**: Can adjust categories monthly based on needs

### Cons:
- **Time-Intensive**: Requires significant monthly planning
- **Can Feel Restrictive**: Every purchase needs justification
- **Complexity**: Managing irregular income is challenging
- **Burnout Risk**: The detail level can overwhelm some users

### Best For:
- Detail-oriented individuals
- Those with stable, predictable income
- People serious about debt elimination
- Anyone wanting maximum financial control

### Implementation Tips from NerdWallet:
- Start with a 3-month trial period to test effectiveness
- Use apps like EveryDollar or YNAB for digital tracking
- Build in small buffer categories for unexpected expenses
- Focus on progress, not perfection during the first few months

## 2. The 50/30/20 Rule

### How It Works
This method divides after-tax income into three categories: 50% for needs, 30% for wants, and 20% for savings and debt repayment.

### Pros:
- **Simplicity**: Easy to understand and implement
- **Balance**: Built-in allocation for enjoyment
- **Quick Setup**: Can start immediately
- **Flexibility**: Broad categories allow personal interpretation

### Cons:
- **One-Size-Fits-All Issues**: May not suit all income levels
- **Vague Categories**: "Needs" vs. "wants" can be subjective
- **Limited for High-Cost Areas**: 50% for needs may be unrealistic
- **Lacks Detail**: May miss spending problems

### Best For:
- Budgeting beginners who want structure without complexity
- Those with moderate to high income ($50,000+)
- People wanting work-life balance in financial planning
- Anyone overwhelmed by detailed tracking systems

### Bank of America's Implementation Strategy:
1. Calculate your true take-home pay (include 401k contributions back in)
2. Set up automatic transfers for the 20% savings portion
3. Use separate accounts for each category to maintain boundaries
4. Review and adjust percentages quarterly based on life changes

## 3. Envelope/Cash-Based System

### How It Works
Physical or digital "envelopes" are allocated for spending categories. When an envelope is empty, spending in that category stops.

### Pros:
- **Tangible Limits**: Physical constraint prevents overspending
- **Immediate Feedback**: Visual system shows remaining funds
- **No Tracking Required**: Spending stops when cash runs out
- **Psychological Impact**: Physical money feels more "real"

### Cons:
- **Impractical for Digital Age**: Many expenses require cards
- **Security Risks**: Carrying large amounts of cash
- **No Credit Card Rewards**: Misses cashback opportunities
- **Inflexibility**: Difficult to adjust mid-month

### Best For:
- Visual learners who need tangible spending limits
- Those struggling with credit card debt
- People who overspend with digital payments
- Anyone wanting immediate spending awareness

### Modern Digital Implementation:
- Use apps like Goodbudget for virtual envelope system
- Set up separate checking accounts for each major category
- Use debit cards linked to specific envelope accounts
- Combine with some cash for small purchases

## 4. Value-Based Budgeting

### How It Works
Allocates money based on personal values and life goals rather than traditional categories. Spending aligns with what matters most to you personally.

### Pros:
- **Meaningful Alignment**: Spending matches life priorities
- **Increased Satisfaction**: Money goes toward fulfillment
- **Motivation**: Clear connection between spending and goals
- **Personalization**: Completely customized approach

### Cons:
- **Requires Self-Knowledge**: Must clearly understand values
- **Less Structure**: Can lack practical guidelines
- **Potential Blind Spots**: May neglect necessary but "unvalued" expenses
- **Subjective**: Difficult to measure success objectively

### Best For:
- Those feeling unfulfilled despite financial success
- People with clear life goals and strong values
- Anyone wanting purpose-driven finances
- Individuals tired of traditional budgeting categories

## 5. Pay-Your-Self-First Method

### How It Works
Automatically saves and invests a predetermined percentage before budgeting remaining income for expenses.

### Pros:
- **Guaranteed Savings**: Ensures financial goals are met first
- **Automation-Friendly**: Set and forget approach
- **Reduced Decision Fatigue**: Fewer daily financial choices
- **Compound Growth**: Early saving maximizes returns

### Cons:
- **Requires Sufficient Income**: Must cover expenses with remainder
- **Less Comprehensive**: Doesn't address all spending categories
- **Potential Cash Flow Issues**: May create short-term problems
- **Limited Expense Insight**: Doesn't track where money goes

### Best For:
- High earners with stable income
- Those who struggle to save consistently
- People wanting to automate their finances
- Anyone prioritizing long-term wealth building

### Expert Implementation Strategy:
- Start with 10-15% and increase annually
- Use automatic transfers on payday
- Combine with expense tracking for complete picture
- Adjust percentage based on financial goals timeline

## Choosing Your Method: A Decision Framework

### Step 1: Assess Your Financial Personality
- **Detail Level**: Do you enjoy tracking or find it tedious?
- **Time Availability**: How much time can you dedicate monthly?
- **Tech Comfort**: Are you comfortable with apps and automation?
- **Learning Style**: Visual, analytical, or hands-on preference?

### Step 2: Evaluate Your Financial Situation
- **Income Stability**: Regular salary or variable income?
- **Expense Complexity**: Simple or numerous financial obligations?
- **Debt Level**: High-priority debt or relatively debt-free?
- **Goals Timeline**: Short-term needs or long-term wealth building?

### Step 3: Consider Hybrid Approaches
Many successful budgeters combine methods:
- **Pay-Your-Self-First + 50/30/20**: Automate savings, then use percentages for remaining income
- **Zero-Based + Envelope**: Detailed planning with physical spending limits
- **Value-Based + Traditional**: Align categories with values while maintaining structure

## Implementation Success Factors

### From Bank of America's Research:
1. **Track Before You Plan**: Spend 2-4 weeks understanding current spending patterns
2. **Start Realistic**: Don't cut everything at once; make gradual improvements
3. **Build Buffers**: Add 5-10% buffer for unexpected expenses
4. **Review Monthly**: Adjust based on actual spending vs. planned
5. **Celebrate Progress**: Acknowledge improvements to maintain motivation

### Common Pitfalls to Avoid:
- Choosing a method based on what sounds good rather than personality fit
- Setting unrealistic category limits that set you up for failure
- Not accounting for seasonal variations in expenses
- Ignoring the psychological aspects of spending behavior
- Switching methods too frequently without giving them time to work

## Conclusion

The best budgeting method is the one you'll actually use consistently. While each approach has merits, your personal situation, goals, and preferences determine the optimal choice. Remember that budgeting is a skill that improves with practice, and switching methods as your life changes is not failure—it's smart financial management.

Start with the method that most appeals to your current situation, commit to using it for at least three months, and then evaluate its effectiveness both financially and emotionally. The perfect budget is one that reduces financial stress while helping you achieve your goals.`
          },
          {
            type: "video",
            depth: ["overview", "comprehensive"],
            title: "Choosing Your Budgeting Style: A Personal Finance Coach's Guide",
            url: "https://www.youtube.com/embed/sVKQn2R7BOI",
            description: "Learn how to select the perfect budgeting method for your lifestyle and financial goals"
          },
          {
            type: "budgeting_assessment",
            depth: ["comprehensive", "expert"],
            title: "Find Your Ideal Budgeting Method",
            questions: [
              {
                id: 1,
                question: "How do you prefer to handle money decisions?",
                options: [
                  { text: "I want to track every dollar and know exactly where my money goes", score: { zbb: 4, percentage: 1, envelope: 2, value: 3, payFirst: 2 } },
                  { text: "I prefer simple percentage-based rules that don't require much thinking", score: { zbb: 1, percentage: 4, envelope: 1, value: 2, payFirst: 3 } },
                  { text: "I like having physical or visual limits on my spending", score: { zbb: 2, percentage: 1, envelope: 4, value: 2, payFirst: 1 } },
                  { text: "I want my spending to reflect my personal values and life goals", score: { zbb: 3, percentage: 2, envelope: 2, value: 4, payFirst: 2 } }
                ]
              },
              {
                id: 2,
                question: "How much time can you realistically spend on budgeting monthly?",
                options: [
                  { text: "2-3 hours - I'm committed to detailed financial planning", score: { zbb: 4, percentage: 1, envelope: 2, value: 3, payFirst: 1 } },
                  { text: "30 minutes or less - I need something quick and simple", score: { zbb: 1, percentage: 4, envelope: 2, value: 1, payFirst: 4 } },
                  { text: "1 hour - I can do some planning but not too much detail", score: { zbb: 2, percentage: 3, envelope: 3, value: 2, payFirst: 3 } },
                  { text: "It varies - I'm more focused on big picture than regular tracking", score: { zbb: 2, percentage: 2, envelope: 1, value: 4, payFirst: 3 } }
                ]
              },
              {
                id: 3,
                question: "What's your biggest money challenge?",
                options: [
                  { text: "I don't know where my money goes each month", score: { zbb: 4, percentage: 2, envelope: 3, value: 2, payFirst: 1 } },
                  { text: "I struggle to balance saving with enjoying life", score: { zbb: 2, percentage: 4, envelope: 1, value: 2, payFirst: 3 } },
                  { text: "I tend to overspend on certain categories like dining or shopping", score: { zbb: 3, percentage: 1, envelope: 4, value: 2, payFirst: 2 } },
                  { text: "My spending doesn't align with what's truly important to me", score: { zbb: 2, percentage: 1, envelope: 2, value: 4, payFirst: 2 } }
                ]
              },
              {
                id: 4,
                question: "How do you learn best?",
                options: [
                  { text: "I like detailed data and comprehensive tracking systems", score: { zbb: 4, percentage: 1, envelope: 2, value: 2, payFirst: 2 } },
                  { text: "I need simple rules and guidelines I can remember easily", score: { zbb: 1, percentage: 4, envelope: 2, value: 1, payFirst: 3 } },
                  { text: "I'm a visual/tactile learner who needs to 'see' or 'touch' my money", score: { zbb: 2, percentage: 1, envelope: 4, value: 2, payFirst: 1 } },
                  { text: "I understand concepts better when they connect to my personal goals", score: { zbb: 2, percentage: 2, envelope: 1, value: 4, payFirst: 3 } }
                ]
              }
            ],
            results: {
              zbb: {
                name: "Zero-Based Budgeting",
                description: "Your analytical nature and commitment to financial control make Zero-Based Budgeting your ideal method. You thrive on detail and want complete awareness of your financial situation.",
                steps: [
                  "Choose a ZBB app like YNAB or EveryDollar",
                  "List all income sources for next month",
                  "Create spending categories based on your expenses",
                  "Allocate every dollar until you reach zero",
                  "Track spending daily and adjust as needed",
                  "Review and plan fresh each month"
                ]
              },
              percentage: {
                name: "50/30/20 Method",
                description: "You value simplicity and balance in your financial life. The 50/30/20 method gives you structure without overwhelming detail.",
                steps: [
                  "Calculate your after-tax monthly income",
                  "Set up three bank accounts: Needs, Wants, Savings",
                  "Automate transfers: 50% needs, 30% wants, 20% savings",
                  "Pay bills from Needs, fun from Wants",
                  "Review quarterly to ensure percentages still work",
                  "Adjust percentages if needed for your situation"
                ]
              },
              envelope: {
                name: "Envelope System",
                description: "You're a visual learner who benefits from tangible spending limits. The envelope system provides the concrete boundaries you need.",
                steps: [
                  "Identify your variable spending categories",
                  "Decide on cash vs. digital envelopes",
                  "Set spending limits for each category",
                  "Fill envelopes at month's start",
                  "Spend only from designated envelopes",
                  "When empty, stop spending in that category"
                ]
              },
              value: {
                name: "Value-Based Budgeting",
                description: "You're motivated by meaning and purpose. Value-based budgeting aligns your money with your life goals.",
                steps: [
                  "Define your top 5 life values",
                  "Audit current spending against these values",
                  "Create spending categories based on values",
                  "Set percentage targets for each value category",
                  "Track monthly alignment score",
                  "Adjust to increase value alignment over time"
                ]
              },
              payFirst: {
                name: "Pay-Your-Self-First Method",
                description: "You prioritize long-term financial success and prefer automated systems. This method ensures you save before you spend.",
                steps: [
                  "Calculate target savings percentage (start with 15%)",
                  "Set up automatic transfer on payday",
                  "Direct transfers to separate savings/investment accounts",
                  "Budget remaining income for expenses",
                  "Increase percentage annually by 1-2%",
                  "Combine with expense tracking for full picture"
                ]
              }
            }
          }
        ]
      },
      {
        id: 2,
        title: "Cash Flow Analysis & Forecasting",
        type: "advanced_analysis",
        contentBlocks: [
          {
            type: "markdown_text",
            depth: ["overview", "comprehensive", "expert"],
            title: "Advanced Cash Flow Mapping: Identifying Leakages and Opportunities",
            value: `# Advanced Cash Flow Mapping: Identifying Leakages and Opportunities

Cash flow is the lifeblood of personal finance, yet most people only have a vague understanding of how money moves through their lives. This comprehensive guide will teach you advanced techniques for mapping, analyzing, and optimizing your cash flow to build wealth more effectively.

## Understanding Cash Flow vs. Budget

While budgets are plans for spending, cash flow analysis reveals what actually happens to your money. It's the difference between a map and a GPS tracker—one shows intended route, the other shows the actual journey.

### The Three Dimensions of Cash Flow

1. **Timing**: When money comes in and goes out
2. **Volume**: How much flows at each point
3. **Velocity**: How quickly money moves through your accounts

## Building Your Cash Flow Statement: The Experian Method

### Creating Your Personal Cash Flow Statement

Drawing from business principles, your personal cash flow statement has three main components:

#### 1. Operating Cash Flow (Day-to-Day)
**Inflows:**
- Salary (after-tax)
- Side hustle income
- Dividend payments (if withdrawn)
- Regular business income

**Outflows:**
- Essential fixed costs (rent, insurance, minimum debt payments)
- Essential variable costs (groceries, utilities, gas)
- Discretionary spending (entertainment, dining out)
- Voluntary savings (treated as outflow)

#### 2. Investing Cash Flow
**Inflows:**
- Sale of investments
- Dividend/interest payments reinvested then withdrawn

**Outflows:**
- Investment purchases
- Retirement contributions
- Education savings

#### 3. Financing Cash Flow
**Inflows:**
- Loan proceeds
- Credit card cash advances
- Money borrowed from family/friends

**Outflows:**
- Principal debt payments
- Interest payments
- Credit card payments

### Step-by-Step Implementation

#### Week 1: Data Collection
1. **Download 3 months of bank statements** from all accounts
2. **Export credit card statements** for the same period
3. **Gather investment account statements**
4. **List all cash transactions** (use photos of receipts)

#### Week 2: Categorization
Using NetSuite's business cash flow principles adapted for personal use:

**Essential Fixed (Predictable amounts and timing):**
- Rent/mortgage
- Insurance premiums
- Phone bill
- Subscription services

**Essential Variable (Necessary but amounts vary):**
- Groceries
- Utilities
- Gas
- Medical expenses

**Discretionary (Optional spending):**
- Entertainment
- Hobbies
- Travel
- Shopping

**Irregular But Predictable:**
- Annual insurance payments
- Property taxes
- Holiday/gift expenses
- Car maintenance

#### Week 3: Analysis Phase

**Calculate Key Metrics:**

1. **Free Cash Flow** = Total Income - All Expenses - Mandatory Savings
   - This shows your true discretionary income
   - Positive FCF: Opportunity to increase savings/investments
   - Negative FCF: Immediate action needed

2. **Cash Flow Velocity** = Days money stays in each account / Total days
   - Optimal targets:
     - Emergency fund: 180+ days (stable)
     - Checking account: 15-30 days (flowing)
     - Savings goals: 90+ days (accumulating)

3. **Expense Growth Rate** = (Current month - Previous month) / Previous month
   - Track monthly to identify troubling trends
   - Benchmark against income growth

### Advanced Analysis Techniques from NetSuite

#### Scenario Planning
Create three scenarios for the next 12 months:

**Base Case (Current Path):**
- Income stays constant
- Expenses grow at historical rate
- No major life changes

**Optimistic Case:**
- 10% income increase (promotion, side hustle growth)
- 5% expense reduction through optimization
- No unexpected major expenses

**Pessimistic Case:**
- 20% income decrease (job loss, hour reduction)
- 15% expense increase (inflation, emergencies)
- Dip into emergency fund

#### Cash Flow Red Flags to Monitor

From NetSuite's business warning indicators, adapted:

1. **Increasing Credit Card Balances**
   - Month-over-month balance growth
   - Rising minimum payments
   - Using cards for necessities

2. **Depleting Emergency Funds**
   - Regular withdrawals for non-emergencies
   - Shrinking balance without replacement plan
   - Using for discretionary spending

3. **Rising Expense-to-Income Ratio**
   - Total expenses growing faster than income
   - Lifestyle inflation outpacing raises
   - Debt service consuming larger percentage

4. **Delayed Bill Payments**
   - Consistently paying bills late in cycle
   - Juggling payment dates
   - Using credit for regular bills

5. **Borrowing for Daily Expenses**
   - Credit cards for groceries, gas
   - Payday loans or cash advances
   - Borrowing from retirement accounts

## Optimization Strategies

### The NetSuite Approach: Strategic Cash Flow Management

#### 1. Timing Optimization
- **Align Bill Due Dates**: Schedule payments shortly after payday
- **Annual Payment Discounts**: Pay insurance/subscriptions annually for 5-10% savings
- **Credit Card Float**: Use rewards cards, pay full balance monthly for 25-30 day free loans

#### 2. Cash Flow Buffers
Create strategic buffers in your system:

**Checking Buffer**: 0.5x monthly expenses
- Prevents overdrafts
- Smooths irregular income
- Reduces financial stress

**Bill Buffer Account**: Separate account for fixed costs
- Automate transfers on payday
- Prevents spending bill money
- Simplifies monthly planning

**Opportunity Buffer**: For investments/windfalls
- Capture unexpected income
- Enable quick investment decisions
- Build wealth during market dips

#### 3. Leak Detection and Elimination

**The Experian Audit Method:**

**Subscription Creep**: Average person has 12+ subscriptions
- Review monthly for unused services
- Use apps like Truebill to identify forgotten subscriptions
- Cancel or downgrade services not actively used

**Convenience Fees**: Death by a thousand cuts
- ATM fees, delivery charges, rush payments
- Calculate annual cost (often $500-1,000+)
- Create systems to avoid these fees

**Energy Vampires**: Recurring inefficiencies
- Bank fees for minimum balances
- Interest on carried balances
- Inefficient insurance bundling
- Sub-optimal tax withholding

### Advanced Cash Flow Forecasting

#### 12-Month Rolling Forecast

Create a detailed month-by-month projection:

**Month 1-3 (Detailed):**
- Specific income dates and amounts
- Exact bill due dates and amounts
- Planned major purchases or windfalls

**Month 4-6 (Modeled):
- Seasonal adjustments (summer utilities, holiday expenses)
- Known life changes (lease renewal, insurance annual payments)
- Investment goals and timeline

**Month 7-12 (Strategic):
- Annual goal progress check-ins
- Major financial milestones
- Long-term optimization opportunities

#### Seasonal Cash Flow Planning

**High-Expense Months**: December (holidays), September (back-to-school), June (weddings/travel)
- Build cash reserves 3 months prior
- Adjust spending in preceding months
- Plan income timing around these periods

**Low-Expense Months**: January, February, August
- Maximize savings and investments
- Make extra debt payments
- Build buffers for upcoming high-expense periods

## Technology Integration

### Recommended Tools Stack:

**Bank Account Analysis**: Most banks now offer spending categorization
- Review monthly spending reports
- Set up alerts for unusual spending
- Use automatic categorization as starting point

**Cash Flow Apps**: Mint, YNAB, PocketGuard
- Real-time cash flow monitoring
- Automated categorization with manual review
- Trend analysis and forecasting

**Advanced Spreadsheet Models**:
- Build 12-month rolling forecasts
- Create scenario analysis capabilities
- Link to bank account exports for automatic updates

## Taking Action: Your 30-Day Implementation Plan

### Week 1: Foundation
- Gather all financial account information
- Set up automatic downloads or manual export routine
- Choose primary tracking method (app or spreadsheet)

### Week 2: Analysis
- Categorize 3 months of historical spending
- Calculate current cash flow metrics
- Identify top 3 optimization opportunities

### Week 3: Optimization
- Implement timing improvements (bill scheduling)
- Set up buffer accounts and automatic transfers
- Cancel identified subscription/service leaks

### Week 4: Forecasting
- Build 12-month cash flow projection
- Create monitoring routine and review schedule
- Set up alerts and tracking systems

## Conclusion

Mastering cash flow analysis transforms you from someone who reacts to money problems to someone who anticipates and prevents them. By understanding not just where your money goes, but when and how it moves, you create opportunities to optimize, grow wealth, and reduce financial stress.

The goal isn't perfection—it's continuous improvement and awareness. Start with the basic cash flow statement, then gradually add advanced techniques as you become more comfortable with the process. Your future financial self will thank you for the insight and control this analysis provides.`
          },
          {
            type: "video",
            depth: ["comprehensive", "expert"],
            title: "Forecasting Your Financial Future: A Step-by-Step Guide",
            url: "https://www.youtube.com/embed/7S_tz1z_5bA",
            description: "Master cash flow projections and seasonal financial planning"
          },
          {
            type: "cash_flow_calculator",
            depth: ["comprehensive", "expert"],
            title: "Interactive Cash Flow Calculator",
            inputs: {
              monthlyIncome: { label: "Monthly Income ($)", type: "number", placeholder: "5000" },
              fixedExpenses: { label: "Fixed Expenses ($)", type: "number", placeholder: "2000" },
              variableExpenses: { label: "Variable Expenses ($)", type: "number", placeholder: "1500" },
              savingsGoal: { label: "Savings Goal ($)", type: "number", placeholder: "500" },
              annualBonus: { label: "Annual Bonus ($)", type: "number", placeholder: "0", optional: true }
            },
            scenarios: ["Current Path", "Optimistic", "Conservative"]
          }
        ]
      },
      {
        id: 3,
        title: "Behavioral Economics in Personal Finance",
        type: "research_deep_dive",
        contentBlocks: [
          {
            type: "markdown_text",
            depth: ["overview", "comprehensive", "expert"],
            title: "Overcoming Your Brain's Biases: Behavioral Finance for Everyday Decisions",
            value: `# Overcoming Your Brain's Biases: Behavioral Finance for Everyday Decisions

Your brain is wired with ancient survival mechanisms that often sabotage modern financial decisions. Understanding these psychological biases and how to counteract them is the key to making better money choices and building lasting wealth.

## The Psychology Behind Money Decisions

Traditional economic theory assumes people make rational financial decisions based on perfect information and logical analysis. Behavioral finance reveals the truth: our brains use mental shortcuts (heuristics) and are influenced by emotions, social pressures, and cognitive biases that can lead to costly financial mistakes.

## Major Cognitive Biases in Personal Finance

### 1. Anchoring Bias

**What It Is**: The tendency to rely heavily on the first piece of information encountered (the "anchor") when making decisions.

**How It Affects Your Money**:
- **Retail pricing**: "Was $100, now $70!" makes $70 seem like a deal, regardless of true value
- **Salary negotiations**: The first number mentioned becomes the reference point for all future discussions
- **Investment decisions**: Purchase price becomes an irrelevant anchor for selling decisions
- **Home buying**: List price anchors your offer, even if the home is overpriced for the market

**Real-World Example**: You see a jacket originally priced at $200, now on sale for $120. The $200 anchor makes $120 seem reasonable, even though similar jackets elsewhere cost $80.

**Combat Strategies**:
1. **Research before shopping**: Know market prices before seeing any specific price tags
2. **Use multiple anchors**: Compare several options before making any decision
3. **Question the anchor**: Ask yourself "Is this reference point relevant to my situation?"
4. **Create your own anchors**: Set spending limits before shopping or price ranges before house hunting

### 2. Loss Aversion

**What It Is**: The psychological principle that the pain of losing is approximately twice as powerful as the pleasure of gaining the same amount.

**How It Affects Your Money**:
- **Holding losing investments**: Refusing to sell stocks at a loss, hoping they'll recover
- **Insurance over-purchasing**: Buying excessive coverage to avoid any potential loss
- **Missed opportunities**: Avoiding reasonable investment risks due to fear of any loss
- **Sunk cost fallacy**: Continuing bad financial decisions because you've already invested money

**Real-World Example**: You bought a stock at $50. It's now worth $30. You refuse to sell because "taking the loss" feels worse than the logical decision to invest that $30 elsewhere for better returns.

**Combat Strategies**:
1. **Pre-commit to rules**: Set stop-loss limits before investing and stick to them
2. **Reframe losses**: Consider the opportunity cost of holding vs. the paper loss of selling
3. **Regular portfolio review**: Evaluate each holding objectively, ignoring purchase prices
4. **Focus on future returns**: Past prices are irrelevant

### 3. Mental Accounting

**What It Is**: Treating money differently based on its source, intended use, or account type, despite money being fungible (one dollar equals one dollar regardless of source).

**How It Affects Your Money**:
- **Tax refund splurging**: Treating refunds as "free money" instead of returned overpayment
- **Credit card vs. cash**: Spending more when using cards because it doesn't feel like "real money"
- **Separate account irrationality**: Keeping money in low-interest savings while carrying high-interest debt
- **Windfall waste**: Spending bonuses on luxuries while struggling with daily expenses

**Real-World Example**: You meticulously budget your salary but spend your $2,000 tax refund on vacation, even though you have $3,000 in credit card debt at 24% interest.

**Combat Strategies**:
1. **View money holistically**: All dollars are equal regardless of source
2. **Optimize globally**: Consider your total financial picture when making decisions
3. **Automate good behavior**: Treat all income streams with the same budgeting discipline
4. **Regular rebalancing**: Periodically move money to its highest-value use

### 4. Herd Mentality

**What It Is**: The tendency to follow the financial decisions of the crowd, often without understanding the reasoning behind those decisions.

**How It Affects Your Money**:
- **Investment bubbles**: Buying stocks because "everyone else is making money"
- **Panic selling**: Selling during market downturns because others are fearful
- **Lifestyle inflation**: Spending more because peers are spending more
- **FOMO investing**: Jumping into investments because of social media hype

**Real-World Example**: In 2021, many people bought cryptocurrency or "meme stocks" not based on fundamental analysis, but because social media was filled with success stories from others.

**Combat Strategies**:
1. **Do independent research**: Understand any investment before committing money
2. **Create investment rules**: Establish criteria that must be met regardless of market sentiment
3. **Limit financial social media**: Reduce exposure to hype and fear-based content
4. **Focus on your goals**: Make decisions based on your timeline and risk tolerance

### 5. Confirmation Bias

**What It Is**: Seeking information that confirms existing beliefs while ignoring contradictory evidence.

**How It Affects Your Money**:
- **Investment research**: Only reading positive news about stocks you own
- **Budget denial**: Ignoring spending data that contradicts your self-image
- **Debt rationalization**: Finding reasons why your debt situation is "different" or acceptable
- **Get-rich-quick schemes**: Believing unrealistic promises because they align with desires

**Combat Strategies**:
1. **Seek contradictory information**: Actively look for reasons why your financial decisions might be wrong
2. **Use objective metrics**: Let data, not emotions, guide financial decisions
3. **Get outside perspectives**: Ask trusted friends or advisors to challenge your thinking
4. **Regular financial audits**: Honestly assess your progress against goals

## The Neuroscience of Financial Decision-Making

### System 1 vs. System 2 Thinking

**System 1 (Fast, Automatic)**:
- Emotional responses to money
- Instant gratification seeking
- Pattern recognition and shortcuts
- Where most biases originate

**System 2 (Slow, Deliberate)**:
- Logical analysis of financial decisions
- Long-term planning and goal setting
- Mathematical calculations
- Where good financial decisions are made

### The Marshmallow Test and Financial Success

Stanford's famous marshmallow experiment revealed that children who could delay gratification (wait for two marshmallows instead of eating one immediately) had better life outcomes decades later. This same principle applies to adult financial decisions:

- **Immediate gratification**: Buying now, paying later with credit
- **Delayed gratification**: Saving now for larger purchases, investing for compound growth

## Designing Your Financial Environment

### Choice Architecture: Setting Yourself Up for Success

The environment you create dramatically influences your financial decisions. By designing your surroundings thoughtfully, you can make good choices automatic and bad choices difficult.

#### Physical Environment Design

**Make Good Behaviors Easy**:
- Keep investment account information easily accessible
- Place retirement planning documents prominently on your desk
- Use apps that make saving and investing simple and visible
- Create a dedicated space for monthly financial reviews

**Make Bad Behaviors Hard**:
- Remove shopping apps from your phone's home screen
- Unsubscribe from promotional emails that encourage spending
- Leave credit cards at home when going to places you overspend
- Use cash envelopes for problem spending categories

#### Digital Environment Optimization

**Automate Good Decisions**:
- Automatic transfers to savings on payday
- Automatic investment contributions
- Automatic bill payments to avoid late fees
- Automatic credit card payments to avoid interest

**Create Friction for Bad Decisions**:
- Remove saved payment information from shopping websites
- Set up spending alerts that require conscious acknowledgment
- Use apps that create delays before large purchases
- Set up account notifications for any spending over set amounts

### Commitment Devices and Pre-Commitment

Pre-commit to good financial decisions when your rational mind is in control, before emotions and biases can interfere.

#### Financial Commitment Strategies

1. **Automatic Escalation**:
   - Set up automatic increases to retirement contributions
   - Schedule annual increases to savings rates
   - Use "Save the Raise" programs that bank salary increases

2. **Social Commitment**:
   - Share financial goals with accountability partners
   - Join financial challenges with friends or online communities
   - Make public commitments to spending reduction or saving goals

3. **Institutional Commitment**:
   - Use CDs or other accounts with withdrawal penalties
   - Set up separate banks for savings to create access friction
   - Use employer programs that make good financial choices default

## Building Better Financial Habits

### Understanding the Habit Loop

Every habit follows a three-step pattern:
1. **Cue**: Environmental trigger that initiates the behavior
2. **Routine**: The behavior itself
3. **Reward**: The benefit your brain receives, which reinforces the loop

#### Designing Positive Financial Habits

**Good Habit Example: Daily Expense Tracking**
- **Cue**: Morning coffee routine
- **Routine**: Review yesterday's spending while drinking coffee
- **Reward**: Sense of control and awareness of financial progress

**Bad Habit Replacement: Impulse Spending**
- **Old**: See sale email (cue) → buy something (routine) → temporary excitement (reward)
- **New**: See sale email (cue) → add to wishlist and wait 24 hours (routine) → pride in self-control (reward)

### Practical Decision-Making Frameworks

#### The 10-10-10 Rule
Before any significant financial decision, ask:
- How will I feel about this decision in 10 minutes?
- How will I feel about this decision in 10 months?
- How will I feel about this decision in 10 years?

This framework helps overcome present bias by forcing consideration of future consequences.

#### The Opportunity Cost Framework
For every financial decision, explicitly consider: "If I spend $X on this, I'm choosing not to:"
- Invest $X for future wealth building
- Pay down $X in high-interest debt  
- Save $X for important goals
- Donate $X to causes I care about

#### The Sleep Test
Never make major financial decisions (over $500 or 1% of annual income) immediately. Sleep on it, and if you still want to proceed after 24-48 hours, then consider moving forward.

## Behavioral Nudges for Better Money Management

### Nudge Techniques You Can Implement

1. **Default Options**: Make the good choice the default
   - Auto-enroll in retirement plans with automatic increases
   - Default to saving tax refunds rather than spending

2. **Visual Reminders**: Use images to reinforce goals
   - Pictures of financial goals on credit cards
   - Charts showing progress toward debt freedom

3. **Social Proof**: Leverage others' positive behaviors
   - Join communities of people with similar financial goals
   - Share progress updates to maintain accountability

4. **Loss Framing**: Present choices in terms of what you might lose
   - "You'll miss out on $100,000 in retirement by not starting now" vs. "You'll gain $100,000 by starting now"

## Advanced Behavioral Strategies

### Mental Models for Better Decision-Making

#### The Sunk Cost Recognition Model
**Principle**: Past investments are irrelevant to future decisions.
**Application**: When deciding whether to continue any financial commitment, ignore what you've already spent and focus only on future costs and benefits.

#### The Compound Interest Mindset
**Principle**: Small, consistent actions compound over time.
**Application**: Focus on systems and habits rather than one-time decisions. A $5 daily coffee habit costs $1,825 annually and $91,250 over 20 years (assuming 7% investment returns on the saved money).

#### The Personal Inflation Hedging Model
**Principle**: Your lifestyle tends to inflate with income increases unless consciously managed.
**Application**: Pre-commit to banking 50% of any raise or bonus before lifestyle inflation can take hold.

## Implementation: Your Bias-Busting Action Plan

### Week 1: Awareness Building
1. Take a financial bias assessment to identify your strongest biases
2. Track one week of spending decisions and identify bias influences
3. Set up environmental changes to support better decisions

### Week 2: System Design
1. Create pre-commitment strategies for your biggest financial challenges
2. Set up automatic systems for saving and investing
3. Design decision-making frameworks for future use

### Week 3: Habit Formation
1. Implement one new positive financial habit
2. Replace one negative financial habit with a positive alternative
3. Create accountability systems and tracking methods

### Week 4: Optimization
1. Review and refine the systems you've created
2. Add additional behavioral nudges based on what's working
3. Plan for ongoing maintenance and improvement

## Conclusion

Understanding and managing your behavioral biases is perhaps the most important financial skill you can develop. Your brain's shortcuts and emotional responses evolved for a different world, and they often work against your modern financial best interests.

The good news is that awareness is the first step toward improvement. By understanding how these biases work, designing better environments, and implementing systems that work with your psychology rather than against it, you can dramatically improve your financial outcomes.

Remember: the goal isn't to eliminate all biases (which is impossible), but to recognize them and create systems that help you make better decisions despite them. Start with the biases that most affect your specific situation, implement gradual changes, and build on your successes over time.

Your future financial self will thank you for taking control of not just your money, but the psychological factors that drive your money decisions.`
          },
          {
            type: "video",
            depth: ["comprehensive", "expert"],
            title: "The Psychology of Spending: How to Hack Your Financial Habits",
            url: "https://www.youtube.com/embed/gzcw_02ZB1o",
            description: "Understand the psychology behind financial decisions and build better money habits"
          },
          {
            type: "bias_identification_quiz",
            depth: ["comprehensive", "expert"],
            title: "Bias Identification Quiz",
            questions: [
              {
                id: 1,
                scenario: "Shopping Scenario",
                question: "You see a designer watch originally priced at $500, now 'on sale' for $300. You don't need a watch, but the discount seems amazing. What do you do?",
                options: [
                  { text: "Buy it immediately - it's 40% off!", bias: "anchoring" },
                  { text: "Wait a day to think about it", bias: "none" },
                  { text: "Research similar watches online first", bias: "confirmation" },
                  { text: "Pass - you don't need a watch", bias: "resistant" }
                ]
              },
              {
                id: 2,
                scenario: "Investment Loss",
                question: "Your stock investment is down 30%. The company's fundamentals haven't changed. What's your move?",
                options: [
                  { text: "Hold forever until it recovers", bias: "loss_aversion" },
                  { text: "Buy more while it's 'cheap'", bias: "overconfidence" },
                  { text: "Re-evaluate objectively and decide", bias: "none" },
                  { text: "Sell immediately to stop losses", bias: "present" }
                ]
              },
              {
                id: 3,
                scenario: "Unexpected Money",
                question: "You receive a $2,000 tax refund. What's your first instinct?",
                options: [
                  { text: "Treat it as 'fun money' for something special", bias: "mental_accounting" },
                  { text: "Put it toward your highest-interest debt", bias: "none" },
                  { text: "Split between saving and spending", bias: "none" },
                  { text: "Invest in that 'hot stock tip' from a friend", bias: "overconfidence" }
                ]
              },
              {
                id: 4,
                scenario: "Retirement Planning",
                question: "When thinking about retirement saving, you:",
                options: [
                  { text: "Feel it's too far away to worry about now", bias: "present" },
                  { text: "Are confident your investments will outperform", bias: "overconfidence" },
                  { text: "Save steadily but worry it's not enough", bias: "loss_aversion" },
                  { text: "Have automated contributions you rarely think about", bias: "none" }
                ]
              },
              {
                id: 5,
                scenario: "Financial Information",
                question: "When researching financial decisions, you typically:",
                options: [
                  { text: "Look for information supporting what you want to do", bias: "confirmation" },
                  { text: "Get overwhelmed and procrastinate", bias: "present" },
                  { text: "Trust your gut over expert advice", bias: "overconfidence" },
                  { text: "Seek diverse viewpoints before deciding", bias: "none" }
                ]
              }
            ],
            profiles: {
              anchoring: {
                name: "Anchoring/Framing Vulnerable",
                description: "You're particularly susceptible to how information is presented. Retailers and marketers know this and use it against you.",
                actionPlan: [
                  "Always research baseline prices before shopping",
                  "Create your own anchors with spending limits",
                  "Use the 24-hour rule for non-essential purchases",
                  "Question why prices are what they are"
                ]
              },
              loss_aversion: {
                name: "Loss Aversion Dominant",
                description: "You feel losses deeply, which can paralyze your financial progress. This bias keeps you in suboptimal situations.",
                actionPlan: [
                  "Reframe losses as learning investments",
                  "Set predetermined exit strategies",
                  "Focus on opportunity costs",
                  "Practice with small 'losses' to build tolerance"
                ]
              },
              present: {
                name: "Present Bias Affected",
                description: "You struggle with delayed gratification, preferring immediate rewards. This is the most common bias affecting financial success.",
                actionPlan: [
                  "Automate all savings and investments",
                  "Use apps that make saving feel immediate",
                  "Visualize your future self regularly",
                  "Celebrate small wins to stay motivated"
                ]
              },
              overconfidence: {
                name: "Overconfidence Prone",
                description: "You trust your judgment, perhaps too much. This confidence can lead to concentrated risks and missed opportunities.",
                actionPlan: [
                  "Track all predictions and outcomes",
                  "Diversify by default",
                  "Seek contrarian viewpoints",
                  "Use rules-based systems over discretion"
                ]
              },
              mental_accounting: {
                name: "Mental Accounting Affected",
                description: "You treat money differently based on arbitrary categories, leading to inefficient financial decisions.",
                actionPlan: [
                  "View all money as fungible",
                  "Optimize globally",
                  "Automate to reduce mental categories",
                  "Regular holistic financial reviews"
                ]
              }
            }
          }
        ]
      }
    ]
  },
  {
    id: "investment-theory",
    title: "Build Wealth Like a Pro: Master Investment Theory & Portfolio Design",
    description: "From first-time investor to confident portfolio manager. Understand core principles, diversification, and behavioral finance.",
    difficulty: "Intermediate",
    duration: "45 min",
    icon: "📈",
    category: "Investing",
    heroTitle: "Build Wealth Like a Pro: Master Investment Theory & Portfolio Design",
    heroSubtitle: "From first-time investor to confident portfolio manager in 45 minutes",
    learningOutcomes: [
      "What stocks, bonds, and other investments actually are",
      "How to build a smart, diversified portfolio",
      "How to avoid common psychological traps that hurt investors",
      "How to create your personal investing plan"
    ],
    expertTopics: ["Modern Portfolio Theory", "Asset Allocation", "Risk Management", "Behavioral Finance"],
    lessons: [
      {
        id: 1,
        title: "Investment Fundamentals & Asset Classes",
        type: "comprehensive_analysis",
        contentBlocks: [
          {
            type: "markdown_text",
            depth: ["overview", "comprehensive", "expert"],
            title: "The Building Blocks of Wealth",
            value: `
# The Building Blocks of Wealth

Investments are grouped into **asset classes**. Think of them like tools: each works differently, and combining them makes your portfolio stronger.

## Major Asset Classes

### 📈 Stocks (Equities): High Growth, High Risk
- **What they are:** Own a slice of a company (e.g., Apple, Tesla)
- **Best for:** Long-term growth, retirement savings
- **Risk level:** High volatility, but smooths out over time
- **Expected returns:** ~10% annually (historical average)

### 🏛️ Bonds: Steady and Lower Risk  
- **What they are:** You lend money and earn interest
- **Best for:** Income generation, portfolio stability
- **Risk level:** Lower volatility than stocks
- **Expected returns:** ~5-6% annually

### 🏠 Real Estate: Tangible Assets
- **What they are:** Physical property or REITs (Real Estate Investment Trusts)
- **Best for:** Income + inflation hedge
- **Risk level:** Moderate, less correlated with stocks
- **Expected returns:** ~8-9% annually including appreciation

### 🥇 Commodities: Raw Materials
- **What they are:** Gold, oil, agricultural products
- **Best for:** Inflation hedge, crisis protection
- **Risk level:** High volatility
- **Expected returns:** Varies widely by commodity

### 💵 Cash & Equivalents: Safety First
- **What they are:** Savings accounts, CDs, money market funds
- **Best for:** Emergency funds, short-term goals
- **Risk level:** Very low
- **Expected returns:** ~2-3% annually

### 🚀 Alternatives: The Wild Card
- **What they are:** Crypto, private equity, hedge funds
- **Best for:** Experienced investors seeking diversification
- **Risk level:** Very high and complex
- **Expected returns:** Highly variable

## The Risk-Return Relationship

The fundamental rule of investing: **higher risk = higher potential reward** (if you stay invested long enough). The key is finding the right balance for your goals and timeline.

**Risk Ladder (Low to High Risk & Reward):**
Cash → Bonds → Stocks → Real Estate → Commodities → Alternatives

## Key Takeaways

- **Mix asset classes** to balance growth + safety
- **Stocks are long-term engines** - best for goals 5+ years away  
- **Cash = stability & liquidity**, not growth
- **Bonds smooth volatility** and provide steady income
- **Real estate & alternatives** add diversification beyond stocks and bonds
            `
          },
          {
            type: "video",
            depth: ["overview", "comprehensive"],
            title: "Asset Classes Explained: Your Investment Toolkit",
            url: "https://www.youtube.com/embed/T71ibcZAX3I",
            description: "Visual breakdown of different investment types and how they work together"
          },
          {
            type: "asset_class_quiz",
            depth: ["comprehensive", "expert"],
            title: "Match Assets to Goals Quiz",
            questions: [
              {
                id: 1,
                question: "You need to build an emergency fund (3 months of expenses). Which asset fits best?",
                options: [
                  { text: "Stocks - for maximum growth potential", value: "wrong", feedback: "Stocks are too volatile for emergency funds. You might need to sell at a loss." },
                  { text: "Bonds - for steady returns", value: "close", feedback: "Bonds are better than stocks, but you need immediate access to emergency money." },
                  { text: "Cash equivalents - for safety and liquidity", value: "correct", feedback: "Correct! Emergency funds need to be safe and immediately accessible." }
                ]
              },
              {
                id: 2,
                question: "You're 25 and saving for retirement (40+ years away). What should be your main focus?",
                options: [
                  { text: "Stocks - for long-term growth", value: "correct", feedback: "Exactly! With decades to invest, you can ride out stock market volatility for higher returns." },
                  { text: "Bonds - for steady income", value: "wrong", feedback: "Bonds are too conservative for a 40-year timeline. You're missing out on growth." },
                  { text: "Cash - to avoid any losses", value: "wrong", feedback: "Cash won't beat inflation over 40 years. You'll lose purchasing power." }
                ]
              },
              {
                id: 3,
                question: "You want steady income while preserving your capital. What's your best choice?",
                options: [
                  { text: "Growth stocks - they might pay big dividends", value: "wrong", feedback: "Growth stocks typically reinvest profits rather than pay dividends." },
                  { text: "Investment-grade bonds - predictable income", value: "correct", feedback: "Perfect! Bonds provide regular interest payments and return your principal at maturity." },
                  { text: "Commodities - gold always holds value", value: "wrong", feedback: "Commodities don't generate income and can be very volatile." }
                ]
              }
            ]
          },
          {
            type: "risk_tolerance_assessment",
            depth: ["comprehensive", "expert"],
            title: "Discover Your Risk Tolerance & Get Your Asset Allocation",
            assessment: {
              questions: [
                {
                  id: "q1",
                  question: "When you invest, you are:",
                  options: [
                    { text: "More concerned about potential losses than potential gains", value: 1 },
                    { text: "Equally concerned about losses and gains", value: 3 },
                    { text: "More concerned about potential gains than potential losses", value: 5 }
                  ]
                },
                {
                  id: "q2",
                  question: "If you owned a stock that lost 20% in a month, you would:",
                  options: [
                    { text: "Sell immediately to prevent further losses", value: 1 },
                    { text: "Do nothing and wait for it to recover", value: 3 },
                    { text: "Buy more shares since it's now cheaper", value: 5 }
                  ]
                },
                {
                  id: "q3",
                  question: "How would you describe your investment knowledge?",
                  options: [
                    { text: "Beginner - still learning the basics", value: 1 },
                    { text: "Intermediate - understand most concepts", value: 3 },
                    { text: "Advanced - confident in my abilities", value: 5 }
                  ]
                },
                {
                  id: "q4",
                  question: "What is your preferred investment timeframe?",
                  options: [
                    { text: "Short-term (1-3 years)", value: 1 },
                    { text: "Medium-term (3-10 years)", value: 3 },
                    { text: "Long-term (10+ years)", value: 5 }
                  ]
                },
                {
                  id: "q5",
                  question: "Your portfolio drops 30% during a market crash. What's your reaction?",
                  options: [
                    { text: "Panic and sell everything to stop the losses", value: 1 },
                    { text: "Feel worried but stick to my plan", value: 3 },
                    { text: "See it as a buying opportunity and invest more", value: 5 }
                  ]
                }
              ],
              allocation_models: {
                conservative: { stocks: 30, bonds: 50, real_estate: 10, commodities: 5, cash: 5 },
                moderate: { stocks: 60, bonds: 25, real_estate: 10, commodities: 3, cash: 2 },
                aggressive: { stocks: 80, bonds: 10, real_estate: 7, commodities: 3, cash: 0 }
              },
              recommendations: {
                conservative: "You prioritize capital preservation over growth. This allocation provides stability with modest growth potential through a higher allocation to bonds and cash, while still including some stocks for long-term growth.",
                moderate: "You seek a balance between growth and stability. This allocation captures stock market growth while using bonds to cushion volatility, making it suitable for most long-term investors.",
                aggressive: "You're comfortable with higher risk for greater potential returns. This portfolio maximizes long-term growth through a heavy stock allocation, ideal for young investors with long time horizons."
              }
            }
          }
        ]
      },
      {
        id: 2,
        title: "Portfolio Theory & Diversification Strategies",
        type: "advanced_analysis",
        contentBlocks: [
          {
            type: "markdown_text",
            depth: ["overview", "comprehensive", "expert"],
            title: "Why Diversification Works (Nobel Prize-Winning Strategy)",
            value: `
# Why Diversification Works (Nobel Prize-Winning Strategy)

Harry Markowitz won a Nobel Prize for proving something wild: **a basket of risky investments can be *less risky* than any single one inside it**—if they don't move in sync.

## The Magic of Modern Portfolio Theory

### The Efficient Frontier Simplified
The **Efficient Frontier** is the sweet spot where you get the *most return for the least risk*. Portfolios below it are suboptimal.

**Translation:** Diversify properly, and you get better outcomes without taking extra risk.

## Sample Age-Based Allocations

### 🚀 Aggressive (20s-30s): Maximum Growth
- **85% Stocks** / 10% Bonds / 5% Cash & Alternatives  
- **Why:** Decades to recover from downturns, prioritize growth
- **Risk level:** High volatility, high long-term returns

### ⚖️ Moderate (30s-40s): Balanced Approach  
- **60% Stocks** / 30% Bonds / 10% Alternatives
- **Why:** Still growing but with more stability as goals get closer
- **Risk level:** Moderate volatility, steady growth

### 🛡️ Conservative (50s+): Capital Preservation
- **40% Stocks** / 50% Bonds / 10% Cash & Alternatives
- **Why:** Protecting wealth as retirement approaches
- **Risk level:** Lower volatility, modest growth

## True Diversification: Beyond Just "Mix Things Up"

### ❌ Common Diversification Mistakes:
- **Owning only tech stocks** = NOT diversified (all same sector)
- **Ignoring global markets:** 60% of world's companies are non-US
- **Forgetting bonds or real estate** = missing key asset classes
- **Home country bias** = overweighting your own country's market

### ✅ Real Diversification Strategy:
- **Spread across asset classes:** Stocks, bonds, real estate, commodities
- **Geographic diversification:** US, developed international, emerging markets  
- **Sector diversification:** Technology, healthcare, finance, consumer goods
- **Company size mix:** Large-cap, mid-cap, small-cap stocks
- **Style diversification:** Growth and value stocks

## The Correlation Factor

**Key insight:** Assets that move in opposite directions (negative correlation) or independently (low correlation) reduce overall portfolio risk.

**Examples:**
- Stocks and bonds often move in opposite directions
- US and international markets don't always move together  
- Real estate provides diversification from stocks
- Gold often rises when stocks fall (crisis hedge)

## Building Your Efficient Portfolio

The goal isn't to eliminate risk—it's to get **paid appropriately for the risk you take**. A well-diversified portfolio:

1. **Reduces unnecessary risk** through smart asset mixing
2. **Maintains growth potential** through equity exposure  
3. **Provides stability** through bond allocation
4. **Offers inflation protection** through real assets
5. **Includes global exposure** for broader opportunities

## Key Takeaways

- **Diversification is the only free lunch in investing** - reduce risk without reducing expected returns
- **Don't put all eggs in one basket** - spread across asset classes, geographies, and sectors
- **Rebalance regularly** - sell high performers, buy underperformers to maintain target allocation
- **Stay disciplined** - resist the urge to chase last year's winners
- **Think global** - don't limit yourself to just US investments
            `
          },
          {
            type: "video",
            depth: ["comprehensive", "expert"],
            title: "Modern Portfolio Theory & The Efficient Frontier Explained",
            url: "https://www.youtube.com/embed/WjhNrhkAZF8",
            description: "Visual explanation of how diversification reduces risk while maintaining returns"
          },
          {
            type: "portfolio_optimizer",
            depth: ["expert"],
            title: "Interactive Portfolio Builder: Find Your Efficient Frontier"
          }
        ],
      },
      {
        id: 3,
        title: "Behavioral Investing & Long-term Wealth Building",
        type: "research_deep_dive",
        contentBlocks: [
          {
            type: "markdown_text",
            depth: ["overview", "comprehensive", "expert"],
            title: "Your Mind vs. The Market: Why Psychology Matters Most",
            value: `
# Your Mind vs. The Market: Why Psychology Matters Most

The #1 reason investors fail? **Psychology.**

Studies show average investors earn **3-7% LESS** than the market because they sell low and buy high, driven by emotions rather than logic.

## Common Behavioral Traps That Destroy Returns

### 🔄 Recency Bias: "What Just Happened Will Keep Happening"
**The trap:** Thinking last month's winner will keep winning, or that a recent crash means more crashes are coming.

**Reality:** Markets are cyclical. Yesterday's winners often become tomorrow's losers.

**Example:** Investors poured money into tech stocks in 1999 (right before the crash) and avoided stocks in 2009 (right before the recovery).

### 😰 Loss Aversion: Feeling Losses Twice as Strongly  
**The trap:** The pain of losing $100 feels twice as strong as the joy of gaining $100.

**Result:** Panic selling during downturns, missing the recovery.

**Reality:** Market drops are normal and temporary. Staying invested pays off.

### 🧠 Overconfidence: "I Can Beat the Market"
**The trap:** Believing you can time the market or pick winning stocks consistently.

**Result:** Excessive trading, higher fees, worse returns than simple index funds.

**Reality:** 90% of professional fund managers can't beat the market long-term.

### 🐑 Herd Mentality: Following the Crowd
**The trap:** Buying when everyone else is buying (market tops) and selling when everyone is selling (market bottoms).

**Result:** Classic "buy high, sell low" behavior.

**Reality:** The best opportunities come when others are fearful.

## The Behavior Gap: How Much Psychology Costs You

**Market Return (S&P 500, 20 years):** 10.5% annually  
**Average Investor Return:** 6.9% annually  
**The Gap:** 3.6% per year lost to poor timing and emotional decisions

**On $10,000 invested:** This gap costs you **$138,000** over 20 years!

## Behavioral Fixes: Automate Success

### 🤖 Solution 1: Automate Everything
- **Automatic investing:** Removes the temptation to time the market
- **Dollar-cost averaging:** Regular investments smooth out volatility  
- **Auto-rebalancing:** Maintains target allocation without emotional interference

### 📋 Solution 2: Create an Investment Policy Statement (IPS)
Write down your:
- Investment goals and timeline
- Target asset allocation  
- Rebalancing rules
- What you'll do during market crashes

**When emotions run high, follow your written plan.**

### ⏰ Solution 3: Set Rebalancing Reminders
- **Quarterly reviews:** Check if allocation is still on target
- **Rebalance when needed:** Sell high performers, buy underperformers
- **Stay disciplined:** This forces you to buy low and sell high

### 🎯 Solution 4: Focus on Time in Market, Not Timing the Market
- **Historical fact:** Missing just the 10 best days over 20 years cuts returns in half
- **The problem:** Those best days often come right after the worst days
- **The solution:** Stay invested through all market conditions

## Building Your Market Downturn Playbook

### When Markets Drop 20%+ (And They Will):

1. **Remember this is normal** - happens every 3-4 years on average
2. **Don't check your portfolio daily** - reduces emotional stress  
3. **Keep investing** - you're buying shares "on sale"
4. **Review your timeline** - if it's 5+ years, stay the course
5. **Consider it a test** - successful investors stay calm during storms

### Historical Perspective:
- **Great Depression (1929):** Market recovered within 4 years
- **2008 Financial Crisis:** Market recovered within 5 years  
- **COVID Crash (2020):** Market recovered within 6 months
- **Every major crash:** Followed by eventual recovery and new highs

## Your Behavioral Action Plan

### ✅ Step 1: Acknowledge Your Biases
Everyone has them. Awareness is the first step to overcoming them.

### ✅ Step 2: Automate Your Investing
Set up automatic transfers and investments to remove emotion from the equation.

### ✅ Step 3: Write Your Investment Policy Statement  
Document your strategy when you're thinking clearly, not during market panic.

### ✅ Step 4: Find an Accountability Partner
Share your goals with someone who will keep you disciplined during tough times.

### ✅ Step 5: Educate Yourself Continuously
The more you understand markets, the less likely you are to make emotional decisions.

## Key Takeaways

- **Psychology, not intelligence, determines investment success**
- **The best investors are often the most boring ones** - they stick to simple strategies
- **Automation beats willpower** - remove yourself from emotional decisions
- **Market downturns are buying opportunities** - if you can stay disciplined
- **Time in the market beats timing the market** - every single time
            `
          },
          {
            type: "investor_bias_quiz",
            depth: ["comprehensive", "expert"],
            title: "Behavioral Self-Check: What Would You Do?"
          },
          {
            type: "market_simulator",
            depth: ["expert"],
            title: "Market Crash Simulator: Test Your Emotional Discipline"
          },
          {
            type: "behavioral_action_plan",
            depth: ["comprehensive", "expert"],
            title: "Create Your Personal Investment Policy Statement"
          }
        ],
      },
    ],
  },
  {
    id: "behavioral-finance",
    title: "Master Your Mind: The Psychology Behind Smart Money Decisions",
    description: "Beat bias, build discipline, and become the investor your future self will thank you for",
    difficulty: "Intermediate to Expert",
    duration: "45 min",
    icon: "🧠",
    category: "Psychology",
    heroTitle: "Master Your Mind: The Psychology Behind Smart Money Decisions",
    heroSubtitle: "Beat bias, build discipline, and become the investor your future self will thank you for",
    learningOutcomes: [
      "Recognize common cognitive biases that harm financial decisions",
      "Understand the 'behavior gap' and why investors underperform markets", 
      "Learn mental models and frameworks to make better money decisions",
      "Build a personal behavior action plan to stay disciplined during market ups and downs"
    ],
    expertTopics: ["Prospect theory", "Nudge theory", "Decision architecture", "Cognitive biases"],
    lessons: [
      {
        id: 1,
        title: "The Psychology of Money – Why We're Wired to Fail",
        type: "theory_application",
        contentBlocks: [
          {
            type: "markdown_text",
            depth: ["overview", "comprehensive", "expert"],
            title: "The Evolutionary Brain vs. Modern Finance",
            value: `
# The Psychology of Money – Why We're Wired to Fail

## The Evolutionary Brain vs. Modern Finance

Your brain is amazing at keeping you alive, but terrible at making you rich. Here's why:

### 🧬 Our Stone Age Brain in a Digital Age

**The Problem:** Your brain evolved over millions of years to handle immediate, physical threats—not abstract financial concepts like compound interest or market volatility.

**Key Mismatches:**
- **Immediate vs. Delayed:** Our brains prioritize instant rewards (spend now) over future benefits (save for later)
- **Concrete vs. Abstract:** We understand "tiger = danger" but struggle with "inflation = wealth erosion"
- **Certain vs. Probable:** We prefer guaranteed small wins over uncertain large gains

### 😰 Fear Beats Greed (By a Lot)

**Loss Aversion:** The pain of losing $100 feels twice as intense as the pleasure of gaining $100. This isn't just psychology—it's neuroscience.

**Why This Matters:**
- We panic-sell during market drops (locking in losses)
- We hold onto bad investments hoping to "break even"
- We avoid investing altogether to prevent any potential risk of loss

### 🚨 Fight or Flight vs. Buy and Hold

When markets crash, your ancient brain screams: **"DANGER! GET OUT NOW!"**

But successful investing requires the opposite: **Stay calm, stick to the plan, maybe even buy more.**

## The Behavior Gap: Why Investors Underperform

### 📊 The Shocking Data

According to DALBAR's annual study of investor behavior:
- **S&P 500 20-year return:** 10.5% annually
- **Average investor return:** 6.9% annually  
- **The Gap:** 3.6% per year lost to poor timing and emotional decisions

**What does this cost you?** On a $10,000 investment over 20 years, this behavior gap costs you **$138,000** in lost wealth.

### 🎢 The Cycle of Investment Destruction

1. **Markets rise:** Investors feel confident, buy more
2. **Markets peak:** Maximum optimism, maximum buying
3. **Markets crash:** Panic sets in, mass selling begins
4. **Markets bottom:** Maximum pessimism, selling continues
5. **Recovery begins:** Investors too scared to buy back in
6. **Repeat:** Missing the recovery, buying high again later

### 📈 Time In Market > Timing the Market

**The Data That Will Change Your Mind:**

If you invested $10,000 in the S&P 500 from 2000-2020:
- **Stayed invested all 20 years:** $32,421 (6.1% annual return)
- **Missed the 10 best days:** $16,312 (2.4% annual return)
- **Missed the 20 best days:** $11,432 (0.7% annual return)
- **Missed the 30 best days:** $8,149 (-1.1% annual return)

**The Kicker:** The best days often come right after the worst days. Miss the crash, miss the recovery.

## Case Study: 2008 Financial Crisis

### The Tale of Two Investors

**Emotional Emma:**
- Watched her portfolio drop 40% in 2008
- Panic-sold everything in March 2009 (near the bottom)
- Stayed in cash until 2012, missing the entire recovery
- Final result: Lost 60% of her wealth

**Disciplined David:**
- Same 40% drop in 2008
- Stayed invested, even added more during the crash
- Portfolio recovered by 2012, hit new highs by 2013
- Final result: 150% wealth increase over the decade

### The Only Difference: Psychology

Both had the same investment options. Emma let emotions drive decisions. David had systems and discipline.

## Why Smart People Make Dumb Money Moves

### 🎓 Intelligence ≠ Investment Success

Studies show **no correlation** between IQ and investment returns. Sometimes smart people do worse because:

- **Overconfidence:** Believing they can outsmart markets
- **Overthinking:** Analysis paralysis leads to poor timing
- **Complexity bias:** Choosing complicated strategies over simple ones

### 🏆 What Actually Predicts Success

1. **Emotional regulation:** Can you stay calm when others panic?
2. **Patience:** Will you stick to long-term plans?
3. **Humility:** Do you know what you don't know?
4. **Systems thinking:** Do you follow processes over emotions?

## The Good News: Biases Can Be Overcome

### 🤖 Your New Best Friend: Automation

The most successful investors remove themselves from daily decisions:
- **Automatic investing:** Money goes to investments before you can spend it
- **Rebalancing rules:** Sell high, buy low automatically
- **Dollar-cost averaging:** Buy the same amount regardless of price

### 📋 Pre-Commitment Strategies

Make decisions when you're thinking clearly, not when markets are moving:
- Write investment rules when markets are calm
- Set up "if-then" scenarios before emotions kick in  
- Use apps and tools that enforce your rules

## Key Takeaways

- **Your brain is your biggest enemy** when investing—it prioritizes survival over wealth-building
- **The behavior gap costs the average investor 3.6% annually**—that's hundreds of thousands over a lifetime
- **Emotional decisions consistently destroy wealth** while disciplined strategies build it
- **Intelligence doesn't predict investment success**—emotional control and systems do
- **Automation and pre-commitment** are your best tools for overcoming psychological biases

**Next up:** We'll identify exactly which biases affect you most and build your personal defense system against them.
            `
          },
          {
            type: "video",
            depth: ["overview", "comprehensive"],
            title: "The Psychology of Money: Why Smart People Make Dumb Financial Decisions",
            url: "https://www.youtube.com/embed/e5qUR3tpEdA",
            description: "Explore the psychological forces that drive poor financial decisions"
          },
          {
            type: "react_to_headlines",
            depth: ["comprehensive", "expert"],
            title: "React to the Headlines: Test Your Emotional Responses",
            scenarios: [
              {
                headline: "MARKET CRASH: Dow Jones Plunges 800 Points in Single Day!",
                subtext: "Your portfolio is down 12% in one week. Financial experts warn of potential recession.",
                options: [
                  { text: "Sell everything immediately to prevent further losses", outcome: "panic_sell", correct: false },
                  { text: "Hold my current investments and wait it out", outcome: "hold", correct: true },
                  { text: "Buy more shares while prices are low", outcome: "buy_dip", correct: true },
                  { text: "Check my portfolio obsessively every hour", outcome: "anxiety", correct: false }
                ],
                correctFeedback: "Great choice! Market downturns are temporary, but panic selling locks in permanent losses.",
                incorrectFeedback: "This is exactly the emotional reaction that destroys wealth. Markets recover, but panic selling doesn't."
              },
              {
                headline: "CRYPTO CRAZE: Bitcoin Hits All-Time High, Your Friend Made $50K!",
                subtext: "Everyone on social media is posting their crypto gains. You're missing out!",
                options: [
                  { text: "FOMO buy crypto with my entire emergency fund", outcome: "fomo_invest", correct: false },
                  { text: "Research crypto carefully and invest only what I can afford to lose", outcome: "measured_approach", correct: true },
                  { text: "Ignore the hype and stick to my existing investment plan", outcome: "discipline", correct: true },
                  { text: "Ask my friend for tips and copy their strategy", outcome: "herd_mentality", correct: false }
                ],
                correctFeedback: "Perfect! FOMO is one of the most expensive emotions in investing. Discipline beats hype every time.",
                incorrectFeedback: "FOMO (Fear of Missing Out) has cost investors billions. When everyone's buying, it's usually time to be cautious."
              }
            ]
          }
        ]
      },
      {
        id: 2,
        title: "Behavioral Biases and How to Beat Them",
        type: "bias_laboratory", 
        contentBlocks: [
          {
            type: "markdown_text",
            depth: ["overview", "comprehensive", "expert"],
            title: "The Big 5 Biases That Destroy Wealth (And How to Beat Them)",
            value: `
# The Big 5 Biases That Destroy Wealth (And How to Beat Them)

Your brain uses shortcuts (called heuristics) to make quick decisions. These shortcuts saved your ancestors from predators, but they can devastate your portfolio. Let's identify and defeat the most dangerous ones.

## 1. 🔴 Loss Aversion: Why Losses Hurt 2X More Than Gains Feel Good

### What It Is
The pain of losing $1,000 feels roughly twice as intense as the pleasure of gaining $1,000. This isn't just psychology—it's measurable brain activity.

### How It Destroys Wealth
- **Panic selling:** You sell during crashes to "stop the bleeding"
- **Holding losers:** You refuse to sell bad investments, hoping to break even
- **Avoiding investing:** You keep money in low-return accounts to avoid any risk of loss

### The Real Cost
**Example:** Sarah bought Apple stock at $150. It drops to $130. Instead of holding (or buying more), she sells to "prevent further losses." Apple recovers to $180 six months later. Her loss aversion cost her $5,000 on a $10,000 investment.

### 🛡️ How to Beat It
1. **Automate everything:** Remove yourself from sell decisions
2. **Reframe losses:** See market drops as "sales" on future wealth
3. **Use percentage thinking:** Focus on long-term percentages, not daily dollar changes
4. **Set stop-losses sparingly:** Only use them for speculative investments, not diversified portfolios

## 2. 🔄 Recency Bias: Why Yesterday's Winner Becomes Tomorrow's Loser

### What It Is
Your brain gives too much weight to recent events and assumes current trends will continue forever.

### How It Destroys Wealth
- **Chasing performance:** Buying last year's hot sectors right before they crash
- **Timing mistakes:** Assuming bull markets last forever (or bear markets never end)  
- **Strategy abandonment:** Switching investment approaches after short-term underperformance

### The Real Cost
**Example:** In 1999, tech stocks had gained 85% in one year. Recency bias made investors pour money into tech funds right before the dot-com crash. Many lost 70%+ of their investments.

### 🛡️ How to Beat It
1. **Study history:** Keep long-term charts handy to see the full cycle
2. **Rebalance regularly:** Force yourself to sell winners and buy losers
3. **Use contrarian signals:** When everyone agrees, be suspicious
4. **Track mean reversion:** What goes up excessively usually comes down

## 3. 🧠 Overconfidence: Why You're Probably Not as Good as You Think

### What It Is
Most people think they're above-average investors (statistically impossible). This leads to excessive trading and concentrated bets.

### How It Destroys Wealth
- **Overtrading:** More transactions = more fees and worse returns
- **Underdiversification:** Putting too much money in "sure thing" investments
- **Market timing attempts:** Believing you can predict short-term movements
- **Ignoring experts:** Dismissing professional advice because "you know better"

### The Real Cost
**Study Result:** Men trade 45% more than women and earn 2.65% less annually. Why? Overconfidence leads to excessive trading.

### 🛡️ How to Beat It
1. **Track your predictions:** Keep a record—most people are wrong 60%+ of the time
2. **Embrace indexing:** Accept that beating the market is extremely difficult
3. **Limit speculative positions:** Keep "stock picking" to <5% of your portfolio
4. **Get second opinions:** Always run big decisions past someone neutral

## 4. 🐑 Herd Behavior: Why Following the Crowd Leads to Slaughter

### What It Is
The psychological pressure to do what everyone else is doing. In investing, this creates bubbles and crashes.

### How It Destroys Wealth
- **Buying at peaks:** FOMO drives you to buy when assets are most expensive
- **Selling at bottoms:** Panic spreads, making you sell when everything's cheap
- **Missing opportunities:** You avoid good investments because they're unpopular
- **Meme stock disasters:** Following social media hype instead of fundamentals

### The Real Cost
**GameStop 2021:** Retail investors piled in at $300+ per share following Reddit hype. Those who bought at the peak lost 80%+ when reality set in.

### 🛡️ How to Beat It
1. **Ask the contrarian question:** "If nobody else was buying this, would I still want it?"
2. **Do independent research:** Make decisions based on facts, not social proof
3. **Embrace unpopular assets:** The best opportunities are often unloved
4. **Limit social media:** Reduce exposure to hype and FOMO-inducing content

## 5. 🧮 Mental Accounting: Why All Money Isn't Created Equal (In Your Mind)

### What It Is
Treating money differently based on its source or intended use, even though all dollars are fungible.

### How It Destroys Wealth
- **Tax refund splurging:** Treating refunds as "free money" instead of returned overpayments
- **Credit card debt + savings:** Keeping money in 2% savings while carrying 24% credit card debt
- **Bonus waste:** Spending bonuses frivolously while struggling with regular expenses
- **House money effect:** Taking bigger risks with investment gains than original capital

### The Real Cost
**Example:** Mike has $5,000 in savings earning 1% while carrying $3,000 in credit card debt at 22%. His mental accounting costs him over $600 per year in unnecessary interest.

### 🛡️ How to Beat It
1. **Think holistically:** All money is just money—optimize across all accounts
2. **Debt avalanche:** Always pay off high-interest debt before saving in low-interest accounts
3. **Windfall rules:** Treat unexpected money with the same discipline as regular income
4. **Regular rebalancing:** Periodically move money to its highest-value use

## The Compounding Effect of Biases

### Why Small Biases Create Big Problems

Individual biases might cost you 1-2% per year. But they compound:
- **Year 1:** You lose 2% to emotional decisions
- **Year 5:** You're 10% behind where you should be
- **Year 20:** You have 40% less wealth than a disciplined investor

### The Bias Cascade Effect

Biases don't work in isolation—they trigger each other:
1. **Overconfidence** makes you buy individual stocks
2. **Recency bias** makes you buy hot sectors
3. **Loss aversion** makes you hold losers too long  
4. **Herd behavior** makes you panic-sell during crashes
5. **Mental accounting** makes you treat recovered losses differently

## Your Bias Defense System

### Level 1: Awareness
- Recognize when biases are affecting your decisions
- Use the bias checklist before major financial moves
- Track your emotional state when making investment decisions

### Level 2: Environment Design
- Remove temptation by automating good decisions
- Create friction for bad decisions (remove trading apps, set delays)
- Surround yourself with disciplined investors, not speculators

### Level 3: Systematic Rules
- Create if-then scenarios for market events
- Use percentage-based rebalancing rules
- Set predetermined investment amounts and stick to them

## Key Takeaways

- **Biases cost the average investor 2-4% annually**—enough to cut your lifetime wealth in half
- **Multiple biases compound** to create even worse outcomes  
- **Awareness alone isn't enough**—you need systems and automation
- **The best investors aren't the smartest**—they're the most disciplined
- **Your biggest enemy is in the mirror**—but that also makes it controllable

**Next up:** We'll build your personal bias defense system and create rules to protect you from your own psychology.
            `
          },
          {
            type: "bias_identification_quiz", 
            depth: ["comprehensive", "expert"],
            title: "Behavioral Self-Check: What Would You Do?",
            questions: [
              {
                id: 1,
                scenario: "Market Volatility Test",
                question: "Your diversified portfolio drops 25% during a market crash. Most experts say it's temporary, but the news is getting worse daily. What's your move?",
                options: [
                  { text: "Sell everything immediately—I can't afford to lose more", bias: "loss_aversion" },
                  { text: "Hold everything and wait for the recovery", bias: "none" },
                  { text: "Buy more shares since everything's 'on sale' now", bias: "overconfidence" },
                  { text: "Panic and check my portfolio every hour", bias: "recency" }
                ]
              },
              {
                id: 2,
                scenario: "Social Pressure Test", 
                question: "Your coworker just made $30K on a cryptocurrency you've never heard of. Everyone at work is talking about getting in. What do you do?",
                options: [
                  { text: "Jump in immediately with my emergency fund—I'm missing out!", bias: "herd" },
                  { text: "Research the fundamentals first, then invest only what I can afford to lose", bias: "none" },
                  { text: "Ask my coworker for tips and copy their exact strategy", bias: "herd" },
                  { text: "Avoid it entirely—if everyone's buying, it must be overpriced", bias: "none" }
                ]
              },
              {
                id: 3,
                scenario: "Windfall Test",
                question: "You receive a $5,000 tax refund (much bigger than expected!). You also have $3,000 in credit card debt at 22% interest. What's your plan?",
                options: [
                  { text: "Treat myself to a vacation—it's free money from the government!", bias: "mental_accounting" },
                  { text: "Pay off the credit card debt immediately, then invest the rest", bias: "none" },
                  { text: "Put it all in savings for a rainy day", bias: "mental_accounting" },
                  { text: "Invest it all in my favorite stocks—time to get aggressive!", bias: "overconfidence" }
                ]
              },
              {
                id: 4,
                scenario: "Performance Chase Test",
                question: "Last year, growth stocks returned 40% while your boring index funds only returned 12%. This year is starting the same way. Your move?",
                options: [
                  { text: "Switch everything to growth stocks—they're clearly the future!", bias: "recency" },
                  { text: "Stick with my diversified approach—one year doesn't make a trend", bias: "none" },
                  { text: "Move half my money to growth stocks to hedge my bets", bias: "recency" },
                  { text: "Research which growth stocks will keep winning", bias: "overconfidence" }
                ]
              },
              {
                id: 5,
                scenario: "Loss Recovery Test", 
                question: "You bought a stock at $100. It's now worth $60. All your research suggests it's unlikely to recover. What do you do?",
                options: [
                  { text: "Hold forever until it gets back to $100—I refuse to take a loss", bias: "loss_aversion" },
                  { text: "Sell and invest the $60 in something with better prospects", bias: "none" },
                  { text: "Buy more shares to lower my average cost", bias: "loss_aversion" },
                  { text: "Wait until it gets back to $90, then sell", bias: "loss_aversion" }
                ]
              }
            ],
            profiles: {
              loss_aversion: {
                name: "Loss Aversion Dominant",
                description: "You feel losses deeply and make decisions to avoid pain rather than maximize gains. This keeps you in suboptimal situations and causes you to sell at the worst times.",
                actionPlan: [
                  "Automate your investments to remove daily decision-making",
                  "Reframe market drops as 'buying opportunities' rather than losses",
                  "Set predetermined rules for when you'll sell (if ever)",
                  "Focus on long-term percentages, not daily dollar changes"
                ]
              },
              recency: {
                name: "Recency Bias Affected",
                description: "You give too much weight to recent events and assume current trends will continue. This leads to buying high (after good performance) and selling low (after bad performance).",
                actionPlan: [
                  "Study long-term market history to see full cycles",
                  "Set up automatic rebalancing to force contrarian behavior",
                  "Use a 'cooling off' period before making trend-based decisions",
                  "Keep a contrarian mindset: when everyone agrees, be suspicious"
                ]
              },
              overconfidence: {
                name: "Overconfidence Prone", 
                description: "You trust your ability to pick winners and time markets. While confidence is good, overconfidence leads to excessive trading and concentrated positions.",
                actionPlan: [
                  "Track all your market predictions and investment picks",
                  "Limit individual stock picks to <5% of your portfolio",
                  "Use index funds for the majority of your investments",
                  "Get second opinions before making major moves"
                ]
              },
              herd: {
                name: "Herd Mentality Susceptible",
                description: "You're influenced by what others are doing and feel pressure to follow trends. This leads to buying at peaks and missing contrarian opportunities.",
                actionPlan: [
                  "Ask 'Would I buy this if no one else was?' before investing",
                  "Limit exposure to financial social media and hype",
                  "Do independent research before following any trend",
                  "Embrace unpopular but fundamentally sound investments"
                ]
              },
              mental_accounting: {
                name: "Mental Accounting Affected",
                description: "You treat money differently based on its source or purpose, leading to suboptimal overall financial decisions.",
                actionPlan: [
                  "View all money as fungible—a dollar is a dollar",
                  "Always pay off high-interest debt before low-return savings",
                  "Apply the same investment discipline to all income sources",
                  "Regularly optimize across all your accounts"
                ]
              },
              none: {
                name: "Bias Resistant (Well Done!)",
                description: "You show strong resistance to common behavioral biases. This gives you a huge advantage in building long-term wealth.",
                actionPlan: [
                  "Continue your disciplined approach—it's working",
                  "Help others recognize their biases",
                  "Stay vigilant—biases can emerge during stressful times",
                  "Consider behavioral coaching for others in your life"
                ]
              }
            }
          },
          {
            type: "bias_tracker",
            depth: ["expert"],
            title: "Personal Bias Tracker: Log Your Past Mistakes",
            description: "Reflect on your past financial decisions to identify patterns and get personalized advice"
          }
        ]
      }
    ]
  },
  {
    id: "financial-modeling",
    title: "From Spreadsheet to Strategy: Master Advanced Financial Modeling & Quantitative Tools",
    description: "Learn to build sophisticated models, perform quantitative analysis, and make data-driven decisions",
    difficulty: "Advanced",
    duration: "90-240 min",
    icon: "📊",
    category: "Analytics",
    heroTitle: "From Spreadsheet to Strategy: Master Advanced Financial Modeling & Quantitative Tools",
    heroSubtitle: "Learn to build sophisticated models, run simulations, and make data-driven financial decisions",
    learningOutcomes: [
      "Build and interpret Discounted Cash Flow (DCF) models for valuation",
      "Run Monte Carlo simulations to account for uncertainty in forecasts",
      "Apply risk metrics (VaR, Sharpe ratio, beta) in decision-making",
      "Backtest investment strategies using historical data",
      "Use Excel, Python, and Google Sheets for financial modeling"
    ],
    expertTopics: ["DCF modeling", "Monte Carlo simulation", "Risk metrics", "Backtesting"],
    lessons: [
      {
        id: 1,
        title: "The Foundations of Financial Modeling",
        type: "hands_on_modeling",
        contentBlocks: [
          {
            type: "markdown_text",
            depth: ["overview", "comprehensive", "expert"],
            title: "Building Models That Work: Structure, Logic, and Best Practices",
            value: `
# The Foundations of Financial Modeling

Financial modeling is the art and science of translating business assumptions into mathematical frameworks that help us make better decisions. Whether you're valuing a company, planning your retirement, or analyzing investment opportunities, strong modeling skills are essential.

## What is a Financial Model?

### Definition and Purpose
A financial model is a mathematical representation of a financial situation, company, or investment opportunity. It takes inputs (assumptions), processes them through calculations, and produces outputs (projections and analysis).

**Think of it as:** A crystal ball backed by math and logic, not magic.

### Types of Financial Models

#### 1. **Valuation Models**
- **Purpose:** Determine the intrinsic value of an asset
- **Examples:** DCF models, comparable company analysis
- **Users:** Investors, analysts, M&A professionals

#### 2. **Forecasting Models** 
- **Purpose:** Project future financial performance
- **Examples:** Budget models, scenario planning tools
- **Users:** Management teams, financial planners

#### 3. **Risk Models**
- **Purpose:** Quantify and manage financial risk
- **Examples:** VaR models, stress testing frameworks
- **Users:** Risk managers, portfolio managers

#### 4. **Decision Models**
- **Purpose:** Compare alternatives and optimize choices
- **Examples:** NPV analysis, portfolio optimization
- **Users:** CFOs, investment committees

## Financial Modeling Best Practices

### The Golden Rules

#### 1. **Structure: Inputs → Calculations → Outputs**
\`\`\`
[Blue] Assumptions & Inputs
   ↓
[Black] Calculations & Logic  
   ↓
[Green] Results & Analysis
\`\`\`

**Why this matters:** Clear structure makes models easier to audit, update, and explain to others.

#### 2. **Transparency is King**
- **Document assumptions:** Every input should have a clear source or rationale
- **Color coding:** Blue for inputs, black for formulas, green for outputs
- **Show your work:** Include intermediate calculations and checks

#### 3. **Flexibility by Design**
- **Scenario switches:** Allow users to toggle between optimistic/base/pessimistic cases
- **Sensitivity tables:** Show how outputs change with key assumptions
- **Modular structure:** Build components that can be easily modified

### Common Modeling Mistakes to Avoid

#### ❌ **The Hardcoded Trap**
\`\`\`excel
= 1000000 * 1.05  // Bad: hardcoded growth rate
= B5 * (1 + $B$2)  // Good: references assumption cell
\`\`\`

#### ❌ **The Circular Reference Problem**
- **Issue:** Model formulas that reference themselves
- **Solution:** Use iterative calculations or helper columns

#### ❌ **The Black Box Syndrome**
- **Issue:** Complex formulas that no one can understand
- **Solution:** Break complex calculations into logical steps

#### ❌ **The Single Point Failure**
- **Issue:** Models that only work with one set of assumptions
- **Solution:** Build in scenario analysis and stress testing

## Core Financial Modeling Skills

### 1. **Linking Financial Statements**

The three financial statements are interconnected:

**Income Statement → Balance Sheet → Cash Flow Statement**

#### Key Linkages:
- **Net Income** flows to retained earnings (balance sheet) and cash flow from operations
- **Depreciation** reduces asset values (balance sheet) and is added back in cash flow
- **Working Capital** changes affect both balance sheet and cash flow

### 2. **Financial Ratio Analysis**

#### **Profitability Ratios**
- **Gross Margin:** \`(Revenue - COGS) / Revenue\`
- **Operating Margin:** \`Operating Income / Revenue\`
- **ROE:** \`Net Income / Shareholders' Equity\`
- **ROIC:** \`NOPAT / Invested Capital\`

#### **Valuation Ratios**
- **P/E Ratio:** \`Price per Share / Earnings per Share\`
- **EV/EBITDA:** \`Enterprise Value / EBITDA\`
- **Price-to-Book:** \`Market Cap / Book Value\`

#### **Leverage Ratios**
- **Debt-to-Equity:** \`Total Debt / Total Equity\`
- **Interest Coverage:** \`EBIT / Interest Expense\`

### 3. **Dynamic Modeling Techniques**

#### **Conditional Logic**
\`\`\`excel
=IF(Revenue_Growth > 0.1, "High Growth", "Stable Growth")
=MAX(0, EBITDA - Capex - Working_Capital_Change)
\`\`\`

#### **Lookup Functions**
\`\`\`excel
=VLOOKUP(Year, Assumptions_Table, 3, FALSE)  // Growth rate by year
=INDEX(MATCH()) // More flexible than VLOOKUP
\`\`\`

#### **Data Validation**
- Dropdown lists for scenario selection
- Error checks for impossible values
- Range limits on key assumptions

## Building Your First Model: A Framework

### Step 1: Define the Question
- What decision are you trying to make?
- What level of precision do you need?
- Who will use this model?

### Step 2: Gather Inputs
- Historical financial data
- Industry benchmarks
- Management guidance
- Economic assumptions

### Step 3: Build the Engine
- Start with a base case scenario
- Add complexity gradually
- Test each component before moving on

### Step 4: Stress Test
- Run sensitivity analysis on key assumptions
- Test extreme scenarios
- Check for logical consistency

### Step 5: Document and Present
- Executive summary of key findings
- Clear explanation of methodology
- Limitations and risks

## Model Validation Checklist

### ✅ **Logic Checks**
- Do the numbers make business sense?
- Are growth rates reasonable given industry context?
- Do ratios align with comparable companies?

### ✅ **Technical Checks**  
- All formulas reference assumption cells (no hardcoding)
- Model works across different scenarios
- No circular references or errors

### ✅ **Sensitivity Analysis**
- Identify which assumptions drive the most change
- Test reasonable ranges for key variables
- Document break-even points

## Tools of the Trade

### **Excel/Google Sheets**
- **Pros:** Universal, powerful, flexible
- **Cons:** Can become unruly, limited data handling
- **Best for:** Most financial models, presentations

### **Python (pandas/numpy)**
- **Pros:** Handles large datasets, reproducible, powerful analytics
- **Cons:** Steeper learning curve, less visual
- **Best for:** Complex analysis, backtesting, automation

### **R**
- **Pros:** Strong statistical capabilities, great for research
- **Cons:** Learning curve, primarily for analysis vs. presentation
- **Best for:** Academic research, advanced statistics

### **Specialized Software**
- **Bloomberg Terminal:** Professional-grade data and modeling
- **FactSet:** Institutional research and modeling platform
- **Capital IQ:** Comprehensive financial database and tools

## Real-World Applications

### **Corporate Finance**
- **Budget Planning:** Multi-year financial projections
- **Capital Allocation:** NPV analysis of projects
- **M&A Analysis:** Valuation and synergy modeling

### **Investment Analysis**
- **Stock Valuation:** DCF and comparable company analysis  
- **Portfolio Construction:** Risk-return optimization
- **Strategy Backtesting:** Historical performance analysis

### **Personal Finance**
- **Retirement Planning:** Monte Carlo simulations
- **Mortgage Analysis:** Payment scenarios and refinancing
- **Investment Planning:** Goal-based allocation modeling

## Key Takeaways

- **Structure beats complexity** - Simple, well-organized models outperform complex black boxes
- **Garbage in, garbage out** - Model quality depends entirely on assumption quality
- **Models are tools, not truth** - Use them to inform decisions, not replace judgment
- **Transparency builds trust** - Document everything and show your work
- **Practice makes perfect** - Start simple and build complexity gradually

**Next up:** We'll put these principles into practice by building a complete DCF valuation model from scratch.
            `
          },
          {
            type: "video",
            depth: ["overview", "comprehensive"],
            title: "Financial Modeling Fundamentals: Building Your First Model",
            url: "https://www.youtube.com/embed/WcDLRdSnbz8",
            description: "Step-by-step walkthrough of financial modeling best practices and common pitfalls"
          },
          {
            type: "basic_model_builder",
            depth: ["comprehensive", "expert"],
            title: "Interactive Model Builder: Build Your First Financial Model",
            description: "Practice modeling fundamentals with real-time feedback and validation"
          }
        ]
      },
      {
        id: 2,
        title: "DCF Modeling – Valuing Assets Like a Pro",
        type: "advanced_valuation",
        contentBlocks: [
          {
            type: "markdown_text",
            depth: ["overview", "comprehensive", "expert"],
            title: "Discounted Cash Flow Analysis: From Theory to Practice",
            value: `
# DCF Modeling – Valuing Assets Like a Pro

The Discounted Cash Flow (DCF) model is the gold standard of valuation. It's based on a simple but powerful principle: **an asset is worth the present value of all future cash flows it will generate**.

## Understanding DCF: The Big Picture

### The Fundamental Question
"If I buy this asset today, how much cash will it generate for me over its lifetime, and what is that stream of cash worth in today's dollars?"

### Why DCF Matters
- **Intrinsic Value:** Based on fundamentals, not market sentiment
- **Forward-Looking:** Uses future expectations, not just historical data  
- **Flexible:** Can be applied to stocks, bonds, real estate, businesses, projects
- **Logical:** Forces you to think through business drivers and assumptions

### DCF vs. Market Price
- **Market Price:** What investors are willing to pay today (influenced by emotions, trends, liquidity)
- **Intrinsic Value (DCF):** What the asset is actually worth based on cash generation ability
- **Investment Opportunity:** When market price ≠ intrinsic value

## DCF Fundamentals

### The DCF Formula
\`\`\`
PV = CF₁/(1+r)¹ + CF₂/(1+r)² + ... + CFₙ/(1+r)ⁿ + TV/(1+r)ⁿ

Where:
PV = Present Value (what we're solving for)
CF = Cash Flow in each period
r = Discount Rate (required return)
TV = Terminal Value (value beyond explicit forecast period)
n = Number of periods
\`\`\`

### Two Main Approaches

#### 1. **Free Cash Flow to Firm (FCFF)**
- **Values:** The entire business (equity + debt)
- **Cash Flow:** Available to all investors (equity and debt holders)
- **Discount Rate:** Weighted Average Cost of Capital (WACC)
- **Formula:** \`FCFF = EBIT(1-Tax Rate) + Depreciation - Capex - Change in Working Capital\`

#### 2. **Free Cash Flow to Equity (FCFE)**  
- **Values:** Just the equity portion
- **Cash Flow:** Available only to equity holders (after debt payments)
- **Discount Rate:** Cost of Equity
- **Formula:** \`FCFE = Net Income + Depreciation - Capex - Change in Working Capital - Net Debt Payments\`

## Building a DCF Model: Step-by-Step

### Step 1: Historical Analysis
Before forecasting, understand the past:
- **Revenue Growth:** What drives it? Market growth? Market share gains?
- **Margins:** Are they stable? Improving? Under pressure?
- **Capital Intensity:** How much investment is required to grow?
- **Working Capital:** Does it increase with sales?

### Step 2: Revenue Projections

#### **Top-Down Approach**
\`\`\`
Total Addressable Market (TAM)
× Market Share
= Company Revenue
\`\`\`

#### **Bottom-Up Approach**  
\`\`\`
Unit Sales × Average Price = Revenue
or
Customer Base × Revenue per Customer = Revenue
\`\`\`

#### **Key Considerations:**
- Industry growth rates and maturity
- Competitive dynamics
- Economic cycles
- Company-specific factors (new products, expansion)

### Step 3: Operating Expense Projections

#### **Fixed vs. Variable Costs**
- **Fixed:** Rent, salaries, insurance (don't change with sales volume)
- **Variable:** Materials, commissions, shipping (scale with revenue)
- **Semi-Variable:** Utilities, some labor (step functions)

#### **Margin Analysis**
\`\`\`
Gross Margin = (Revenue - COGS) / Revenue
Operating Margin = Operating Income / Revenue  
EBITDA Margin = EBITDA / Revenue
\`\`\`

### Step 4: Capital Expenditures (Capex)

#### **Maintenance Capex**
- Required to maintain current operations
- Often approximated as depreciation
- Necessary but doesn't drive growth

#### **Growth Capex**
- Investments to support revenue growth
- New facilities, equipment, technology
- Should generate positive returns

#### **Modeling Approaches:**
- **% of Revenue:** Simple but may not capture lumpiness
- **Asset Turnover:** \`Revenue / Net Fixed Assets\`
- **Detailed Build-Up:** Project specific investments

### Step 5: Working Capital

#### **Components:**
- **Accounts Receivable:** Money customers owe you
- **Inventory:** Raw materials and finished goods
- **Accounts Payable:** Money you owe suppliers
- **Net Working Capital = AR + Inventory - AP**

#### **Cash Impact:**
- **Increase in NWC:** Uses cash (customers pay slower, inventory builds)
- **Decrease in NWC:** Generates cash (collections improve, inventory reduces)

### Step 6: Calculate Free Cash Flow

#### **FCFF Calculation:**
\`\`\`
EBIT (Operating Income)
× (1 - Tax Rate) = NOPAT
+ Depreciation & Amortization
- Capital Expenditures  
- Change in Net Working Capital
= Free Cash Flow to Firm
\`\`\`

### Step 7: Determine the Discount Rate (WACC)

#### **WACC Formula:**
\`\`\`
WACC = (E/V × Re) + (D/V × Rd × (1-Tc))

Where:
E = Market Value of Equity
D = Market Value of Debt  
V = E + D (Total Value)
Re = Cost of Equity
Rd = Cost of Debt
Tc = Tax Rate
\`\`\`

#### **Cost of Equity (CAPM):**
\`\`\`
Re = Rf + β(Rm - Rf)

Where:
Rf = Risk-free rate (10-year Treasury)
β = Beta (stock's sensitivity to market)
Rm = Expected market return
(Rm - Rf) = Equity risk premium
\`\`\`

### Step 8: Terminal Value

The terminal value often represents 60-80% of total DCF value, so it's critical to get right.

#### **Method 1: Perpetuity Growth**
\`\`\`
TV = FCF(n+1) / (WACC - g)

Where:
FCF(n+1) = Free cash flow in year after forecast period
g = Long-term growth rate (typically 2-3% for mature companies)
\`\`\`

#### **Method 2: Exit Multiple**
\`\`\`
TV = EBITDA(final year) × Exit Multiple

Where Exit Multiple is based on:
- Industry averages
- Comparable transactions
- Historical trading multiples
\`\`\`

### Step 9: Calculate Present Value

#### **Present Value of Explicit Forecast Period:**
\`\`\`
PV of FCF = Σ [FCF(t) / (1 + WACC)^t]
\`\`\`

#### **Present Value of Terminal Value:**
\`\`\`
PV of TV = TV / (1 + WACC)^n
\`\`\`

#### **Enterprise Value:**
\`\`\`
EV = PV of FCF + PV of TV
\`\`\`

#### **Equity Value:**
\`\`\`
Equity Value = EV - Net Debt + Cash
Value per Share = Equity Value / Shares Outstanding
\`\`\`

## DCF Sensitivity Analysis

### Why Sensitivity Matters
Small changes in key assumptions can dramatically impact valuation. Always test:

#### **Key Sensitivity Variables:**
- **WACC:** ±0.5% can change value by 10-15%
- **Terminal Growth Rate:** ±0.5% can change value by 8-12%
- **Operating Margins:** ±1% can significantly impact cash flows
- **Revenue Growth:** Especially in early years

#### **Sensitivity Table Example:**
\`\`\`
              WACC →  8%    9%   10%   11%   12%
Terminal ↓
2.0%                $45   $38   $32   $28   $24
2.5%                $50   $42   $36   $31   $27  
3.0%                $56   $47   $40   $35   $30
3.5%                $64   $53   $45   $38   $33
4.0%                $73   $60   $51   $43   $37
\`\`\`

## Common DCF Pitfalls and How to Avoid Them

### ❌ **The Precision Illusion**
**Mistake:** Forecasting revenue to the nearest thousand when uncertain about millions
**Fix:** Focus on getting major assumptions right rather than false precision

### ❌ **The Terminal Value Trap**
**Mistake:** Using unrealistic terminal growth rates or multiples
**Fix:** Ground terminal value in economic reality (GDP growth, industry maturity)

### ❌ **The Linear Growth Fantasy**
**Mistake:** Assuming smooth, linear growth when business is cyclical
**Fix:** Model business cycles and competitive dynamics

### ❌ **The Working Capital Oversight**
**Mistake:** Ignoring working capital changes or using unrealistic assumptions
**Fix:** Model working capital components based on business fundamentals

### ❌ **The Single Scenario Trap**
**Mistake:** Building only one case without testing alternatives
**Fix:** Always build base/optimistic/pessimistic scenarios

## DCF in Practice: Real-World Applications

### **Stock Analysis**
- Compare DCF value to current stock price
- Identify undervalued/overvalued opportunities
- Set price targets for investment decisions

### **M&A Valuation**
- Determine fair acquisition price
- Model synergies and integration costs
- Support negotiation strategy

### **Capital Allocation**
- Evaluate internal projects and investments
- Compare opportunities across business units
- Support budget allocation decisions

### **Strategic Planning**
- Test business plan assumptions
- Quantify value creation initiatives  
- Assess competitive positioning impact

## Advanced DCF Techniques

### **Sum-of-the-Parts (SOTP)**
Value each business segment separately when:
- Company operates in multiple industries
- Segments have different risk profiles
- Provides more accurate valuation

### **Real Options Valuation**
Account for managerial flexibility:
- Option to expand if successful
- Option to abandon if unsuccessful
- Timing options (when to invest)

### **Monte Carlo DCF**
Use probability distributions for inputs:
- Revenue growth rates
- Margin assumptions
- Terminal value parameters
- Produces range of outcomes rather than point estimate

## Key Takeaways

- **DCF provides intrinsic value** based on fundamental cash generation ability
- **Quality of assumptions drives quality of output** - garbage in, garbage out
- **Sensitivity analysis is essential** - test key assumptions thoroughly
- **Terminal value is critical** - often 60-80% of total value
- **DCF is a tool, not truth** - use it to inform judgment, not replace it
- **Practice makes perfect** - start with simple models and add complexity

**Next up:** We'll build an interactive DCF model where you can input assumptions and see real-time valuation results with sensitivity analysis.
            `
          },
          {
            type: "video",
            depth: ["comprehensive", "expert"],
            title: "DCF Modeling Masterclass: From Theory to Excel",
            url: "https://www.youtube.com/embed/1QmZqL7tWnE",
            description: "Complete walkthrough of building a DCF model with sensitivity analysis"
          },
          {
            type: "dcf_model_builder",
            depth: ["comprehensive", "expert"],
            title: "Interactive DCF Model Builder",
            description: "Build your own DCF model with real-time calculations and sensitivity analysis"
          }
        ]
      },
      {
        id: 3,
        title: "Monte Carlo Simulation & Risk Analysis",
        type: "simulation_lab",
        contentBlocks: [
          {
            type: "markdown_text",
            depth: ["overview", "comprehensive", "expert"],
            title: "Embracing Uncertainty: Monte Carlo Methods for Financial Analysis",
            value: `
# Monte Carlo Simulation & Risk Analysis

In the real world, nothing is certain. Revenue won't grow at exactly 5% every year, interest rates won't stay constant, and market returns won't hit their historical averages precisely. Monte Carlo simulation helps us embrace this uncertainty and make better decisions despite it.

## Why Monte Carlo Matters

### The Problem with Point Estimates
Traditional financial models use single-point estimates:
- "Revenue will grow 8% annually"
- "The discount rate is 10%"
- "Terminal growth rate is 3%"

**Reality:** These are best guesses, not certainties.

### The Monte Carlo Solution
Instead of one answer, Monte Carlo gives you:
- **Range of outcomes:** What could realistically happen
- **Probability distributions:** How likely each outcome is
- **Risk metrics:** Quantified measures of uncertainty
- **Confidence intervals:** Bounds around your estimates

### Real-World Applications
- **Retirement planning:** Will my savings last?
- **Investment analysis:** What's the probability of loss?
- **Business planning:** Range of possible cash flows
- **Portfolio optimization:** Risk-adjusted allocation

## Monte Carlo Fundamentals

### How It Works
1. **Define uncertain inputs** with probability distributions
2. **Run thousands of simulations** (typically 10,000+)
3. **Calculate outputs** for each simulation
4. **Analyze results** statistically

### Example: Simple Investment Return
Instead of assuming 8% annual return:
\`\`\`
Input: Stock returns ~ Normal(8%, 15%)
Simulation: Generate 10,000 random annual returns
Output: Distribution of portfolio values after 10 years
\`\`\`

## Probability Distributions: The Building Blocks

### **Normal Distribution**
- **Use case:** Many financial variables (returns, growth rates)
- **Parameters:** Mean (μ) and standard deviation (σ)
- **Shape:** Symmetric bell curve
- **Example:** Stock returns ~ Normal(10%, 20%)

### **Log-Normal Distribution**  
- **Use case:** Asset prices, revenues (can't be negative)
- **Parameters:** Mean and standard deviation of log values
- **Shape:** Right-skewed, bounded at zero
- **Example:** Stock prices ~ LogNormal(μ, σ)

### **Uniform Distribution**
- **Use case:** When all values in range are equally likely
- **Parameters:** Minimum and maximum values
- **Shape:** Flat rectangle
- **Example:** Discount rate ~ Uniform(8%, 12%)

### **Triangular Distribution**
- **Use case:** Three-point estimates (min, most likely, max)
- **Parameters:** Minimum, mode, maximum
- **Shape:** Triangle
- **Example:** Revenue growth ~ Triangular(2%, 5%, 8%)

### **Beta Distribution**
- **Use case:** Percentages, rates bounded between 0 and 1
- **Parameters:** Alpha and beta shape parameters
- **Shape:** Flexible within [0,1] bounds
- **Example:** Market share ~ Beta(2, 5)

## Building Monte Carlo Models

### Step 1: Identify Uncertain Variables
Not every input needs to be probabilistic. Focus on:
- **High-impact variables:** Those that significantly affect outcomes
- **Highly uncertain variables:** Those with wide ranges of possible values
- **Key business drivers:** Revenue growth, margins, market size

### Step 2: Define Distributions
For each uncertain variable, determine:
- **Distribution type:** Normal, uniform, triangular, etc.
- **Parameters:** Mean, standard deviation, min/max
- **Correlations:** How variables move together

#### **Sources for Distribution Parameters:**
- **Historical data:** Calculate mean and standard deviation
- **Industry benchmarks:** Compare to similar companies
- **Expert judgment:** Management estimates with confidence ranges
- **Economic forecasts:** GDP growth, inflation, interest rates

### Step 3: Model Correlations
Variables don't move independently:
- **Revenue and costs:** Higher revenue may drive higher variable costs
- **Interest rates and growth:** Economic relationships
- **Market factors:** Industry-wide impacts

#### **Correlation Examples:**
\`\`\`
Correlation(Revenue Growth, GDP Growth) = 0.7
Correlation(Interest Rates, Discount Rate) = 0.9
Correlation(Oil Prices, Transportation Costs) = 0.8
\`\`\`

### Step 4: Run Simulations
For each simulation iteration:
1. **Sample** from each probability distribution
2. **Apply correlations** to ensure realistic relationships
3. **Calculate** model outputs (NPV, IRR, portfolio value)
4. **Store results** for analysis

### Step 5: Analyze Results

#### **Central Tendency:**
- **Mean:** Average outcome across all simulations
- **Median:** Middle value (often more robust than mean)
- **Mode:** Most frequently occurring outcome

#### **Variability:**
- **Standard deviation:** Spread of outcomes
- **Variance:** Square of standard deviation
- **Range:** Difference between max and min

#### **Risk Metrics:**
- **Value at Risk (VaR):** Worst-case loss at given confidence level
- **Conditional VaR:** Expected loss beyond VaR threshold
- **Probability of loss:** Chance of negative outcome

## Key Risk Metrics Explained

### **Value at Risk (VaR)**
"There is a 5% chance of losing more than $X"

#### **Formula:**
VaR₀.₀₅ = 5th percentile of loss distribution

#### **Example:**
Portfolio VaR₀.₀₅ = $50,000 means:
- 95% chance of losing less than $50,000
- 5% chance of losing more than $50,000

#### **Uses:**
- Risk budgeting and limits
- Regulatory capital requirements
- Performance measurement

### **Sharpe Ratio**
Risk-adjusted return measure

#### **Formula:**
\`\`\`
Sharpe Ratio = (Expected Return - Risk-Free Rate) / Standard Deviation
\`\`\`

#### **Interpretation:**
- **Higher is better:** More return per unit of risk
- **Typical ranges:** 0.5-1.0 good, >1.0 excellent
- **Comparison tool:** Evaluate different investments

### **Beta**
Sensitivity to market movements

#### **Formula:**
\`\`\`
Beta = Covariance(Asset, Market) / Variance(Market)
\`\`\`

#### **Interpretation:**
- **Beta = 1:** Moves with market
- **Beta > 1:** More volatile than market
- **Beta < 1:** Less volatile than market
- **Beta < 0:** Moves opposite to market

### **Maximum Drawdown**
Largest peak-to-trough decline

#### **Calculation:**
\`\`\`
Drawdown = (Peak Value - Trough Value) / Peak Value
Max Drawdown = Maximum drawdown over time period
\`\`\`

#### **Uses:**
- Measure worst-case scenario
- Assess strategy robustness
- Set expectations for investors

## Monte Carlo in Practice

### **Retirement Planning Example**

#### **Uncertain Inputs:**
- Stock returns ~ Normal(8%, 18%)
- Bond returns ~ Normal(4%, 6%)
- Inflation ~ Normal(2.5%, 1%)
- Healthcare costs ~ LogNormal(μ, σ)

#### **Model:**
\`\`\`python
for simulation in range(10000):
    stock_return = random.normal(0.08, 0.18)
    bond_return = random.normal(0.04, 0.06)
    inflation = random.normal(0.025, 0.01)
    
    # Calculate portfolio returns and expenses
    portfolio_value = calculate_portfolio(stock_return, bond_return)
    real_expenses = expenses * (1 + inflation)
    
    # Check if money lasts 30 years
    success[simulation] = portfolio_value > 0 after 30 years
\`\`\`

#### **Results:**
- **Probability of success:** 85%
- **Expected portfolio value:** $2.1M
- **5th percentile:** $0.8M
- **95th percentile:** $4.2M

### **Investment Analysis Example**

#### **DCF with Monte Carlo:**
Instead of single-point DCF, use distributions:
- Revenue growth ~ Triangular(2%, 6%, 10%)
- Operating margin ~ Normal(15%, 3%)
- WACC ~ Uniform(8%, 12%)
- Terminal growth ~ Triangular(1%, 2.5%, 4%)

#### **Results:**
- **Mean valuation:** $45 per share
- **Standard deviation:** $12 per share
- **95% confidence interval:** $24 - $68 per share
- **Probability stock is undervalued:** 73% (if trading at $35)

## Advanced Monte Carlo Techniques

### **Latin Hypercube Sampling (LHS)**
More efficient than random sampling:
- **Ensures** full coverage of probability space
- **Reduces** number of simulations needed
- **Improves** accuracy with fewer runs

### **Antithetic Variables**
Variance reduction technique:
- **Generate** pairs of negatively correlated samples
- **Reduces** simulation variance
- **Improves** convergence speed

### **Control Variables**
Use known analytical results:
- **Adjust** simulation results based on analytical benchmark
- **Reduces** Monte Carlo error
- **Increases** precision

### **Importance Sampling**
Focus on important regions:
- **Sample more frequently** from critical areas
- **Weight results** appropriately
- **Improves** tail risk estimation

## Common Monte Carlo Pitfalls

### ❌ **The Independence Assumption**
**Mistake:** Treating correlated variables as independent
**Fix:** Model correlations explicitly using correlation matrices

### ❌ **The Distribution Guess**
**Mistake:** Choosing distributions without justification
**Fix:** Use historical data or economic theory to guide choices

### ❌ **The Sample Size Error**
**Mistake:** Using too few simulations (e.g., 1,000 instead of 10,000)
**Fix:** Run enough simulations for stable results (check convergence)

### ❌ **The Static Model Trap**
**Mistake:** Assuming parameters don't change over time
**Fix:** Model time-varying parameters and regime changes

### ❌ **The Overconfidence Bias**
**Mistake:** Making distributions too narrow (overconfidence in estimates)
**Fix:** Use wider distributions that reflect true uncertainty

## Implementation Tools

### **Excel**
- **Built-in functions:** RAND(), NORM.INV(), etc.
- **Add-ins:** @RISK, Crystal Ball
- **Pros:** Familiar, visual, easy to share
- **Cons:** Limited complexity, slow for large simulations

### **Python**
\`\`\`python
import numpy as np
import pandas as pd
from scipy import stats
import matplotlib.pyplot as plt

# Example: Monte Carlo simulation
np.random.seed(42)
returns = np.random.normal(0.08, 0.18, 10000)
portfolio_values = 100000 * (1 + returns)**10
var_95 = np.percentile(portfolio_values, 5)
\`\`\`

### **R**
\`\`\`r
# Example: Monte Carlo in R
library(ggplot2)
set.seed(42)
returns <- rnorm(10000, mean=0.08, sd=0.18)
portfolio_values <- 100000 * (1 + returns)^10
var_95 <- quantile(portfolio_values, 0.05)
\`\`\`

## Key Takeaways

- **Embrace uncertainty** rather than pretending it doesn't exist
- **Use appropriate distributions** based on data and economic logic
- **Model correlations** between variables for realistic scenarios
- **Focus on risk metrics** like VaR, Sharpe ratio, and maximum drawdown
- **Validate models** with historical data and common sense checks
- **Communicate ranges** not false precision with point estimates
- **Update models** as new information becomes available

**Next up:** We'll build an interactive Monte Carlo simulator where you can experiment with different assumptions and see how uncertainty affects your results.
            `
          },
          {
            type: "video",
            depth: ["comprehensive", "expert"],
            title: "Monte Carlo Simulation: Quantifying Financial Uncertainty",
            url: "https://www.youtube.com/embed/7ESK5SaP-bc",
            description: "Learn to build Monte Carlo models for financial analysis and risk assessment"
          },
          {
            type: "monte_carlo_simulator",
            depth: ["comprehensive", "expert"],
            title: "Interactive Monte Carlo Simulator",
            description: "Experiment with probability distributions and see how uncertainty affects financial outcomes"
          }
        ]
      }
    ]
  },
  {
    id: "macroeconomics",
    title: "See the Bigger Picture: How Macroeconomics Shapes Your Money",
    description: "Understand economic cycles, policy changes, and global events to make smarter financial decisions",
    difficulty: "Intermediate", 
    duration: "60-120 min",
    icon: "🌍",
    category: "Economic Insight",
    heroTitle: "See the Bigger Picture: How Macroeconomics Shapes Your Money",
    heroSubtitle: "Understand economic cycles, policy changes, and global events to make smarter financial decisions",
    learningOutcomes: [
      "Understand economic cycles and how they affect jobs, investments, and borrowing",
      "Decode monetary & fiscal policy and their impact on interest rates, inflation, and markets",
      "Interpret key economic indicators (GDP, CPI, unemployment, etc.) and what they signal",
      "Analyze global events and market reactions (geopolitics, trade wars, pandemics)",
      "Apply macroeconomic insights to personal finance and investing strategies"
    ],
    expertTopics: ["Business cycles", "Monetary policy", "Economic indicators", "Global market analysis"],
    lessons: [
      {
        id: 1,
        title: "Economic Cycles & Their Personal Impact",
        type: "economic_analysis",
        contentBlocks: [
          {
            type: "markdown_text",
            depth: ["overview", "comprehensive", "expert"],
            title: "Understanding the Business Cycle: Your Financial Life Through Economic Seasons",
            value: `
# Economic Cycles & Their Personal Impact

The economy moves in cycles, just like seasons. Understanding where we are in the cycle—and where we're headed—can help you make smarter decisions about your career, investments, and major purchases. Let's break down how these massive economic forces directly impact your wallet.

## The Four Phases of the Business Cycle

Think of the economy like a roller coaster that goes up and down in predictable patterns. Each phase affects your money differently.

### 📈 Phase 1: Expansion (The Good Times)

**What's Happening:**
- GDP is growing consistently (typically 2-4% annually)
- Unemployment is falling as companies hire more workers
- Consumer confidence is high—people are spending money
- Stock markets are generally rising
- Corporate profits are increasing

**How It Affects YOUR Money:**
- **Jobs:** Easier to find work, get promotions, and negotiate raises
- **Income:** Wages tend to rise as companies compete for workers
- **Investments:** Stocks perform well, especially growth companies
- **Credit:** Banks are more willing to lend, easier to get loans
- **Housing:** Real estate prices typically rise

**Personal Finance Strategy:**
- **Maximize income:** Ask for raises, switch jobs for better pay
- **Invest aggressively:** Higher allocation to stocks while markets are climbing
- **Build skills:** Take courses, get certifications while job market is strong
- **Lock in low rates:** Refinance debt if rates are still low

### 🔺 Phase 2: Peak (The Party's Getting Wild)

**What's Happening:**
- Economic growth reaches maximum levels
- Unemployment hits multi-year lows (2-4%)
- Inflation starts to rise as demand outpaces supply
- Asset prices (stocks, real estate) may become overvalued
- Central banks consider raising interest rates to cool things down

**Warning Signs:**
- "Everyone's getting rich" mentality in markets
- FOMO (fear of missing out) driving investment decisions
- Credit becoming too easy—people borrowing more than they should
- Prices rising faster than wages

**How It Affects YOUR Money:**
- **Jobs:** Peak employment but wage growth may slow due to inflation
- **Investments:** Markets may be overvalued, higher risk of correction
- **Borrowing:** Interest rates start to rise, making debt more expensive
- **Purchasing power:** Inflation eats into your paycheck's buying power

**Personal Finance Strategy:**
- **Diversify investments:** Reduce risk as markets get frothy
- **Pay down debt:** Before interest rates rise further
- **Build emergency fund:** Economic peaks don't last forever
- **Avoid FOMO:** Don't chase overvalued investments

### 📉 Phase 3: Contraction/Recession (The Hangover)

**What's Happening:**
- GDP shrinks for two consecutive quarters (official recession)
- Unemployment rises as companies lay off workers
- Consumer spending falls dramatically
- Stock markets decline significantly (20%+ bear market)
- Business investment and confidence plummet

**How It Affects YOUR Money:**
- **Jobs:** Layoffs increase, finding work becomes much harder
- **Income:** Wage growth stalls, bonuses disappear, hours may be cut
- **Investments:** Stock portfolios lose significant value
- **Credit:** Banks tighten lending standards, harder to get loans
- **Housing:** Real estate prices may fall, foreclosures increase

**Personal Finance Strategy:**
- **Preserve cash:** Emergency fund becomes critical
- **Reduce expenses:** Cut non-essential spending aggressively  
- **Don't panic sell:** Markets recover, stay invested for long term
- **Look for opportunities:** Some investments become bargains
- **Focus on stability:** Prioritize job security over advancement

### 🔻 Phase 4: Trough (The Bottom)

**What's Happening:**
- Economic decline reaches its lowest point
- Unemployment peaks (may reach 8-10%+)
- Asset prices hit bottom
- Government and central banks implement stimulus measures
- Seeds of recovery are planted, though not immediately visible

**How It Affects YOUR Money:**
- **Jobs:** Unemployment is highest, but typically stops getting worse
- **Investments:** Markets often hit bottom before economy recovers
- **Interest rates:** Central banks cut rates to stimulate growth
- **Opportunities:** Best bargains in stocks, real estate appear

**Personal Finance Strategy:**
- **Stay calm:** This is temporary, recovery will come
- **Invest if possible:** Some of the best investment opportunities occur at troughs
- **Retrain if needed:** Use downtime to build new skills
- **Refinance debt:** Take advantage of low interest rates

## Historical Examples: Lessons from Past Cycles

### The 2008-2009 Financial Crisis

**The Setup (Peak Phase):**
- Housing bubble with easy credit and rising prices
- "Housing never goes down" mentality
- Overleveraged consumers and financial institutions

**The Crash (Contraction):
- Stock market fell 57% from peak to trough
- Unemployment rose from 5% to 10%
- Housing prices fell 30%+ in many areas
- Credit markets froze completely

**The Recovery (Expansion):**
- Federal Reserve cut interest rates to near zero
- Government stimulus programs
- Stock market recovered and reached new highs by 2013
- Job market didn't fully recover until 2015-2016

**Personal Finance Lessons:**
- **Emergency funds are crucial** - Many people lost jobs and homes
- **Don't time the market** - Those who sold at the bottom locked in losses
- **Diversification matters** - People overconcentrated in real estate got crushed
- **Recovery takes time** - But it does happen if you stay patient

### The COVID-19 Recession (2020)

**The Shock (Sudden Contraction):**
- Fastest recession in US history (2 months)
- Unemployment spiked from 3.5% to 14.8% in weeks
- Stock market fell 34% in just over a month
- Entire sectors (travel, hospitality) nearly shut down

**The Recovery (V-Shaped):**
- Massive government stimulus ($2+ trillion)
- Federal Reserve cut rates to zero and bought bonds
- Stock market recovered to new highs within months
- "K-shaped" recovery - some thrived, others struggled

**Personal Finance Lessons:**
- **Emergency funds saved lives** - Literally kept people housed and fed
- **Diversified income sources help** - Gig workers and freelancers had flexibility
- **Technology adaptation matters** - Remote work skills became essential
- **Government policy response matters** - Stimulus checks and unemployment benefits cushioned the blow

## Economic Indicators: Your Early Warning System

### Leading Indicators (Predict Where We're Going)
- **Stock market performance:** Often falls before recessions
- **Yield curve:** When short-term rates exceed long-term (inverted yield curve)
- **Consumer confidence:** When people feel pessimistic about the future
- **Initial jobless claims:** Early sign of labor market trouble

### Coincident Indicators (Show Where We Are Now)
- **GDP growth rate:** The official measure of economic activity
- **Employment/unemployment rate:** Current job market health
- **Personal income:** How much money people are making
- **Industrial production:** How much stuff we're making

### Lagging Indicators (Confirm What Happened)
- **Unemployment rate:** Peaks after recessions end
- **Corporate profits:** Reflect past economic conditions
- **Consumer debt levels:** Build up during expansions

## Sector Rotation: How Different Industries Perform in Each Phase

### Early Expansion
**Winners:** Technology, Consumer Discretionary, Financials
- People start spending on non-essentials again
- Tech companies benefit from business investment
- Banks benefit from increasing loan demand

### Late Expansion  
**Winners:** Materials, Industrials, Energy
- Infrastructure spending increases
- Commodity prices rise with inflation
- Energy demand peaks with economic activity

### Early Contraction
**Winners:** Consumer Staples, Healthcare, Utilities
- People still need food, medicine, electricity
- "Defensive" sectors provide stability
- Dividend-paying stocks become attractive

### Late Contraction/Early Recovery
**Winners:** Technology, Small-cap stocks, Cyclical sectors
- Forward-looking investors anticipate recovery
- Smaller companies poised for faster growth
- Previous winners become cheap again

## Personal Finance Strategy by Cycle Phase

### 💼 **Career Planning**

**Expansion:** 
- Switch jobs for better pay/advancement
- Negotiate raises aggressively
- Start side hustles or businesses
- Invest in education and skills

**Peak:**
- Focus on performance and job security
- Build strong relationships at work
- Avoid job hopping as market may turn
- Save aggressively while income is high

**Contraction:**
- Prioritize job security over advancement
- Cut expenses to match reduced income
- Avoid major career changes if possible
- Use downtime for skill development

**Trough:**
- Look for opportunities in growing sectors
- Consider career pivots if industry is declining
- Network actively as recovery approaches
- Be patient - good opportunities will come

### 💰 **Investment Strategy**

**Expansion:**
- Higher allocation to stocks (70-80%)
- Growth stocks outperform
- International diversification
- Consider higher-risk investments

**Peak:**
- Reduce risk gradually
- Take profits on overvalued assets
- Increase cash allocation
- Focus on quality companies

**Contraction:**
- Don't panic sell
- Maintain diversification
- Dollar-cost average into markets
- Look for quality at discount prices

**Trough:**
- Deploy cash reserves strategically
- Focus on companies that will survive
- Contrarian investing opportunities
- Be patient - recovery takes time

### 🏠 **Major Purchase Timing**

**Best Time to Buy a House:**
- Early expansion: Prices recovering but not peak yet
- During contraction: If you have job security and cash

**Best Time to Buy a Car:**
- End of contraction: Dealers desperate for sales
- Early expansion: Financing becomes available again

**Best Time to Start a Business:**
- Late contraction/early expansion: Less competition, lower costs
- Mid-expansion: Access to capital and customers

## Global Considerations

### How International Events Affect Cycles
- **Trade wars:** Disrupt global supply chains, hurt export-dependent sectors
- **Currency fluctuations:** Strong dollar hurts exports, helps imports
- **Commodity shocks:** Oil price spikes can trigger recessions
- **Geopolitical events:** Create uncertainty, flight to safety

### Developed vs. Emerging Markets
- **Emerging markets:** More volatile cycles, higher growth potential
- **Developed markets:** More stable but slower growth
- **Correlation:** Global integration means cycles increasingly synchronized

## Key Takeaways for Your Money

1. **Cycles are inevitable** - Booms and busts are part of capitalism
2. **Timing is nearly impossible** - Focus on being prepared for all phases
3. **Your career matters most** - Human capital is your biggest asset
4. **Emergency funds are essential** - They provide stability during contractions
5. **Don't fight the cycle** - Adapt your strategy to current conditions
6. **Recovery always comes** - Stay patient and disciplined
7. **Preparation beats prediction** - Build resilience, not just returns

**Remember:** You can't control economic cycles, but you can control how you respond to them. The best financial strategy is one that works in all phases of the cycle, not just the good times.

**Next up:** We'll explore how central banks and government policies attempt to manage these cycles, and what that means for interest rates, inflation, and your personal finances.
            `
          },
          {
            type: "video",
            depth: ["overview", "comprehensive"],
            title: "Business Cycles Explained: How Economic Seasons Affect Your Money",
            url: "https://www.youtube.com/embed/PHe0bXAIuk0",
            description: "Visual guide to understanding economic cycles and their personal finance implications"
          },
          {
            type: "economic_cycle_simulator",
            depth: ["comprehensive", "expert"],
            title: "Interactive Economic Cycle Simulator",
            description: "Experiment with economic variables and see how they affect GDP, unemployment, and markets"
          }
        ]
      },
      {
        id: 2,
        title: "Monetary Policy, Inflation & Interest Rates",
        type: "policy_analysis",
        contentBlocks: [
          {
            type: "markdown_text",
            depth: ["overview", "comprehensive", "expert"],
            title: "The Fed and Your Finances: How Central Bank Decisions Shape Your Money",
            value: `
# Monetary Policy, Inflation & Interest Rates

Every six weeks, a group of 12 people meets in Washington, D.C., and makes decisions that directly affect your mortgage rate, your savings account, your job prospects, and the value of your investments. They're the Federal Reserve, and understanding their playbook is crucial for your financial success.

## Meet the Federal Reserve: The Economy's Puppet Master

### What the Fed Actually Does
The Federal Reserve (or "Fed") is America's central bank, created in 1913 after a series of financial panics. Think of them as the economy's thermostat—they try to keep things from getting too hot (inflation) or too cold (recession).

### The Fed's Dual Mandate
1. **Price Stability:** Keep inflation around 2% annually
2. **Full Employment:** Maximize sustainable employment

**Why 2% inflation?** It's not zero because:
- Mild inflation encourages spending and investment
- Gives the Fed room to cut rates during recessions
- Prevents dangerous deflation (falling prices)

### The Fed's Three Main Tools

#### 🎯 **Tool #1: Federal Funds Rate (The Big One)**

**What it is:** The interest rate banks charge each other for overnight loans

**How it works:**
- Fed raises rates → Banks pay more to borrow → They charge you more → Economic activity slows
- Fed lowers rates → Banks pay less to borrow → They charge you less → Economic activity increases

**Real-world impact on YOU:**
\`\`\`
Fed Funds Rate: 0.25% → Your mortgage: ~3.0%
Fed Funds Rate: 2.00% → Your mortgage: ~4.5%
Fed Funds Rate: 5.00% → Your mortgage: ~7.0%
\`\`\`

#### 🎯 **Tool #2: Quantitative Easing (QE) - "Printing Money"**

**What it is:** The Fed buys government bonds and other securities to inject money into the economy

**How it works:**
- Fed creates new money electronically
- Uses it to buy bonds from banks and institutions
- This puts cash in the financial system
- Banks have more money to lend
- Interest rates fall, asset prices often rise

**When they use it:**
- During severe recessions (2008, 2020)
- When rates are already near zero
- To prevent deflation

**Impact on YOUR money:**
- **Positive:** Lower mortgage rates, higher stock prices
- **Negative:** Potential asset bubbles, wealth inequality
- **Neutral:** May not directly help if you don't own assets

#### 🎯 **Tool #3: Reserve Requirements**

**What it is:** How much money banks must keep on hand vs. lend out

**How it works:**
- Higher requirements → Banks lend less → Less money in economy
- Lower requirements → Banks lend more → More money in economy

**Less commonly used** but can be powerful in extreme situations

## Interest Rates: The Price of Money

### How Rate Changes Ripple Through Your Life

#### **Your Mortgage** (Most Direct Impact)
\`\`\`
$300,000 30-year mortgage:
- At 3% rate: $1,265/month payment
- At 5% rate: $1,610/month payment  
- At 7% rate: $1,996/month payment
\`\`\`

**Strategy:** 
- **Rising rates:** Consider locking in fixed rates
- **Falling rates:** Look into refinancing

#### **Your Savings Account**
\`\`\`
$10,000 in savings:
- At 0.5% rate: $50/year interest
- At 2.0% rate: $200/year interest
- At 4.0% rate: $400/year interest
\`\`\`

**Strategy:**
- **Rising rates:** Move money to high-yield accounts
- **Falling rates:** Consider other investments beyond cash

#### **Your Credit Cards and Loans**
Most credit cards have **variable rates** tied to the Fed funds rate:
\`\`\`
If Fed raises rates by 1%:
Your credit card rate typically goes up by 1% too
\`\`\`

**Strategy:**
- **Rising rates:** Pay down variable-rate debt aggressively
- **Consider fixed-rate loans** for major purchases

#### **Your Investments**

**Bonds:**
- **Rising rates:** Bond prices fall (but new bonds pay more)
- **Falling rates:** Bond prices rise (but new bonds may pay less)

**Stocks:**
- **Rising rates:** Growth stocks often hurt more than value stocks
- **Falling rates:** Growth stocks often benefit more

**Real Estate:**
- **Rising rates:** Higher mortgage costs reduce buyer demand
- **Falling rates:** Lower mortgage costs increase buyer demand

## Inflation: The Silent Wealth Destroyer

### What Inflation Really Means
Inflation is when the general price level of goods and services rises over time. Your dollar buys less stuff.

### Types of Inflation

#### **Demand-Pull Inflation**
- **Cause:** Too much money chasing too few goods
- **Example:** Pandemic stimulus + supply chain issues = higher prices
- **Fed response:** Raise interest rates to cool demand

#### **Cost-Push Inflation**
- **Cause:** Rising costs of production (labor, materials, energy)
- **Example:** Oil price shock increases transportation costs
- **Fed response:** Limited tools, may need to accept temporarily higher inflation

#### **Wage-Price Spiral**
- **Cause:** Workers demand higher wages → Companies raise prices → Workers demand even higher wages
- **Example:** 1970s inflation crisis
- **Fed response:** Aggressive rate hikes to break the cycle

### How Inflation Affects Different Assets

#### **Cash** 😞
- **Impact:** Loses purchasing power directly
- **Example:** $100 with 3% inflation becomes $97 in purchasing power after 1 year

#### **Bonds** 😐
- **Impact:** Fixed payments lose purchasing power
- **Exception:** Treasury Inflation-Protected Securities (TIPS) adjust with inflation

#### **Stocks** 😊 (Usually)
- **Impact:** Companies can often raise prices with inflation
- **Best:** Companies with pricing power (Coca-Cola, Apple)
- **Worst:** Companies with high fixed costs

#### **Real Estate** 😊
- **Impact:** Property values and rents typically rise with inflation
- **Benefit:** Fixed-rate mortgages become cheaper to pay off

#### **Commodities** 😊😊
- **Impact:** Often rise with or lead inflation
- **Examples:** Gold, oil, agricultural products

### Measuring Inflation: Key Indicators

#### **Consumer Price Index (CPI)**
- **What it measures:** Cost of a basket of goods and services
- **Includes:** Housing, food, transportation, medical care, education
- **Most commonly cited** in media

#### **Core CPI**
- **What it measures:** CPI excluding food and energy
- **Why exclude them:** They're volatile and can mask underlying trends
- **Fed prefers this** for policy decisions

#### **Personal Consumption Expenditures (PCE)**
- **What it measures:** Similar to CPI but broader and adjusts for substitution
- **Fed's preferred measure** for their 2% target

#### **Producer Price Index (PPI)**
- **What it measures:** Costs at the wholesale/producer level
- **Leading indicator:** Often signals consumer price changes

### Inflation's Personal Finance Impact

#### **Fixed Income Gets Crushed**
\`\`\`
Salary: $50,000/year
With 3% annual inflation:
Year 1: $50,000 = $50,000 purchasing power
Year 5: $50,000 = $43,147 purchasing power  
Year 10: $50,000 = $37,205 purchasing power
\`\`\`

**Strategy:** Negotiate regular raises, develop skills for higher pay

#### **Fixed-Rate Debt Becomes Cheaper**
\`\`\`
$200,000 mortgage at 3% fixed rate:
With 5% inflation:
Your salary (hopefully) rises 5% annually
But your mortgage payment stays the same
= Debt burden shrinks in real terms
\`\`\`

**Strategy:** Consider fixed-rate debt when inflation is rising

#### **Variable Income Can Keep Up**
- Business owners can raise prices
- Sales commissions may increase with higher prices
- Some jobs have built-in cost-of-living adjustments

### Historical Inflation Lessons

#### **The Great Inflation (1970s)**
- **Peak:** 13.5% in 1980
- **Causes:** Oil shocks, wage-price spirals, loose monetary policy
- **Solution:** Fed Chair Paul Volcker raised rates to 20%+
- **Lesson:** Controlling inflation requires painful medicine

#### **The Great Moderation (1990s-2000s)**
- **Range:** 1-4% annually
- **Causes:** Globalization, technology, credible Fed policy
- **Result:** Stable growth, low unemployment
- **Lesson:** Price stability supports economic growth

#### **Post-2008 Low Inflation**
- **Range:** 0-2% annually
- **Causes:** Slow recovery, globalization, technology
- **Fed response:** Quantitative easing to prevent deflation
- **Lesson:** Too-low inflation can be as problematic as too-high

#### **Post-COVID Inflation Surge (2021-2022)**
- **Peak:** 9.1% in June 2022
- **Causes:** Supply chain issues, stimulus spending, labor shortages
- **Fed response:** Aggressive rate hikes (0% to 5.25% in 18 months)
- **Lesson:** Inflation can return unexpectedly

## Reading the Fed: What Investors Watch

### Federal Open Market Committee (FOMC) Meetings
- **Frequency:** 8 times per year (every 6 weeks)
- **Key outputs:** 
  - Rate decision
  - Policy statement
  - Economic projections ("dot plot")
  - Chair's press conference

### The Fed's Communication Strategy

#### **"Dot Plot"**
- Shows where each Fed member thinks rates should be
- Forward guidance for markets
- Can shift dramatically with new data

#### **Fed Speak Translation**
- **"Patient"** = No rate changes soon
- **"Data dependent"** = We'll see what happens
- **"Gradual"** = Slow, predictable changes
- **"Measured"** = Small, careful adjustments

### Market Reactions to Fed Actions

#### **Rate Hikes**
- **Immediate:** Dollar strengthens, bond yields rise
- **Stocks:** Often fall initially, especially growth stocks
- **Real estate:** Mortgage rates rise, activity slows

#### **Rate Cuts**
- **Immediate:** Dollar weakens, bond yields fall
- **Stocks:** Often rally, especially growth stocks
- **Real estate:** Mortgage rates fall, activity increases

#### **Quantitative Easing**
- **Bonds:** Prices rise (yields fall)
- **Stocks:** Often rally from increased liquidity
- **Dollar:** May weaken from money supply increase

## Personal Finance Strategies for Different Rate Environments

### 📈 **Rising Rate Environment**

**Debt Management:**
- Pay down variable-rate debt (credit cards, HELOCs)
- Consider refinancing to fixed rates before rates rise more
- Avoid taking on new debt unless necessary

**Savings & Investments:**
- Move cash to high-yield savings accounts or CDs
- Consider shorter-term bonds or bond ladders
- Value stocks may outperform growth stocks

**Real Estate:**
- If buying: Consider locking in mortgage rates quickly
- If selling: Price aggressively as buyer demand may fall
- If refinancing: Act fast before rates rise further

### 📉 **Falling Rate Environment**

**Debt Management:**
- Refinance existing fixed-rate debt to lower rates
- Consider variable-rate debt if rates are expected to fall further
- Good time for major purchases requiring financing

**Savings & Investments:**
- Lock in longer-term CDs or bonds before rates fall more
- Growth stocks may outperform value stocks
- REITs often perform well in falling rate environments

**Real Estate:**
- Excellent time to buy with lower mortgage costs
- Refinancing can significantly reduce monthly payments
- Property values may rise with increased buyer demand

### 🎯 **Stable Rate Environment**

**Focus on fundamentals:**
- Build emergency fund in high-yield savings
- Diversified investment portfolio
- Regular debt payments
- Skills development for career growth

## Global Considerations

### Other Central Banks
- **European Central Bank (ECB):** Often more conservative than Fed
- **Bank of Japan (BOJ):** Has dealt with deflation for decades
- **People's Bank of China:** More direct government control

### Currency Effects
- **Strong dollar:** Hurts U.S. exports, helps imports
- **Weak dollar:** Helps U.S. exports, hurts imports
- **Your portfolio:** International investments affected by currency moves

## Key Takeaways

1. **The Fed drives interest rates**, which affect almost every aspect of your financial life
2. **Inflation erodes purchasing power** - protect yourself with assets that keep up
3. **Rate changes take time to impact the economy** - be patient with Fed policy
4. **Fighting the Fed is expensive** - align your strategy with policy direction
5. **Your biggest inflation hedge is your career** - keep developing valuable skills
6. **Fixed-rate debt is good during inflation** - lock in rates when they're reasonable
7. **Cash loses value during inflation** - but provides flexibility during uncertainty

**Remember:** You can't control Fed policy, but you can position your finances to benefit from whatever direction they choose. The key is understanding the game they're playing and how it affects your money.

**Next up:** We'll explore how to read economic indicators and interpret global events that drive market movements and investment opportunities.
            `
          },
          {
            type: "video",
            depth: ["comprehensive", "expert"],
            title: "Federal Reserve Policy Explained: How the Fed Affects Your Money",
            url: "https://www.youtube.com/embed/1FJ-UwKFWWc",
            description: "Comprehensive guide to understanding Federal Reserve decisions and their personal finance impact"
          },
          {
            type: "fed_policy_calculator",
            depth: ["comprehensive", "expert"],
            title: "Fed Rate Impact Calculator",
            description: "Calculate how Federal Reserve rate changes affect your loans, savings, and investments"
          }
        ]
      },
      {
        id: 3,
        title: "Market Analysis & Global Events",
        type: "global_analysis",
        contentBlocks: [
          {
            type: "markdown_text",
            depth: ["overview", "comprehensive", "expert"],
            title: "Reading the Global Tea Leaves: How World Events Move Markets and Your Money",
            value: `
# Market Analysis & Global Events

Every day, headlines scream about economic data, geopolitical tensions, and market movements. But what do these events actually mean for your portfolio and personal finances? Let's decode the signals that matter and learn how to separate noise from actionable insights.

## Economic Indicators: Your Financial Weather Report

Think of economic indicators like weather reports—they help you understand current conditions and prepare for what's coming. But just like weather forecasts, they're not perfect, and you need to know how to interpret them.

### 📊 **Gross Domestic Product (GDP): The Economy's Report Card**

**What it measures:** Total value of all goods and services produced in a country

**Why it matters:** GDP growth indicates economic health
- **2-4% growth:** Healthy, sustainable expansion
- **Above 4%:** Strong growth but potential overheating
- **0-2%:** Slow growth, possible recession risk
- **Negative growth:** Recession (two consecutive quarters = official recession)

**How markets react:**
- **Strong GDP:** Stocks often rise, but may fall if it triggers Fed rate hikes
- **Weak GDP:** Stocks may fall, but could rise if it means Fed stimulus

**Your money moves:**
- **Strong GDP:** Good for employment, wages; may signal rate increases
- **Weak GDP:** Job market may soften; good for refinancing debt

### 📈 **Unemployment Rate: The Job Market Thermometer**

**What it measures:** Percentage of people actively looking for work who can't find it

**Key levels:**
- **2-4%:** Full employment (very good)
- **4-6%:** Normal/healthy range
- **6-8%:** Elevated, concerning
- **Above 8%:** Crisis levels

**Related indicators:**
- **Initial jobless claims:** Weekly new unemployment filings (leading indicator)
- **Continuing claims:** People still receiving benefits
- **Labor force participation:** Percentage of adults working or looking for work

**Market reactions:**
- **Low unemployment:** Good for consumer spending, but may signal wage inflation
- **High unemployment:** Bad for consumer companies, good for Fed stimulus

**Your money moves:**
- **Low unemployment:** Easier to find jobs, negotiate raises
- **High unemployment:** Focus on job security, build emergency fund

### 🛒 **Consumer Price Index (CPI): The Inflation Tracker**

**What it measures:** Cost of a basket of goods and services over time

**Key components:**
- **Housing:** 33% of index (rent, utilities)
- **Transportation:** 17% (cars, gas, public transit)
- **Food:** 13% (groceries, restaurants)
- **Medical care:** 8%
- **Everything else:** Recreation, education, clothing

**Types of CPI:**
- **Headline CPI:** Includes everything
- **Core CPI:** Excludes volatile food and energy prices
- **Services CPI:** Labor-intensive sectors (harder to reduce)

**Market reactions:**
- **High inflation:** Bonds fall, some stocks fall, commodities rise
- **Low inflation:** Bonds rise, growth stocks may benefit

**Your money moves:**
- **High inflation:** Focus on assets that keep up (stocks, real estate, commodities)
- **Low inflation:** Cash and bonds preserve purchasing power better

### 🏭 **Purchasing Managers' Index (PMI): The Business Pulse**

**What it measures:** Survey of purchasing managers about business conditions

**Scale:**
- **Above 50:** Expansion
- **Below 50:** Contraction
- **45-55:** Stable/neutral

**Components:**
- New orders
- Production levels
- Employment
- Supplier deliveries
- Inventories

**Why it's valuable:**
- **Released monthly** (more frequent than GDP)
- **Forward-looking** (based on business plans)
- **Available globally** (can compare countries)

### 💰 **Consumer Confidence Index: The Mood Meter**

**What it measures:** How optimistic consumers feel about the economy

**Components:**
- Current economic conditions
- Six-month outlook for economy
- Six-month outlook for employment

**Why it matters:**
- Consumer spending = 70% of U.S. economy
- Confident consumers spend more
- Pessimistic consumers save more, spend less

**Market impact:**
- **High confidence:** Consumer stocks (retail, restaurants) benefit
- **Low confidence:** Defensive stocks (utilities, healthcare) outperform

## How Markets React to Data: The Goldilocks Principle

Markets don't always react logically to economic data. Here's why:

### **Good News Can Be Bad News**
- **Strong economic data** might signal Fed rate hikes → stocks fall
- **Weak economic data** might signal Fed stimulus → stocks rise

### **Bad News Can Be Good News**  
- **Rising unemployment** might mean Fed cuts rates → stocks rise
- **Falling inflation** might mean no more rate hikes → stocks rise

### **The Goldilocks Economy**
Markets love data that's "just right":
- **Growth:** Strong enough to support earnings, not so strong to trigger aggressive Fed action
- **Inflation:** High enough to signal healthy demand, low enough to avoid policy tightening
- **Employment:** Low enough for strong consumer spending, high enough to avoid wage spirals

## Global Events That Move Markets

### 🌍 **Geopolitical Events**

#### **War and Conflict**
- **Initial reaction:** Flight to safety (gold, U.S. Treasuries, dollar)
- **Affected sectors:** Defense stocks up, travel stocks down
- **Oil impact:** Prices spike if major producers involved
- **Duration matters:** Markets adapt to ongoing conflicts

**Historical examples:**
- **9/11:** Market closed 4 days, fell 7% when reopened
- **Iraq War (2003):** Market actually rose during "shock and awe"
- **Russia-Ukraine (2022):** Energy and food prices spiked

#### **Trade Wars**
- **Export-dependent companies:** Hurt by tariffs
- **Import-dependent companies:** Hurt by higher costs
- **Currency effects:** Trade war countries see currency volatility
- **Global supply chains:** Disrupted, costs increase

**Your money moves:**
- **Diversify globally** to reduce single-country risk
- **Avoid overconcentration** in trade-sensitive sectors
- **Consider defensive sectors** during uncertainty

### 🛢️ **Oil Price Shocks**

**Why oil matters:**
- **Energy costs** affect every business
- **Transportation costs** impact supply chains
- **Consumer spending** shifts when gas prices changes
- **Inflation indicator** closely watched by Fed

**Market effects:**
- **Oil spike:** Energy stocks up, airline stocks down, inflation fears
- **Oil crash:** Energy stocks down, consumer discretionary up, deflation fears

**Rule of thumb:** $10 oil increase = ~0.2% GDP growth reduction

### 🦠 **Pandemics and Natural Disasters**

#### **COVID-19 Lessons (2020)**
- **Initial panic:** Markets fell 34% in 5 weeks
- **Sector rotation:** Tech up, travel down
- **Government response:** Massive stimulus supported recovery
- **Behavioral changes:** Accelerated digital adoption

**Categories of impact:**
- **Winners:** Technology, healthcare, delivery services
- **Losers:** Travel, hospitality, brick-and-mortar retail
- **Mixed:** Real estate (residential up, commercial down)

### 🏦 **Financial System Events**

#### **Bank Failures**
- **2008 Lehman Brothers:** Credit markets froze globally
- **2023 Silicon Valley Bank:** Regional bank concerns, deposit flight

#### **Currency Crises**
- **Emerging market currencies:** Often see capital flight during stress
- **Developed market currencies:** Usually more stable but can have big moves

#### **Sovereign Debt Crises**
- **European debt crisis (2010-2012):** Euro weakness, flight to U.S. assets
- **Lessons:** Even developed countries can have debt problems

## Reading Market Reactions: A Framework

### **Step 1: Identify the Event Type**
- **Economic data:** GDP, inflation, employment
- **Policy announcement:** Fed decision, government action
- **Geopolitical:** War, trade dispute, political change
- **Corporate:** Earnings, mergers, scandals
- **Technical:** Market structure, algorithmic trading

### **Step 2: Assess the Surprise Factor**
Markets price in expectations. What matters is the **difference between expectations and reality**.

- **Big positive surprise:** Usually bullish for markets
- **Small positive surprise:** May already be priced in
- **Big negative surprise:** Usually bearish for markets
- **Expected news:** Often limited market reaction

### **Step 3: Consider the Context**
- **Market environment:** Bull or bear market affects reactions
- **Economic cycle:** Same news impacts differently in expansion vs. recession
- **Fed policy stance:** Hawkish or dovish Fed changes interpretation
- **Global backdrop:** Other major events happening simultaneously

### **Step 4: Think About Duration**
- **Headlines vs. fundamentals:** News creates short-term moves, fundamentals drive long-term trends
- **Market memory:** Investors quickly move on from most events
- **Structural changes:** Some events permanently alter how markets work

## The Paradoxes of Market Reactions

### **The "Buy the Rumor, Sell the News" Phenomenon**
- Markets often move more on expectations than actual events
- By the time news breaks, it may already be "priced in"
- Professional traders often take profits when expected good news arrives

### **The "Bad News is Good News" Market**
When the Fed is expected to cut rates:
- **Bad economic data** = More likely Fed cuts = Stocks rise
- **Good economic data** = Less likely Fed cuts = Stocks fall

### **The "Flight to Quality" Effect**
During uncertainty, money flows to:
- **U.S. Treasury bonds** (safe haven)
- **Gold** (store of value)
- **U.S. dollar** (global reserve currency)
- **High-dividend stocks** (income focus)

## Sector Analysis: Who Wins and Loses

### **Interest Rate Sensitive Sectors**

#### **Rising Rates Hurt:**
- **REITs:** Higher rates make yields less attractive
- **Utilities:** Bond-like characteristics, dividend yields less competitive
- **Growth stocks:** Future cash flows worth less when discounted at higher rates

#### **Rising Rates Help:**
- **Banks:** Net interest margins improve with higher rates
- **Insurance companies:** Invest reserves at higher yields

### **Inflation Sensitive Sectors**

#### **Inflation Benefits:**
- **Commodities:** Oil, gold, agricultural products
- **Real estate:** Property values and rents typically rise
- **Consumer staples:** Can pass through price increases

#### **Inflation Hurts:**
- **Long-term bonds:** Fixed payments lose purchasing power
- **Growth companies:** High valuations harder to justify

### **Economic Cycle Sensitive Sectors**

#### **Early Expansion Winners:**
- **Technology:** Business investment increases
- **Consumer discretionary:** People start spending on wants
- **Small caps:** More sensitive to economic growth

#### **Late Expansion Winners:**
- **Energy:** High economic activity drives demand
- **Materials:** Infrastructure and construction activity peaks

#### **Recession Defensive:**
- **Consumer staples:** People still need food and basics
- **Healthcare:** Medical needs don't disappear
- **Utilities:** Steady demand for electricity and water

## Building Your Global Macro Framework

### **Daily Monitoring (5 minutes)**
- Check major market indices (S&P 500, international markets)
- Scan headlines for major geopolitical events
- Note any significant economic data releases

### **Weekly Review (30 minutes)**
- Review key economic indicators released that week
- Assess any Fed communications or policy changes
- Evaluate your portfolio's sector exposures

### **Monthly Deep Dive (2 hours)**
- Analyze month's economic data trends
- Review central bank policies globally
- Rebalance portfolio if major themes have shifted

### **Quarterly Strategy Review (4 hours)**
- Assess how global macro trends affect your goals
- Adjust asset allocation based on cycle phase
- Review and update your investment thesis

## Personal Finance Applications

### **Career Planning**
- **Economic expansion:** Time to ask for raises, change jobs
- **Economic uncertainty:** Focus on skills, job security
- **Sector rotation:** Consider which industries are growing

### **Major Purchase Timing**
- **Home buying:** Consider interest rate trends, regional economics
- **Car buying:** End of cycle often brings deals
- **Education:** Recession can be good time to go back to school

### **Investment Strategy**
- **Asset allocation:** Adjust based on cycle and global trends
- **Geographic diversification:** Don't put all money in one country
- **Sector rotation:** Overweight sectors likely to benefit

### **Risk Management**
- **Emergency fund:** Size based on economic cycle and job security
- **Insurance:** Consider coverage for economic disruption
- **Debt management:** Variable vs. fixed rates based on rate environment

## Common Mistakes to Avoid

### **Overreacting to Headlines**
- Most news has limited long-term impact
- Markets are forward-looking, news is backward-looking
- Daily noise vs. long-term signal

### **Fighting Central Banks**
- "Don't fight the Fed" is an old Wall Street adage
- Policy makers have powerful tools and strong incentives
- Align strategy with policy direction, don't oppose it

### **Ignoring Global Context**
- U.S. is ~25% of global economy
- International diversification provides protection
- Global events can have major local impacts

### **Timing the Market**
- Very difficult to consistently time major moves
- Better to position for trends than try to time them perfectly
- Stay invested, adjust positioning gradually

## Key Takeaways

1. **Economic indicators are backward-looking** but markets are forward-looking
2. **Context matters more than absolute numbers** - surprises move markets
3. **Bad news can be good news** when it changes policy expectations
4. **Global events affect local portfolios** through multiple channels
5. **Sector rotation** is as important as overall market direction
6. **Central bank policy** drives much of market behavior
7. **Stay informed but don't overreact** to daily news flow

**Remember:** You don't need to predict the future perfectly. You just need to understand the major forces at work and position your finances to benefit from likely scenarios while protecting against unlikely but devastating ones.

**Next up:** Put your knowledge to the test with our interactive headline analyzer and economic scenario simulator.
            `
          },
          {
            type: "video",
            depth: ["comprehensive", "expert"],
            title: "Global Markets and Economic Indicators: Reading the Signs",
            url: "https://www.youtube.com/embed/u9GMdXKY4hU",
            description: "Learn to interpret economic data and global events that drive market movements"
          },
          {
            type: "headline_analyzer",
            depth: ["comprehensive", "expert"],
            title: "Interactive Headline Analyzer Game",
            description: "Test your ability to predict market reactions to real economic news and events"
          }
        ]
      }
    ]
  },
  {
    id: "tax-strategy",
    title: "Keep More of What You Earn: Master Advanced Tax Planning",
    description: "From tax-efficient investing to estate strategies, learn how to minimize taxes and maximize wealth",
    difficulty: "Advanced",
    duration: "90-180 min",
    icon: "💼",
    category: "Wealth Optimization",
    heroTitle: "Keep More of What You Earn: Master Advanced Tax Planning",
    heroSubtitle: "From tax-efficient investing to estate strategies, learn how to minimize taxes and maximize wealth",
    learningOutcomes: [
      "Structure investments for tax efficiency (capital gains, dividends, tax-loss harvesting)",
      "Leverage tax-advantaged accounts (401k, IRA, HSA, Roth) strategically",
      "Apply income shifting and bracket management strategies",
      "Learn estate planning basics (trusts, gifting, step-up in basis)",
      "Integrate real-world tax reduction techniques into financial planning"
    ],
    expertTopics: ["Asset location", "Tax-loss harvesting", "Roth conversions", "Estate planning"],
    lessons: [
      {
        id: 1,
        title: "Tax-Efficient Investing & Asset Location",
        type: "advanced_tax_analysis",
        contentBlocks: [
          {
            type: "markdown_text",
            depth: ["overview", "comprehensive", "expert"],
            title: "The Tax-Smart Investor's Playbook",
            value: `
# Tax-Efficient Investing & Asset Location

Taxes are one of the biggest drags on investment returns, yet most investors ignore tax efficiency until it's too late. A well-designed tax strategy can add 1-2% annually to your after-tax returns—equivalent to finding an extra $10,000-$20,000 per year on a $1 million portfolio. Let's master the strategies that separate smart investors from the crowd.

## Understanding Investment Taxation

### Capital Gains: The Foundation of Tax Strategy

**Short-Term Capital Gains (Held ≤ 1 Year)**
- **Tax rate:** Same as ordinary income (up to 37% federal + state)
- **Strategy:** Avoid whenever possible by holding longer

**Long-Term Capital Gains (Held > 1 Year)**
- **0% rate:** Single income up to $47,025 (2024), married up to $94,050
- **15% rate:** Single $47,026-$518,900, married $94,051-$583,750  
- **20% rate:** Above those thresholds
- **Strategy:** Plan realizations to stay in lower brackets

**Real Example:**
\`\`\`
$10,000 stock gain after 11 months vs. 13 months:
Short-term (37% bracket): $3,700 tax owed
Long-term (15% bracket): $1,500 tax owed
Savings from waiting 2 months: $2,200
\`\`\`

### Dividend Taxation: Not All Income is Equal

**Qualified Dividends**
- **Requirements:** U.S. company or qualified foreign company, held >60 days
- **Tax rate:** Same favorable rates as long-term capital gains (0%, 15%, 20%)
- **Examples:** Apple, Microsoft, Johnson & Johnson

**Non-Qualified Dividends** 
- **Tax rate:** Ordinary income rates (up to 37%)
- **Examples:** REITs, master limited partnerships (MLPs), some foreign companies

**Tax Impact Example:**
\`\`\`
$5,000 annual dividends in 32% bracket:
Qualified dividends: $750 tax (15% rate)
Non-qualified dividends: $1,600 tax (32% rate)
Annual difference: $850 saved
\`\`\`

### Interest and Bond Income

**Taxable Bonds**
- **Federal:** Ordinary income rates
- **State:** Varies by state and bond type

**Municipal Bonds**
- **Federal:** Tax-free
- **State:** Often tax-free if issued in your state
- **AMT consideration:** Some "private activity" munis subject to alternative minimum tax

**Tax-Equivalent Yield Formula:**
\`\`\`
Tax-Equivalent Yield = Municipal Yield ÷ (1 - Tax Rate)

Example: 3% muni bond vs. taxable bond for 32% bracket
3% ÷ (1 - 0.32) = 4.41%
You'd need >4.41% on taxable bond to beat the muni
\`\`\`

## Asset Location: The Right Investment in the Right Account

Asset location is arguably more important than asset allocation for high-net-worth investors. It's about placing investments in the account type that minimizes lifetime taxes.

### Account Types and Tax Treatment

#### **Taxable Accounts**
- **Contributions:** After-tax money
- **Growth:** Taxed on dividends/interest annually, capital gains when sold
- **Withdrawals:** No penalties, but pay taxes on gains
- **Best for:** Tax-efficient investments, liquidity needs

#### **Traditional IRA/401(k) - Tax-Deferred**
- **Contributions:** Tax-deductible (reduces current income)  
- **Growth:** Tax-free while invested
- **Withdrawals:** Taxed as ordinary income, required minimum distributions (RMDs) at 73
- **Best for:** Investments that generate ordinary income

#### **Roth IRA/401(k) - Tax-Free**
- **Contributions:** After-tax money (no deduction)
- **Growth:** Tax-free forever
- **Withdrawals:** Tax-free in retirement, no RMDs
- **Best for:** High-growth investments, young investors

#### **Health Savings Account (HSA) - Triple Tax Advantage**
- **Contributions:** Tax-deductible
- **Growth:** Tax-free  
- **Withdrawals:** Tax-free for medical expenses (any purpose penalty-free after 65)
- **Best for:** Maximum tax efficiency, high-growth investments

### The Asset Location Hierarchy

#### **Priority 1: Taxable Accounts**
**Best investments:**
- **Broad market index funds/ETFs:** Low turnover, mostly qualified dividends
- **Tax-managed funds:** Specifically designed to minimize taxable distributions
- **Individual stocks held long-term:** Control timing of gains recognition
- **International developed market funds:** Foreign tax credit benefits
- **Municipal bonds:** Tax-free income (for high earners)

**Avoid:**
- High-yield bonds (ordinary income)
- REITs (non-qualified dividends)
- Actively managed funds with high turnover
- Commodities/futures (ordinary income treatment)

#### **Priority 2: Traditional IRA/401(k)**  
**Best investments:**
- **Bonds and bond funds:** Convert ordinary income to capital gains at withdrawal
- **REITs:** High dividend yields taxed as ordinary income anyway
- **High-yield dividend stocks:** Utilities, telecom
- **Actively managed funds:** Turnover doesn't matter here
- **Alternative investments:** Private equity, hedge funds

**Logic:** These accounts convert everything to ordinary income at withdrawal, so put assets that would be taxed highly in taxable accounts

#### **Priority 3: Roth IRA/HSA**
**Best investments:**  
- **High-growth stocks:** Small-cap, emerging markets, growth companies
- **Volatile investments:** Cryptocurrency, individual growth stocks
- **Alternative investments with high returns:** If available
- **Anything expected to appreciate significantly**

**Logic:** Tax-free growth forever, so maximize the benefit with highest expected returns

### Advanced Asset Location Strategies

#### **Tax-Loss Harvesting**
**The Process:**
1. **Identify losses:** Find investments worth less than you paid
2. **Sell for tax benefit:** Realize losses to offset gains
3. **Avoid wash sale:** Don't buy identical security within 30 days
4. **Reinvest proceeds:** Buy similar but not identical investment

**Example:**
\`\`\`
You bought Apple stock for $10,000, now worth $8,000
Sell Apple for $2,000 tax loss
Buy Microsoft or tech ETF with proceeds
Use $2,000 loss to offset other gains or $3,000 against ordinary income
\`\`\`

**Wash Sale Rule Violations:**
- ❌ Sell Apple, buy Apple within 30 days
- ❌ Sell S&P 500 fund, buy different S&P 500 fund
- ✅ Sell Apple, buy Microsoft  
- ✅ Sell S&P 500 fund, buy total market fund

#### **Tax-Gain Harvesting** 
When you're in 0% capital gains bracket:
- Realize long-term gains tax-free
- Reset cost basis higher for future
- Especially valuable for young investors or retirees with low income

#### **Asset Location Rebalancing**
Instead of selling overweight assets:
1. **Direct new contributions** to underweight asset classes
2. **Use dividends** to buy underweight assets  
3. **Rebalance within tax-advantaged accounts** where possible

## Tax-Efficient Fund Selection

### Index Funds vs. Active Funds

**Index Fund Advantages:**
- **Lower turnover:** Fewer taxable distributions
- **Predictable taxes:** Only rebalancing creates taxable events
- **Lower expense ratios:** More money stays invested

**Tax Efficiency Metrics to Compare:**
- **Turnover ratio:** Lower is better (<10% excellent, >50% poor)
- **Tax-adjusted returns:** After-tax performance vs. pre-tax
- **Distribution yield:** What percentage paid out as dividends

### Municipal Bond Strategy

**When Munis Make Sense:**
- **High tax bracket:** 32% federal or higher
- **High-tax state:** CA, NY, NJ, etc.
- **Stable income needs:** Retirees, conservative investors

**Muni vs. Taxable Comparison:**
\`\`\`
Investor in 37% federal + 13% state = 50% combined bracket
4% Taxable bond after-tax yield: 4% × (1 - 0.50) = 2%  
3% Tax-free muni after-tax yield: 3%
Muni wins even at lower stated yield
\`\`\`

### International Tax Considerations

**Foreign Tax Credit:**
- **Benefit:** Avoid double taxation on foreign investments
- **Requirement:** Must hold in taxable account to claim credit
- **Strategy:** Hold international funds in taxable accounts when possible

**Currency Hedging:**
- **Unhedged funds:** Currency gains/losses can create tax complications
- **Hedged funds:** More predictable tax treatment but higher costs

## Estate Planning and Step-Up in Basis

### The Step-Up Strategy
**How it works:**
- **During life:** Hold appreciated assets, never sell
- **At death:** Heirs inherit at current market value ("stepped-up basis")
- **Result:** Capital gains tax permanently avoided

**Example:**
\`\`\`
Buy stock for $10,000 in 1990
Worth $100,000 at death in 2024
Without step-up: $90,000 taxable gain
With step-up: $0 taxable gain to heirs
Tax savings: ~$18,000 (20% rate)
\`\`\`

**Strategic Implications:**
- **Hold appreciated assets until death** when possible
- **Give away depreciated assets** while alive
- **Consider gifting vs. inheritance** timing carefully

### Charitable Giving Strategies

**Donor-Advised Funds:**
- **Immediate deduction:** Full fair market value
- **No capital gains:** Donate appreciated securities directly
- **Flexible timing:** Grant to charities over time

**Charitable Remainder Trusts (CRTs):**
- **Tax deduction:** Partial immediate deduction
- **Income stream:** Payments for life or term of years
- **No capital gains:** On assets donated to trust

## Practical Implementation Framework

### Annual Tax Planning Checklist

**Q4 (October-December):**
- **Review portfolio gains/losses** for harvesting opportunities
- **Estimate tax liability** and plan Roth conversions
- **Bunch deductions** if beneficial (charitable giving, medical expenses)
- **Max out retirement contributions** before year-end

**Q1 (January-March):**
- **Complete prior year contributions** (IRA deadline = tax filing deadline)
- **Review asset location** and rebalance if needed
- **Plan current year Roth conversion strategy**
- **Update estate planning documents** if needed

**Ongoing:**
- **Track cost basis** for all investments
- **Document charitable contributions** and other deductions
- **Monitor tax law changes** that affect strategy
- **Coordinate with tax professional** for complex situations

### Technology and Automation

**Robo-Advisor Tax Features:**
- **Automatic tax-loss harvesting:** Daily monitoring and optimization
- **Asset location optimization:** Algorithms place assets efficiently  
- **Tax-coordinated rebalancing:** Minimize tax impact of portfolio changes

**Popular Platforms:**
- **Wealthfront:** Advanced tax-loss harvesting, direct indexing
- **Betterment:** Tax coordination across accounts
- **Schwab Intelligent:** No fees for tax-loss harvesting

### Working with Professionals

**When to Get Help:**
- **Complex situations:** Multiple account types, business ownership, estate planning
- **High income:** Alternative minimum tax, net investment income tax
- **Major life changes:** Marriage, divorce, inheritance, retirement
- **Advanced strategies:** Trusts, charitable planning, business succession

**Types of Professionals:**
- **CPA:** Tax preparation and planning
- **Fee-only financial advisor:** Comprehensive planning
- **Estate attorney:** Wills, trusts, estate planning
- **Tax attorney:** Complex tax issues and disputes

## Key Takeaways

1. **Tax efficiency can add 1-2% annually** to your returns through smart strategies
2. **Asset location matters more than asset allocation** for high-net-worth investors  
3. **Hold investments >1 year** to get favorable capital gains treatment
4. **Use tax-advantaged accounts strategically** - growth in Roth, income in traditional
5. **Tax-loss harvesting** can generate significant value when automated
6. **Municipal bonds** make sense for high earners in high-tax states
7. **Step-up in basis** makes holding appreciated assets until death powerful
8. **Annual tax planning** in Q4 can save thousands in taxes

**Remember:** Tax laws change, brackets adjust for inflation, and your personal situation evolves. The key is understanding the principles and adapting them to your specific circumstances while staying current with tax law changes.

**Next up:** We'll dive into strategic tax planning and income management, including advanced techniques like Roth conversions and bracket management that can save you tens of thousands over your lifetime.
            `
          },
          {
            type: "video",
            depth: ["comprehensive", "expert"],
            title: "Tax-Efficient Investing: Asset Location and Tax-Loss Harvesting",
            url: "https://www.youtube.com/embed/l_haN3BA6kU",
            description: "Master the strategies that can add 1-2% annually to your after-tax returns"
          },
          {
            type: "asset_location_optimizer",
            depth: ["comprehensive", "expert"],
            title: "Interactive Asset Location Optimizer",
            description: "Find the optimal placement for your investments across taxable and tax-advantaged accounts"
          }
        ]
      },
      {
        id: 2,
        title: "Strategic Tax Planning & Income Management",
        type: "tax_strategy_planning",
        contentBlocks: [
          {
            type: "markdown_text",
            depth: ["overview", "comprehensive", "expert"],
            title: "Income Management and Tax Optimization Strategies",
            value: `
# Strategic Tax Planning & Income Management

Most people think tax planning happens once a year when filing returns. Smart investors think about taxes with every financial decision, using strategies that can save tens of thousands of dollars over a lifetime. This lesson covers advanced techniques for managing your tax bracket, timing income and deductions, and leveraging tax-advantaged accounts like a pro.

## Understanding the U.S. Tax System

### Marginal vs. Effective Tax Rates

**Marginal Tax Rate:** The rate you pay on your last dollar of income
**Effective Tax Rate:** Total taxes ÷ total income

**2024 Tax Brackets (Single Filers):**
\`\`\`
$0 - $11,600: 10%
$11,601 - $47,150: 12%  
$47,151 - $100,525: 22%
$100,526 - $191,750: 24%
$191,751 - $243,725: 32%
$243,726 - $609,350: 35%
$609,351+: 37%
\`\`\`

**Example: $80,000 income single filer**
\`\`\`
First $11,600: $11,600 × 10% = $1,160
Next $35,550: $35,550 × 12% = $4,266  
Next $32,850: $32,850 × 22% = $7,227
Total tax: $12,653
Effective rate: 15.8%
Marginal rate: 22%
\`\`\`

**Key Insight:** You don't pay your marginal rate on all income—each bracket is taxed at its respective rate.

### Additional Tax Considerations

**Net Investment Income Tax (NIIT)**
- **Rate:** 3.8% on investment income
- **Threshold:** $200k single, $250k married filing jointly
- **Applies to:** Interest, dividends, capital gains, rental income

**Alternative Minimum Tax (AMT)**
- **Purpose:** Ensures high earners pay minimum tax
- **Rate:** 26% or 28% on AMT income
- **Common triggers:** Large tax deductions, incentive stock options, private activity municipal bonds

## Tax Timing Strategies

### Income Deferral and Acceleration

**When to Defer Income:**
- **Currently in high bracket** but expect lower bracket next year
- **Approaching NIIT threshold** ($200k/$250k)
- **Early retirement** years before Social Security/RMDs

**Techniques:**
- **Delay bonuses** until January of following year
- **Defer Roth conversions** to lower-income years
- **Time stock option exercises** strategically
- **Postpone asset sales** near year-end

**When to Accelerate Income:**
- **Currently in low bracket** but expect higher bracket next year  
- **Zero capital gains bracket** opportunity
- **Before retirement** while still earning

**Example:**
\`\`\`
Executive earning $180k expecting $250k next year
Current year: 24% marginal rate
Next year: 32% marginal rate + 3.8% NIIT = 35.8%
Strategy: Accelerate $20k of income this year
Tax savings: $20k × (35.8% - 24%) = $2,360
\`\`\`

### Deduction Bunching Strategy

**The Concept:** Concentrate deductible expenses in alternating years to exceed standard deduction

**2024 Standard Deduction:**
- Single: $14,600
- Married filing jointly: $29,200

**Bunching Targets:**
- **Charitable contributions:** Make 2 years' worth in one year
- **Medical expenses:** Schedule elective procedures in same year  
- **State and local taxes:** Pay property tax bills early or late
- **Investment expenses:** Bunch advisor fees, subscriptions

**Example:**
\`\`\`
Married couple with $25k annual charitable giving + $8k other deductions = $33k total

Normal approach:
Years 1 & 2: Take $29,200 standard deduction each year
Total deductions: $58,400

Bunching approach:  
Year 1: $50k charitable + $8k other = $58k itemized
Year 2: $0 charitable + $8k other = $29.2k standard  
Total deductions: $87,200

Additional tax benefit: ($87.2k - $58.4k) × 24% = $6,912 saved
\`\`\`

## Tax-Advantaged Account Strategies

### Traditional vs. Roth IRA Decision Framework

**Choose Traditional IRA/401(k) when:**
- **Current tax rate > expected retirement rate**
- **High current income** but expect lower retirement income
- **Need immediate tax deduction**
- **Approaching NIIT thresholds**

**Choose Roth IRA/401(k) when:**
- **Current tax rate < expected future rate**
- **Young with low current income** but high earning potential
- **Want tax diversification**
- **Expect higher tax rates in future**

**Tax Rate Comparison Example:**
\`\`\`
25-year-old earning $60k (12% bracket)
vs.
Retirement at $80k equivalent income (22% bracket)

$6,000 Roth contribution:
Cost now: $6,000 (after-tax)
Value at retirement: Tax-free

$6,000 Traditional contribution:  
Cost now: $4,080 (after $1,920 tax savings)
Value at retirement: $6,000 taxable as ordinary income

Breakeven: Traditional wins if retirement rate < 12%
Roth wins if retirement rate > 12%
\`\`\`

### Advanced Roth Strategies

#### **Backdoor Roth IRA**
**Who needs it:** High earners above Roth IRA income limits
**2024 Limits:** Roth IRA phases out $138k-$153k (single), $218k-$228k (married)

**Process:**
1. **Contribute to non-deductible Traditional IRA:** $7,000 for 2024
2. **Immediately convert to Roth:** Minimal tax impact if no growth
3. **Result:** $7,000 in Roth IRA despite income limits

**Pro rata rule caution:** If you have other Traditional IRA balances, conversion is partially taxable

#### **Mega Backdoor Roth**
**Requirements:** 401(k) plan allows after-tax contributions and in-service withdrawals
**Process:**
1. **Max regular 401(k):** $23,500 for 2024 ($30,500 if 50+)
2. **Add after-tax contributions:** Up to $69,000 total limit
3. **Convert after-tax portion to Roth:** Either in-plan or rollover to Roth IRA
4. **Result:** Up to $45,500 additional Roth space ($52,500 if 50+)

**Example:**
\`\`\`
High earner with Mega Backdoor Roth capability:
Regular 401(k): $23,500 (pre-tax)
After-tax 401(k): $45,500 
Convert after-tax to Roth: $45,500
Total retirement savings: $69,000
Roth portion: $45,500 (grows tax-free forever)
\`\`\`

### Health Savings Account (HSA): The Ultimate Tax Vehicle

**Triple Tax Advantage:**
1. **Deductible contributions:** Reduce current income
2. **Tax-free growth:** No taxes on investment gains
3. **Tax-free withdrawals:** For qualified medical expenses

**2024 Contribution Limits:**
- Individual: $4,150
- Family: $8,300  
- Age 55+ catch-up: Additional $1,000

**Advanced HSA Strategy:**
1. **Max HSA contributions** annually
2. **Invest HSA funds** in stock market (don't keep as cash)
3. **Pay medical expenses out-of-pocket** when possible
4. **Keep receipts** for future reimbursement
5. **After age 65:** Withdraw for any purpose (like Traditional IRA)

**Long-term power:**
\`\`\`
$3,000 annual HSA contributions for 30 years
Assuming 7% return: $283,398 accumulated
All tax-free for medical expenses
Or penalty-free (but taxable) withdrawals after 65
\`\`\`

## Advanced Income Management Techniques

### Roth Conversion Strategies

**Optimal Conversion Years:**
- **Early retirement:** Gap between career end and Social Security
- **Low-income years:** Job loss, sabbatical, business startup
- **Market downturns:** Convert more shares when values are depressed
- **Before RMDs:** Age 59.5 - 73 sweet spot

**Conversion Amount Strategy:**
- **Fill up current tax bracket:** Convert up to next bracket threshold
- **Avoid NIIT:** Stay below $200k/$250k if possible
- **Spread over multiple years:** Smooth out tax impact

**Example:**
\`\`\`
Retiree with $2M Traditional IRA, living on $60k/year
Currently in 12% bracket, could convert $35k annually to stay in bracket
12% tax on conversions vs. 22%+ on future RMDs
Annual conversion tax: $35k × 12% = $4,200
Lifetime tax savings: Potentially $100k+ over retirement
\`\`\`

### Tax-Loss Harvesting Automation

**Systematic Approach:**
1. **Daily monitoring:** Check for loss harvesting opportunities
2. **Automatic selling:** Realize losses when thresholds are met
3. **Reinvestment:** Buy similar but not identical securities
4. **Loss carryforward:** Use losses in future years if not immediately needed

**Harvesting Rules:**
- **$3,000 annual limit:** Against ordinary income
- **Unlimited against gains:** Offset capital gains dollar-for-dollar
- **Carryforward indefinitely:** Unused losses carry to future years
- **Wash sale rule:** 30-day restriction on repurchasing

**Technology Solutions:**
- **Wealthfront:** Advanced direct indexing with tax-loss harvesting
- **Betterment:** Automated harvesting across account types
- **Schwab Intelligent:** No additional fees for harvesting

## Municipal Bond Strategy for High Earners

### Tax-Equivalent Yield Analysis

**Formula:** Tax-Equivalent Yield = Municipal Yield ÷ (1 - Tax Rate)

**State Tax Considerations:**
- **Triple tax-free:** Federal, state, local (for in-state bonds)
- **High-tax states:** CA, NY, NJ, CT see biggest benefit
- **No-tax states:** TX, FL, WA see less relative benefit

**Example Analysis:**
\`\`\`
California resident in 37% federal + 13.3% state = 50.3% combined bracket
3% California municipal bond tax-equivalent yield:
3% ÷ (1 - 0.503) = 6.04%

Would need 6%+ on taxable bond to beat the muni
\`\`\`

### Municipal Bond Risks

**Credit risk:** Some municipalities can default (Detroit 2013)
**Interest rate risk:** Bond prices fall when rates rise  
**Call risk:** Bonds may be redeemed early when rates fall
**AMT risk:** Some municipal bonds subject to alternative minimum tax

**Mitigation strategies:**
- **Diversified muni funds:** Spread credit risk across many issuers
- **Ladder strategy:** Bonds maturing in different years
- **High-grade focus:** Stick to AA or AAA rated bonds
- **Professional management:** Let experts handle selection and management

## Bracket Management Strategies

### Income Smoothing Techniques

**Multi-year tax planning:**
- **Project future income:** Salary, Social Security, RMDs, rental income
- **Identify low-income years:** Target for Roth conversions and income acceleration
- **Plan high-income years:** Maximize deductions, defer income when possible

**Retirement Withdrawal Strategy:**
1. **Taxable accounts first:** No tax benefits to keeping money there
2. **Traditional IRA/401(k) middle:** Control timing and amount
3. **Roth IRA last:** Maximum growth benefit from tax-free compounding

**Example 30-year retirement plan:**
\`\`\`
Age 62-70: Live on taxable accounts + Roth conversions
Age 70-85: Balanced approach with Social Security + some Traditional IRA
Age 85+: Primarily Roth accounts (tax-free) for legacy planning
\`\`\`

### Social Security Tax Planning

**Provisional Income Formula:**
Adjusted Gross Income + Non-taxable interest + 50% of Social Security

**Taxation Thresholds:**
- **Single:** $25k-$34k (50% taxable), >$34k (85% taxable)  
- **Married:** $32k-$44k (50% taxable), >$44k (85% taxable)

**Strategies to minimize Social Security taxation:**
- **Manage other income:** Keep provisional income below thresholds
- **Use Roth withdrawals:** Don't count toward provisional income
- **Municipal bonds:** Interest doesn't count (but does for provisional income calculation)
- **HSA withdrawals:** For medical expenses don't count

## Tax Law Changes and Planning

### Recent Major Changes

**Tax Cuts and Jobs Act (2017-2025):**
- **Lower individual rates:** Most brackets reduced
- **Higher standard deduction:** Doubled from previous levels
- **SALT deduction cap:** $10k limit on state and local tax deductions
- **Sunset provision:** Reverts to pre-2018 rules in 2026 unless extended

**SECURE Act 2.0 (2022):**
- **RMD age increase:** From 70.5 to 73 (75 in 2033)
- **Catch-up contribution changes:** Higher limits, Roth requirements for high earners
- **Emergency savings:** New options for accessing retirement funds

### Planning for Uncertainty

**Strategies that work regardless of future tax changes:**
- **Tax diversification:** Have money in traditional, Roth, and taxable accounts
- **Asset location:** Will always provide some benefit
- **Tax-loss harvesting:** Mathematical advantage in any tax system
- **HSA maximization:** Triple tax advantage likely to continue

**Hedging against higher future rates:**
- **Increase Roth contributions:** Lock in current low rates
- **Accelerate Roth conversions:** Before rates potentially increase
- **Consider municipal bonds:** Become more attractive if rates rise

## Implementation Action Plan

### Quarterly Tax Planning

**Q1 (January-March):**
- **Complete prior year IRA contributions:** Deadline = tax filing deadline
- **Estimate current year tax liability:** Plan estimated tax payments
- **Review Roth conversion opportunities:** Based on projected income
- **Set up automatic tax-loss harvesting:** If not already in place

**Q2 (April-June):**
- **File tax return and analyze:** What worked, what didn't
- **Adjust withholding/estimated payments:** Based on current year projections
- **Mid-year Roth conversion:** If beneficial based on income to date
- **Review asset location:** Rebalance if needed

**Q3 (July-September):**
- **Refine tax projections:** Update based on year-to-date results
- **Plan Q4 strategies:** Income acceleration/deferral, deduction timing
- **Review retirement contributions:** Make sure on track to maximize
- **Estate planning review:** Update if major life changes

**Q4 (October-December):**
- **Execute year-end strategies:** Tax-loss harvesting, Roth conversions
- **Maximize retirement contributions:** 401(k), IRA, HSA
- **Bunch deductions:** Charitable giving, medical expenses
- **Plan next year:** Based on expected income and tax changes

### Working with Tax Professionals

**When to get professional help:**
- **Complex situations:** Business ownership, real estate investments, trusts
- **High income:** Subject to AMT, NIIT, or other high-income tax rules
- **Major life changes:** Marriage, divorce, retirement, inheritance
- **Advanced strategies:** Estate planning, charitable giving, business succession

**Questions to ask your tax professional:**
1. **What's my effective tax rate** and how can we reduce it?
2. **Should I do Roth conversions** and if so, how much?
3. **Is my asset location optimal** across account types?
4. **What tax law changes** might affect my situation?
5. **How should we coordinate** tax planning with investment strategy?

## Key Takeaways

1. **Think marginal, not average:** Your last dollar of income determines tax planning strategy
2. **Tax timing is everything:** When you realize income/deductions can save thousands
3. **Roth conversions** can be incredibly powerful during low-income years
4. **HSAs are the best tax vehicle:** Triple tax advantage beats everything else
5. **Municipal bonds** make sense for high earners in high-tax states
6. **Automate tax-loss harvesting:** Technology makes this strategy more powerful
7. **Plan for tax law changes:** Diversify across account types for flexibility
8. **Coordinate with overall financial plan:** Tax strategy should support your goals

**Remember:** Tax planning is not about avoiding taxes entirely—it's about paying the least amount legally required while achieving your financial objectives. The goal is to maximize your after-tax wealth over your lifetime.

**Next up:** We'll explore estate planning strategies that can help you transfer wealth efficiently to the next generation while minimizing taxes and protecting your legacy.
            `
          },
          {
            type: "video",
            depth: ["comprehensive", "expert"],
            title: "Advanced Tax Planning: Roth Conversions and Bracket Management",
            url: "https://www.youtube.com/embed/8fveP5uY_gk",
            description: "Master the timing strategies that can save tens of thousands in taxes over your lifetime"
          },
          {
            type: "roth_conversion_calculator",
            depth: ["comprehensive", "expert"],
            title: "Interactive Roth Conversion Analyzer",
            description: "Optimize your Roth conversion strategy with personalized tax bracket analysis"
          }
        ]
      },
      {
        id: 3,
        title: "Estate Planning, Gifting & Wealth Transfer",
        type: "estate_planning",
        contentBlocks: [
          {
            type: "markdown_text",
            depth: ["overview", "comprehensive", "expert"],
            title: "Building and Protecting Your Financial Legacy",
            value: `
# Estate Planning, Gifting & Wealth Transfer

Estate planning isn't just for the ultra-wealthy—it's for anyone who wants to protect their family and transfer wealth efficiently. Whether you have $100,000 or $10 million, the right estate planning strategies can save your family tens of thousands in taxes, avoid probate complications, and ensure your wishes are carried out. Let's explore the tools and techniques that preserve and transfer wealth effectively.

## Estate Planning Fundamentals

### Why Estate Planning Matters

**Without proper planning:**
- **Probate court** controls asset distribution (public, slow, expensive)
- **State law** determines who inherits (may not match your wishes)
- **Higher taxes** reduce what your family receives
- **Family conflicts** can arise over unclear intentions
- **Business disruption** if you own a company

**With proper planning:**
- **You control** exactly how assets are distributed
- **Minimize taxes** at federal and state levels
- **Avoid probate** or streamline the process
- **Protect beneficiaries** from creditors and poor decisions
- **Business continuity** ensured through succession planning

### Key Estate Planning Documents

#### **Will (Last Will and Testament)**
**Purpose:** Directs asset distribution after death
**What it covers:**
- **Asset distribution:** Who gets what property
- **Guardian nominations:** Who cares for minor children
- **Executor appointment:** Who manages estate settlement
- **Specific bequests:** Jewelry, family heirlooms, charitable gifts

**Limitations:**
- **Must go through probate:** Public process, court supervision
- **Only covers probate assets:** Not jointly owned or beneficiary-designated assets
- **Can be contested:** Family members can challenge in court

#### **Revocable Living Trust**
**Purpose:** Manages assets during life and after death while avoiding probate

**Key benefits:**
- **Avoids probate:** Assets transfer immediately to beneficiaries
- **Privacy protection:** Trust terms remain confidential
- **Incapacity planning:** Successor trustee manages assets if you become disabled
- **Professional management:** Can provide ongoing management for beneficiaries

**How it works:**
1. **Create trust:** You are initial trustee and beneficiary
2. **Fund trust:** Transfer assets from your name to trust name
3. **Manage normally:** Continue controlling assets during your lifetime
4. **Succession:** Successor trustee takes over at death or incapacity
5. **Distribution:** Assets distributed per trust terms without probate

**Example:**
\`\`\`
John creates "John Smith Revocable Trust"
Transfers house, investment accounts, business interests to trust
Names wife Mary as successor trustee, children as beneficiaries
At John's death: Mary immediately controls assets, no probate needed
Assets distributed to children per trust terms when Mary dies
\`\`\`

#### **Power of Attorney Documents**

**Financial Power of Attorney:**
- **Grants authority** to manage financial affairs if incapacitated
- **Can be immediate** or "springing" (activated by incapacity)
- **Broad or limited** powers depending on your preferences

**Healthcare Power of Attorney:**
- **Medical decision authority** when you cannot make decisions
- **HIPAA authorization** to access medical records
- **End-of-life decisions** including life support preferences

#### **Healthcare Directives (Living Will)**
**Purpose:** Express wishes for medical treatment in terminal situations
**Key decisions:** Life support, feeding tubes, pain management, organ donation

### Beneficiary Designations: The Overlooked Estate Plan

**Assets that pass by beneficiary designation:**
- **Retirement accounts:** 401(k), IRA, pension plans
- **Life insurance:** Death benefit recipients
- **Bank accounts:** Payable-on-death (POD) accounts
- **Investment accounts:** Transfer-on-death (TOD) designations
- **Some real estate:** Transfer-on-death deeds (available in many states)

**Critical importance:**
- **Overrides your will:** Beneficiary designations take precedence
- **Avoids probate:** Direct transfer to named beneficiaries
- **Faster distribution:** No court involvement required

**Common mistakes:**
- **Never updating beneficiaries** after marriage, divorce, births, deaths
- **Naming minor children** directly (should use trust for minors)
- **No contingent beneficiaries** if primary dies first
- **Forgetting about accounts** when changing jobs or moving assets

## Federal Estate and Gift Tax System

### Current Tax Environment (2024)

**Federal Estate Tax Exemption:** $13.61 million per person
**Federal Gift Tax Annual Exclusion:** $18,000 per recipient
**Generation-Skipping Transfer (GST) Tax Exemption:** $13.61 million per person

**Key insight:** Only about 0.2% of estates pay federal estate tax under current law

### The "Sunset" Problem

**Current high exemptions expire December 31, 2025**
**Scheduled reversion:** Back to ~$6 million per person (inflation-adjusted)

**Planning implications:**
- **Use-it-or-lose-it opportunity:** Current high exemptions
- **Acceleration strategies:** Make large gifts while exemptions are high
- **Grantor trust strategies:** Lock in current exemption amounts

### Gift Tax Strategy

#### **Annual Exclusion Gifting**
**2024 limit:** $18,000 per recipient per year
**Married couples:** Can combine for $36,000 per recipient
**No limit on recipients:** Can gift to children, grandchildren, friends, etc.

**Example:**
\`\`\`
Married couple with 3 married children (6 recipients total):
Annual gifting capacity: 6 × $36,000 = $216,000
10-year gifting: $2.16 million transferred tax-free
Plus growth on gifted assets occurs outside estate
\`\`\`

#### **Lifetime Exemption Strategy**
**Current opportunity:** Use high exemptions before they sunset
**Strategies:**
- **Outright gifts:** Direct transfers up to exemption amount
- **Sales to grantor trusts:** Leverage exemption with financing
- **Grantor retained annuity trusts (GRATs):** Transfer growth at minimal gift tax cost

### State Estate Taxes

**States with estate taxes (2024):**
Connecticut, Hawaii, Illinois, Maine, Massachusetts, Minnesota, New York, Oregon, Rhode Island, Vermont, Washington, District of Columbia

**State exemptions range from $1 million to $13.61 million**
**Top rates range from 12% to 20%**

**Planning considerations:**
- **Domicile planning:** Consider relocating to no-tax states
- **Trust situs planning:** Locate trusts in favorable tax jurisdictions
- **Asset location:** Keep high-value assets in no-tax states when possible

## Advanced Estate Planning Strategies

### Grantor Trusts: Supercharged Gifting

**Concept:** You pay income taxes on trust earnings, allowing more wealth to transfer to beneficiaries

**Types of grantor trusts:**
- **Intentionally Defective Grantor Trust (IDGT)**
- **Grantor Retained Annuity Trust (GRAT)**  
- **Charitable Lead Annuity Trust (CLAT)**

**Power of grantor trust status:**
\`\`\`
$1 million trust earning 7% = $70,000 annual income
Without grantor trust: Trust pays ~$25,000 in taxes, keeps $45,000
With grantor trust: You pay $25,000 tax, trust keeps full $70,000
Additional wealth transfer: $25,000 annually at no gift tax cost
\`\`\`

### Sales to Grantor Trusts

**Structure:**
1. **Create grantor trust** with small gift (10% of sale price)
2. **Sell assets to trust** in exchange for promissory note
3. **Trust pays interest** at AFR (Applicable Federal Rate)
4. **Asset growth above AFR** passes to beneficiaries gift-tax-free

**Example:**
\`\`\`
$10 million business sale to grantor trust:
Gift $1 million to trust (uses exemption)
Trust borrows $9 million at 4.5% AFR
Business grows 12% annually
Excess growth (7.5% annually) passes gift-tax-free to beneficiaries
Over 10 years: ~$8 million additional transfer at no gift tax cost
\`\`\`

### Grantor Retained Annuity Trusts (GRATs)

**Structure:** Transfer appreciating assets, retain annuity payments, pass growth to beneficiaries

**Ideal for:**
- **Volatile assets:** Stocks, business interests with growth potential
- **Income-producing assets:** Rental property, business with cash flow
- **Short-term appreciation:** Assets expected to appreciate quickly

**"Rolling GRAT" strategy:**
\`\`\`
Create series of 2-year GRATs with appreciating stock
If stock appreciates: Excess growth passes to beneficiaries
If stock depreciates: Assets return to you, restart with new GRAT
Result: "Heads I win, tails we tie" outcome
\`\`\`

### Charitable Planning Strategies

#### **Charitable Remainder Trust (CRT)**
**Benefits:**
- **Income tax deduction:** Based on remainder value to charity
- **No capital gains tax:** On appreciated assets donated to trust
- **Lifetime income:** Payments to you for life or term of years
- **Charitable impact:** Remainder goes to chosen charity

**Example:**
\`\`\`
$1 million appreciated stock (basis $200,000) donated to CRT:
Immediate tax deduction: ~$400,000 (40% remainder value)
Tax savings: $400,000 × 37% = $148,000
No capital gains tax on $800,000 gain
5% annual payout: $50,000 income for life
Total benefits: Tax savings + increased income + charitable impact
\`\`\`

#### **Charitable Lead Trust (CLT)**
**Structure:** Charity receives income payments, remainder to family
**Benefits:**
- **Reduced gift/estate tax:** On remainder to beneficiaries
- **Grantor CLT:** You get income tax deductions for charitable payments
- **Leverage transfer tax exemptions:** Especially effective with high exemptions

### Dynasty Trust Planning

**Concept:** Trusts that continue for multiple generations, avoiding transfer taxes at each level

**Benefits:**
- **Perpetual tax shelter:** Assets grow outside transfer tax system
- **GST tax planning:** Use exemption to shield multiple generations
- **Asset protection:** Creditor protection for beneficiaries
- **Professional management:** Ongoing institutional management

**State law variations:**
- **Perpetual trusts:** Alaska, Delaware, Nevada, South Dakota allow indefinite duration
- **Tax advantages:** No state income tax on trust income in some jurisdictions
- **Asset protection:** Stronger creditor protection laws in trust-friendly states

## Business Succession Planning

### Family Business Challenges

**Statistics:**
- **30% of family businesses** survive to second generation
- **12% survive** to third generation
- **3% survive** to fourth generation and beyond

**Common problems:**
- **No succession plan:** Next generation unprepared or uninterested
- **Estate tax liquidity:** Illiquid business interests create tax payment problems
- **Family conflicts:** Multiple heirs with different interests
- **Key person dependency:** Business depends too heavily on founder

### Succession Planning Strategies

#### **Grantor Retained Annuity Trust (GRAT) for Business**
**Benefit:** Transfer business growth at minimal gift tax cost
**Structure:** Gift business interests to GRAT, retain annuity payments

#### **Sales to Intentionally Defective Grantor Trust (IDGT)**
**Benefit:** Leverage growth and freeze estate value
**Structure:** Sell business to trust, receive promissory note

#### **Employee Stock Ownership Plan (ESOP)**
**Benefits:**
- **Tax deferral:** Reinvest sale proceeds in qualified securities
- **Employee ownership:** Motivates workforce through ownership
- **Liquidity:** Provides market for business interests

#### **Management Buyout (MBO)**
**Benefits:**
- **Immediate liquidity:** Cash for business interests
- **Motivated management:** New owners invested in success
- **Tax planning:** Structure sale for optimal tax treatment

## Special Situations and Considerations

### Blended Families

**Challenges:**
- **Competing interests:** Current spouse vs. children from prior marriage
- **Asset division:** How to provide for both groups
- **Trust planning:** Complex beneficiary structures

**Solutions:**
- **Qualified Terminable Interest Property (QTIP) trust:** Provides for spouse, remainder to children
- **Life insurance:** Additional resources to equalize inheritances
- **Clear communication:** Family meetings to discuss plans and expectations

### Clients with Special Needs Beneficiaries

**Special needs trust benefits:**
- **Government benefits protection:** Doesn't disqualify from SSI, Medicaid
- **Supplemental support:** Pays for extras not covered by government programs
- **Professional management:** Trustee handles complex rules

**ABLE accounts:** Allow disabled individuals to save without jeopardizing benefits

### Digital Asset Planning

**Modern estate planning must address:**
- **Social media accounts:** Facebook, Instagram, Twitter legacy settings
- **Digital photos and videos:** Cloud storage, photo sharing services
- **Cryptocurrency:** Private keys, exchange accounts
- **Online accounts:** Email, banking, investment accounts
- **Digital businesses:** Online stores, domains, intellectual property

**Planning strategies:**
- **Digital asset inventory:** List all accounts and access information
- **Password management:** Secure system for sharing credentials
- **Legal authorization:** Include digital assets in estate planning documents

## Implementing Your Estate Plan

### Working with Professionals

**Estate planning attorney:**
- **Document drafting:** Wills, trusts, powers of attorney
- **Tax planning:** Minimize estate and gift taxes
- **Business planning:** Succession and continuity strategies

**Financial advisor:**
- **Wealth transfer modeling:** Project outcomes of different strategies
- **Investment management:** Optimize portfolio for estate planning goals
- **Insurance analysis:** Determine life insurance needs

**CPA/tax advisor:**
- **Income tax planning:** Coordinate with estate planning strategies
- **Gift and estate tax returns:** File required tax documents
- **Trust tax planning:** Optimize trust income tax strategies

**Trust company/bank:**
- **Trustee services:** Professional trust administration
- **Investment management:** Ongoing portfolio management
- **Family office services:** Comprehensive wealth management

### Regular Review and Updates

**Life events requiring plan updates:**
- **Marriage or divorce**
- **Birth or adoption of children**
- **Death of beneficiary or trustee**
- **Significant change in wealth**
- **Business sale or acquisition**
- **Move to different state**

**Regular review schedule:**
- **Annual review:** Basic plan checkup with advisor
- **Every 3-5 years:** Comprehensive plan review with attorney
- **After major life events:** Immediate plan updates as needed

### Estate Plan Funding

**Trust funding checklist:**
- **Real estate:** Deed property to trust name
- **Investment accounts:** Re-title to trust ownership
- **Bank accounts:** Change ownership to trust
- **Business interests:** Transfer ownership to trust
- **Personal property:** Assign valuable items to trust

**Common funding mistakes:**
- **Creating trust but not funding it:** "Empty trust" provides no benefits
- **Partial funding:** Some assets titled to trust, others remain individual
- **Forgetting new acquisitions:** Not updating trust ownership for new assets

## Key Takeaways

1. **Estate planning is for everyone** - not just the ultra-wealthy
2. **Start early** - compound benefits of early planning are enormous
3. **Use current high exemptions** - they expire December 31, 2025
4. **Coordinate with overall financial plan** - estate planning should support your goals
5. **Update regularly** - plans must evolve with life changes and law changes
6. **Work with qualified professionals** - DIY estate planning often creates problems
7. **Communicate with family** - Surprises after death create conflicts
8. **Fund your plan** - Unfunded trusts and outdated beneficiaries defeat planning

**Remember:** Estate planning is not just about taxes - it's about protecting your family, preserving your values, and ensuring your wishes are carried out. The best estate plan is one that reflects your unique family situation and goals while minimizing taxes and complications.

The strategies in this lesson can save your family hundreds of thousands or even millions in taxes while providing better protection and control over your wealth transfer. Start planning now while you have maximum flexibility and the current favorable tax environment.
            `
          },
          {
            type: "video",
            depth: ["comprehensive", "expert"],
            title: "Estate Planning Strategies: Trusts, Gifting, and Wealth Transfer",
            url: "https://www.youtube.com/embed/MF_yKnyXL1g",
            description: "Learn advanced strategies to transfer wealth efficiently and protect your family's financial future"
          },
          {
            type: "estate_tax_calculator",
            depth: ["comprehensive", "expert"],
            title: "Interactive Estate Tax and Gifting Calculator",
            description: "Estimate estate tax liability and optimize gifting strategies with current exemptions"
          }
        ]
      }
    ]
  }
];

export default function Learn() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [view, setView] = useState('list'); // 'list', 'overview', 'assessment', 'module', 'completion'
  const [selectedModule, setSelectedModule] = useState(null);
  const [modulePreferences, setModulePreferences] = useState({});
  const [completedModules, setCompletedModules] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const userData = await User.me();
      setUser(userData);
      setCompletedModules(userData.completed_modules || []);
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setIsLoading(false);
  };

  const handleModuleSelect = (module) => {
    setSelectedModule(module);
    setView('overview');
  };

  const handleStartAssessment = () => {
    setView('assessment');
  };

  const handleAssessmentComplete = (preferences) => {
    setModulePreferences(preferences);
    setView('module');
  };

  const handleModuleComplete = async (moduleId) => {
    const newCompleted = [...new Set([...completedModules, moduleId])];
    setCompletedModules(newCompleted);

    await User.updateMyUserData({
      completed_modules: newCompleted
    });

    setView('completion');
  };

  const handleRestartModule = () => {
    setView('module');
  };

  const handleBackToModules = () => {
    setSelectedModule(null);
    setModulePreferences({});
    setView('list');
  };

  const getDifficultyColor = (difficulty) => {
    if (difficulty.includes('Expert')) return 'bg-purple-50 text-purple-700 border-purple-200';
    if (difficulty.includes('Advanced')) return 'bg-red-50 text-red-700 border-red-200';
    if (difficulty.includes('Intermediate')) return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    return 'bg-green-50 text-green-700 border-green-200';
  };

  const getCategoryColor = (category) => {
    const colors = {
      'Personal Finance': 'bg-blue-50 text-blue-700 border-blue-200',
      'Investing': 'bg-purple-50 text-purple-700 border-purple-200',
      'Psychology': 'bg-pink-50 text-pink-700 border-pink-200',
      'Analytics': 'bg-emerald-50 text-emerald-700 border-emerald-200',
      'Economic Insight': 'bg-orange-50 text-orange-700 border-orange-200',
      'Wealth Optimization': 'bg-indigo-50 text-indigo-700 border-indigo-200'
    };
    return colors[category] || 'bg-gray-50 text-gray-700 border-gray-200';
  };

  const completionPercentage = (completedModules.length / learningModules.length) * 100;

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array(6).fill(0).map((_, i) => (
              <div key={i} className="h-80 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (view) {
      case 'overview':
        return selectedModule ? <ModuleOverview module={selectedModule} onStart={handleStartAssessment} /> : null;
      case 'assessment':
        return selectedModule ? (
          <CoursePreAssessment
            module={selectedModule}
            onComplete={handleAssessmentComplete}
            onBack={() => setView('overview')}
          />
        ) : null;
      case 'module':
        return selectedModule ? (
          <LearningModule
            module={selectedModule}
            onComplete={() => handleModuleComplete(selectedModule.id)}
            onBack={handleBackToModules}
            preferences={modulePreferences}
            user={user}
          />
        ) : null;
      case 'completion':
        return selectedModule ? (
          <ModuleCompletionPage
            module={selectedModule}
            onRestart={handleRestartModule}
            onBackToModules={handleBackToModules}
          />
        ) : null;
      case 'list':
      default:
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
                  <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-3">
                    <Brain className="w-8 h-8 text-purple-600" />
                    Advanced Learning Center
                  </h1>
                  <p className="text-gray-600 mt-1">Deep dive into sophisticated financial concepts and strategies</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <Card className="glassmorphism border-0 shadow-lg bg-gradient-to-r from-purple-50 to-indigo-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-600" />
                    Your Learning Journey
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{completedModules.length} / {learningModules.length}</p>
                      <p className="text-gray-600">Advanced Modules Completed</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-purple-600">{Math.round(completionPercentage)}%</p>
                      <p className="text-gray-600">Mastery Progress</p>
                    </div>
                  </div>
                  <Progress value={completionPercentage} className="h-3" />
                  <div className="flex items-center gap-2 mt-4">
                    <Target className="w-4 h-4 text-emerald-600" />
                    <p className="text-sm text-gray-600">
                      Complete all modules to unlock the "Financial Expert" certification!
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {learningModules.map((module, index) => {
                const isCompleted = completedModules.includes(module.id);
                return (
                  <motion.div
                    key={module.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.1 }}
                  >
                    <Card className="glassmorphism border-0 shadow-lg hover:shadow-xl transition-all duration-300 h-full hover:-translate-y-1">
                      <CardHeader className="pb-4">
                        <div className="flex items-start justify-between mb-4">
                          <div className="text-4xl">{module.icon}</div>
                          {isCompleted && <CheckCircle className="w-6 h-6 text-green-600" />}
                        </div>
                        <CardTitle className="text-lg leading-tight">
                          {module.title}
                        </CardTitle>
                        <p className="text-sm text-gray-600">
                          {module.description}
                        </p>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="flex flex-wrap gap-2 mb-4">
                          <Badge className={`${getDifficultyColor(module.difficulty)} border text-xs`} variant="outline">
                            {module.difficulty}
                          </Badge>
                          <Badge className={`${getCategoryColor(module.category)} border text-xs`} variant="outline">
                            {module.category}
                          </Badge>
                          <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200 text-xs">
                            {module.duration}
                          </Badge>
                        </div>
                        <div className="mb-4 p-3 bg-gradient-to-r from-gray-50 to-blue-50 border border-gray-200 rounded-xl">
                          <div className="flex items-center gap-2 mb-2">
                            <Brain className="w-4 h-4 text-purple-600" />
                            <p className="text-xs font-semibold text-gray-700">Advanced Topics Covered</p>
                          </div>
                          <div className="grid grid-cols-2 gap-1">
                            {module.expertTopics.slice(0, 4).map((topic, i) => (
                              <p key={i} className="text-xs text-gray-600">• {topic}</p>
                            ))}
                          </div>
                        </div>
                        <Button
                          onClick={() => handleModuleSelect(module)}
                          className={`w-full gap-2 ${
                            isCompleted
                              ? 'bg-green-600 hover:bg-green-700 text-white'
                              : 'bg-gradient-to-r from-purple-600 to-indigo-500 hover:from-purple-700 hover:to-indigo-600'
                          }`}
                        >
                          {isCompleted ? (
                            <>
                              <CheckCircle className="w-4 h-4" />
                              Review Module
                            </>
                          ) : (
                            <>
                              <Play className="w-4 h-4" />
                              Start Learning
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        );
    }
  };

  return <div className="w-full">{renderContent()}</div>;
}
