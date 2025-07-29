import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowUp, ArrowDown, TrendingUp, ExternalLink, Loader2, AlertTriangle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';
import { InvokeLLM } from '@/api/integrations';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const price = payload[0].value;
    if (typeof price !== 'number') {
        return null;
    }
    return (
      <div className="p-3 bg-white/80 backdrop-blur-sm rounded-lg shadow-lg border border-slate-200">
        <p className="font-bold text-slate-800">{`${label}`}</p>
        <p className="text-emerald-600">{`Price: $${price.toFixed(2)}`}</p>
      </div>
    );
  }
  return null;
};

export default function StockAnalyzerDetail({ symbol }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!symbol) {
      setLoading(false);
      setError(null);
      setData(null);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setError(null);
      setData(null);
      
      try {
        // Use the platform's InvokeLLM with internet context to get stock data
        // This bypasses the need for a separate API key or backend function
        const prompt = `
          Get comprehensive stock market data for ${symbol} including:
          1. Current stock price, change, and percentage change
          2. Day's high, low, and opening price
          3. Company information (name, exchange, industry, market cap)
          4. Historical price data for the past 3 months (at least 20 data points)
          
          Format the response as structured data suitable for financial analysis and charting.
        `;

        const result = await InvokeLLM({
          prompt,
          add_context_from_internet: true,
          response_json_schema: {
            type: "object",
            properties: {
              profile: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  ticker: { type: "string" },
                  exchange: { type: "string" },
                  industry: { type: "string" },
                  marketCap: { type: "number" },
                  weburl: { type: "string" }
                }
              },
              quote: {
                type: "object",
                properties: {
                  current: { type: "number" },
                  change: { type: "number" },
                  percentChange: { type: "number" },
                  high: { type: "number" },
                  low: { type: "number" },
                  open: { type: "number" },
                  previousClose: { type: "number" }
                }
              },
              history: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    date: { type: "string" },
                    price: { type: "number" }
                  }
                }
              }
            }
          }
        });

        // Validate the data structure
        if (!result || !result.quote || typeof result.quote.current !== 'number') {
          throw new Error(`Invalid or missing stock data for ${symbol}`);
        }

        setData(result);
      } catch (err) {
        console.error('Error loading stock data:', err);
        setError(err.message || 'Failed to load stock data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [symbol]);

  if (loading) {
    return (
      <Card className="glassmorphism border-0 shadow-lg min-h-[500px] flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 mx-auto animate-spin text-emerald-600" />
          <p className="font-semibold text-slate-600">Fetching live data for {symbol}...</p>
          <p className="text-sm text-slate-500">Getting real-time market information</p>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="glassmorphism border-0 shadow-lg min-h-[500px] flex items-center justify-center">
        <div className="text-center space-y-4">
          <AlertTriangle className="w-12 h-12 mx-auto text-red-500" />
          <p className="font-semibold text-red-600">Could not load stock data</p>
          <p className="text-sm text-slate-600 max-w-md">{error}</p>
        </div>
      </Card>
    );
  }

  if (!data && !symbol) {
    return (
      <Card className="glassmorphism border-0 shadow-lg min-h-[500px] flex items-center justify-center">
        <div className="text-center space-y-3">
          <TrendingUp className="w-12 h-12 mx-auto text-slate-400" />
          <p className="font-semibold text-slate-600">Click on a holding to see its detailed analysis.</p>
          <p className="text-sm text-slate-500">Live market data and performance charts will appear here.</p>
        </div>
      </Card>
    );
  }
  
  if (!data) return null;

  const { profile, quote, history } = data;
  const isPositiveChange = quote && quote.change > 0;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
      <Card className="glassmorphism border-0 shadow-lg">
        <CardHeader className="border-b border-slate-200/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <CardTitle className="text-2xl font-bold text-slate-900">
                  {profile?.name || symbol}
                </CardTitle>
                <div className="flex items-center gap-3">
                  <p className="text-slate-500 font-medium">{profile?.ticker || symbol}</p>
                  {profile?.exchange && (
                    <Badge variant="outline" className="bg-slate-100">
                      {profile.exchange}
                    </Badge>
                  )}
                  {profile?.industry && (
                    <Badge variant="outline" className="bg-blue-50 text-blue-700">
                      {profile.industry}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            {profile?.weburl && (
              <a href={profile.weburl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="gap-2">
                  Website <ExternalLink className="w-4 h-4" />
                </Button>
              </a>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left Side: Chart */}
            <div className="space-y-4">
              <div className="flex items-baseline gap-3">
                <h3 className="text-lg font-semibold text-slate-900">Price Chart</h3>
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700">
                  Recent Performance
                </Badge>
              </div>
              
              {history && history.length > 0 ? (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={history}>
                      <defs>
                        <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.05}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis 
                        dataKey="date" 
                        stroke="#64748b"
                        fontSize={12}
                        tick={{ fill: '#64748b' }}
                      />
                      <YAxis 
                        stroke="#64748b"
                        fontSize={12}
                        tick={{ fill: '#64748b' }}
                        domain={['dataMin - 5', 'dataMax + 5']}
                        tickFormatter={(value) => `$${value.toFixed(0)}`}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="price"
                        stroke="#10b981"
                        strokeWidth={2}
                        fill="url(#colorPrice)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center bg-slate-50 rounded-lg">
                  <p className="text-slate-500">Chart data will appear here</p>
                </div>
              )}
            </div>

            {/* Right Side: Current Price & Stats */}
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-900">Current Price</h3>
                <div className="space-y-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-slate-900">
                      ${quote?.current?.toFixed(2) || 'N/A'}
                    </span>
                    {quote && quote.change !== undefined && (
                      <div className={`flex items-center gap-1 ${
                        isPositiveChange ? 'text-emerald-600' : 'text-red-600'
                      }`}>
                        {isPositiveChange ? 
                          <ArrowUp className="w-4 h-4" /> : 
                          <ArrowDown className="w-4 h-4" />
                        }
                        <span className="font-medium">
                          ${Math.abs(quote.change).toFixed(2)} ({Math.abs(quote.percentChange || 0).toFixed(2)}%)
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-500 font-medium">Open</p>
                  <p className="text-lg font-bold text-slate-900">
                    ${quote?.open?.toFixed(2) || 'N/A'}
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-500 font-medium">Previous Close</p>
                  <p className="text-lg font-bold text-slate-900">
                    ${quote?.previousClose?.toFixed(2) || 'N/A'}
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-500 font-medium">Day High</p>
                  <p className="text-lg font-bold text-slate-900">
                    ${quote?.high?.toFixed(2) || 'N/A'}
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-500 font-medium">Day Low</p>
                  <p className="text-lg font-bold text-slate-900">
                    ${quote?.low?.toFixed(2) || 'N/A'}
                  </p>
                </div>
              </div>

              {profile?.marketCap && (
                <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                  <p className="text-sm text-emerald-700 font-medium">Market Cap</p>
                  <p className="text-lg font-bold text-emerald-900">
                    ${profile.marketCap > 1000000000 
                      ? `${(profile.marketCap / 1000000000).toFixed(1)}B` 
                      : `${(profile.marketCap / 1000000).toFixed(0)}M`
                    }
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}