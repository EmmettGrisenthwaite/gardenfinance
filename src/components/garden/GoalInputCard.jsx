import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from "date-fns";
import { Sprout, Calendar as CalendarIcon, Loader2 } from 'lucide-react';

export default function GoalInputCard({ goal, setGoal, onGeneratePlan, isGenerating, hasPlan }) {
  return (
    <Card className="glassmorphism border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sprout className="w-6 h-6 text-green-600" />
          Set Your Garden Goal
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="target-amount">What's your target amount?</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
            <Input
              id="target-amount"
              type="number"
              value={goal.amount}
              onChange={(e) => setGoal({ ...goal, amount: parseInt(e.target.value) || 0 })}
              placeholder="200,000"
              className="pl-7"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="goal-type">What does this goal represent?</Label>
          <Select value={goal.type} onValueChange={(value) => setGoal({ ...goal, type: value })}>
            <SelectTrigger id="goal-type">
              <SelectValue placeholder="Select goal type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Net Worth">Net Worth</SelectItem>
              <SelectItem value="Investment Portfolio">Investment Portfolio</SelectItem>
              <SelectItem value="Cash Savings">Cash Savings</SelectItem>
              <SelectItem value="FIRE Number">FIRE Number</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>By when?</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className="w-full justify-start text-left font-normal"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {goal.byDate ? format(goal.byDate, "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={goal.byDate}
                onSelect={(date) => setGoal({ ...goal, byDate: date })}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
        <Button
          onClick={onGeneratePlan}
          disabled={isGenerating}
          className="w-full bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600"
        >
          {isGenerating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sprout className="mr-2 h-4 w-4" />
          )}
          {hasPlan ? 'Update Plan' : 'Generate Plan'}
        </Button>
      </CardContent>
    </Card>
  );
}