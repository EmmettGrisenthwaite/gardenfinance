
import React, { useState, useEffect } from "react";
import { Portfolio as PortfolioEntity } from "@/api/entities";
import { InvokeLLM } from "@/api/integrations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Save, Loader2, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function PortfolioBuilder({ user, portfolios, onRefresh }) {
  const [selectedPortfolioId, setSelectedPortfolioId] = useState("");
  const [portfolioName, setPortfolioName] = useState("");
  const [holdings, setHoldings] = useState([
    { symbol: "", name: "", shares: 0, price: 0, category: "stocks" }
  ]);
  const [totalValue, setTotalValue] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [fetchingIndex, setFetchingIndex] = useState(null);

  // Effect to load selected portfolio details when selectedPortfolioId changes
  useEffect(() => {
    const loadPortfolio = async () => {
      if (selectedPortfolioId) {
        try {
          const portfolio = await PortfolioEntity.get(selectedPortfolioId);
          if (portfolio) {
            setPortfolioName(portfolio.name || "");
            setHoldings(portfolio.holdings?.map(h => ({
              symbol: h.symbol || '',
              name: h.name || '',
              shares: h.shares || 0,
              price: h.price || 0,
              category: h.category || 'stocks'
            })) || []);
          }
        } catch (error) {
          console.error("Error loading portfolio:", error);
          // Optionally, handle error by clearing selection or showing a message
          setSelectedPortfolioId("");
          setPortfolioName("");
          setHoldings([{ symbol: "", name: "", shares: 0, price: 0, category: "stocks" }]);
        }
      } else {
        // Reset form if no portfolio is selected (e.g., "Create new" option)
        setPortfolioName("");
        setHoldings([{ symbol: "", name: "", shares: 0, price: 0, category: "stocks" }]);
      }
    };

    loadPortfolio();
  }, [selectedPortfolioId]);

  // Effect to calculate total value whenever holdings change
  useEffect(() => {
    const calculatedTotal = holdings.reduce((sum, holding) => {
      return sum + (parseFloat(holding.shares) * parseFloat(holding.price));
    }, 0);
    setTotalValue(calculatedTotal);
  }, [holdings]);

  const handleHoldingChange = (index, field, value) => {
    const newHoldings = [...holdings];
    if (field === 'shares' || field === 'price') {
      newHoldings[index][field] = parseFloat(value) || 0;
    } else {
      newHoldings[index][field] = value;
    }
    setHoldings(newHoldings);
  };

  const addHolding = () => {
    setHoldings([...holdings, { symbol: "", name: "", shares: 0, price: 0, category: "stocks" }]);
  };

  const removeHolding = (index) => {
    const newHoldings = holdings.filter((_, i) => i !== index);
    setHoldings(newHoldings);
  };

  const handleFetchStockData = async (index) => {
    const symbol = holdings[index].symbol;
    if (!symbol) return;

    setFetchingIndex(index);
    try {
      const response = await InvokeLLM({
        prompt: `Get the latest stock market data for the ticker symbol: ${symbol}. Provide the full company name and the current price.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            name: { type: "string" },
            price: { type: "number" }
          },
          required: ["name", "price"]
        }
      });

      if (response && response.price) {
        const newHoldings = [...holdings];
        newHoldings[index].name = response.name;
        newHoldings[index].price = response.price;
        setHoldings(newHoldings);
      } else {
        console.warn(`No price or name found for symbol: ${symbol}`);
      }
    } catch (error) {
      console.error("Error fetching stock data:", error);
      // You could add a user-facing error message here
    }
    setFetchingIndex(null);
  };

  const savePortfolio = async () => {
    setIsSaving(true);
    try {
      const portfolioData = {
        name: selectedPortfolioId ? portfolios.find(p => p.id === selectedPortfolioId)?.name : portfolioName,
        holdings: holdings.map(h => ({
          symbol: h.symbol,
          name: h.name,
          shares: parseFloat(h.shares),
          price: parseFloat(h.price),
          category: h.category,
          value: parseFloat(h.shares) * parseFloat(h.price) // Calculate value for saving
        })),
        total_value: totalValue,
        type: "manual", // Assuming manual type for these portfolios
      };

      if (selectedPortfolioId) {
        await PortfolioEntity.update(selectedPortfolioId, portfolioData);
      } else {
        if (!portfolioName) {
          alert("Please provide a name for the new portfolio.");
          return;
        }
        await PortfolioEntity.create(portfolioData);
      }
      onRefresh(); // Refresh the list of portfolios in the parent component
      setSelectedPortfolioId(""); // Clear selection after saving a new one
      setPortfolioName(""); // Clear new portfolio name
      setHoldings([{ symbol: "", name: "", shares: 0, price: 0, category: "stocks" }]); // Reset holdings
    } catch (error) {
      console.error("Error saving portfolio:", error);
      // Display error to user
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="glassmorphism border-0 shadow-lg">
      <CardHeader>
        <CardTitle>Portfolio Builder</CardTitle>
        <p className="text-gray-600 text-sm">Create a new portfolio or add holdings to an existing one.</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="select-portfolio">Select Existing Portfolio</Label>
            <Select
              value={selectedPortfolioId}
              onValueChange={(value) => setSelectedPortfolioId(value)}
            >
              <SelectTrigger id="select-portfolio" className="h-11">
                <SelectValue placeholder="Select a portfolio or create new" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>Create New Portfolio</SelectItem>
                {portfolios.map((portfolio) => (
                  <SelectItem key={portfolio.id} value={portfolio.id}>
                    {portfolio.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="portfolio-name">Or Create New Portfolio Name</Label>
            <Input
              id="portfolio-name"
              placeholder="e.g., My Growth Stocks"
              value={portfolioName}
              onChange={(e) => setPortfolioName(e.target.value)}
              disabled={!!selectedPortfolioId}
              className="h-11"
            />
          </div>
        </div>

        <div className="space-y-4">
          <Label className="font-semibold">Holdings</Label>
          <AnimatePresence>
            {holdings.map((holding, index) => (
              <motion.div
                key={index}
                layout
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="grid grid-cols-12 gap-3 items-center p-4 bg-white/50 rounded-xl border"
              >
                <div className="col-span-12 md:col-span-2 space-y-1">
                  <Label htmlFor={`symbol-${index}`} className="text-xs">Symbol</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      id={`symbol-${index}`}
                      placeholder="AAPL"
                      value={holding.symbol}
                      onChange={(e) => handleHoldingChange(index, "symbol", e.target.value.toUpperCase())}
                      className="h-9"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleFetchStockData(index)}
                      disabled={fetchingIndex === index || !holding.symbol}
                      className="h-9 w-9 flex-shrink-0"
                    >
                      {fetchingIndex === index ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="col-span-12 md:col-span-3 space-y-1">
                  <Label htmlFor={`name-${index}`} className="text-xs">Name</Label>
                  <Input
                    id={`name-${index}`}
                    placeholder="Apple Inc."
                    value={holding.name}
                    onChange={(e) => handleHoldingChange(index, "name", e.target.value)}
                    readOnly={true}
                    className="h-9 bg-gray-100"
                  />
                </div>
                <div className="col-span-6 md:col-span-2 space-y-1">
                  <Label htmlFor={`shares-${index}`} className="text-xs">Shares</Label>
                  <Input
                    id={`shares-${index}`}
                    type="number"
                    placeholder="10"
                    value={holding.shares}
                    onChange={(e) => handleHoldingChange(index, "shares", e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="col-span-6 md:col-span-2 space-y-1">
                  <Label htmlFor={`price-${index}`} className="text-xs">Price</Label>
                  <Input
                    id={`price-${index}`}
                    type="number"
                    placeholder="150.00"
                    value={holding.price}
                    onChange={(e) => handleHoldingChange(index, "price", e.target.value)}
                    readOnly={true}
                    className="h-9 bg-gray-100"
                  />
                </div>
                <div className="col-span-10 md:col-span-2 space-y-1">
                  <Label htmlFor={`category-${index}`} className="text-xs">Category</Label>
                  <Select
                    value={holding.category}
                    onValueChange={(value) => handleHoldingChange(index, "category", value)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="stocks">Stocks</SelectItem>
                      <SelectItem value="etfs">ETFs</SelectItem>
                      <SelectItem value="bonds">Bonds</SelectItem>
                      <SelectItem value="crypto">Crypto</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 md:col-span-1 flex items-end h-full">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeHolding(index)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="flex justify-between items-center">
          <Button onClick={addHolding} variant="outline" className="gap-2">
            <Plus className="w-4 h-4" />
            Add Holding
          </Button>
          <div className="text-lg font-semibold">
            Total Value: ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <Button
          onClick={savePortfolio}
          disabled={isSaving || (holdings.length === 0) || (!selectedPortfolioId && !portfolioName)}
          className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 gap-2"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving Portfolio...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Portfolio
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
