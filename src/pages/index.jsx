import Layout from "./Layout.jsx";

import Dashboard from "./Dashboard";

import Onboarding from "./Onboarding";

import BudgetBuilder from "./BudgetBuilder";

import Goals from "./Goals";

import Portfolio from "./Portfolio";

import Referrals from "./Referrals";

import AIAdvisor from "./AIAdvisor";

import DebtManager from "./DebtManager";

import Learn from "./Learn";

import Community from "./Community";

import GrowYourGarden from "./GrowYourGarden";

import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';

const PAGES = {
    
    Dashboard: Dashboard,
    
    Onboarding: Onboarding,
    
    BudgetBuilder: BudgetBuilder,
    
    Goals: Goals,
    
    Portfolio: Portfolio,
    
    Referrals: Referrals,
    
    AIAdvisor: AIAdvisor,
    
    DebtManager: DebtManager,
    
    Learn: Learn,
    
    Community: Community,
    
    GrowYourGarden: GrowYourGarden,
    
}

function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }

    const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === urlLastPart.toLowerCase());
    return pageName || Object.keys(PAGES)[0];
}

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);
    
    return (
        <Layout currentPageName={currentPage}>
            <Routes>            
                
                    <Route path="/" element={<Dashboard />} />
                
                
                <Route path="/Dashboard" element={<Dashboard />} />
                
                <Route path="/Onboarding" element={<Onboarding />} />
                
                <Route path="/BudgetBuilder" element={<BudgetBuilder />} />
                
                <Route path="/Goals" element={<Goals />} />
                
                <Route path="/Portfolio" element={<Portfolio />} />
                
                <Route path="/Referrals" element={<Referrals />} />
                
                <Route path="/AIAdvisor" element={<AIAdvisor />} />
                
                <Route path="/DebtManager" element={<DebtManager />} />
                
                <Route path="/Learn" element={<Learn />} />
                
                <Route path="/Community" element={<Community />} />
                
                <Route path="/GrowYourGarden" element={<GrowYourGarden />} />
                
            </Routes>
        </Layout>
    );
}

export default function Pages() {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}