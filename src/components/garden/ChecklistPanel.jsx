import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ListTodo, Droplets, BookOpen, Scissors, Sprout, TrendingUp } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion, AnimatePresence } from 'framer-motion';

export default function ChecklistPanel({ checklist, onUpdate }) {

  const handleStatusChange = (index, newStatus) => {
    const updatedList = [...checklist];
    updatedList[index].status = newStatus;
    onUpdate(updatedList);
  };

  const categoryMap = {
    Tending: { icon: Sprout, color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
    Planting: { icon: TrendingUp, color: "text-purple-600 bg-purple-50 border-purple-200" },
    Weeding: { icon: Scissors, color: "text-red-600 bg-red-50 border-red-200" },
    Learning: { icon: BookOpen, color: "text-blue-600 bg-blue-50 border-blue-200" },
    Watering: { icon: Droplets, color: "text-yellow-600 bg-yellow-50 border-yellow-200" },
  };

  return (
    <Card className="glassmorphism border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListTodo className="w-6 h-6 text-purple-600" />
          Your Garden Plan
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <AnimatePresence>
            {checklist.map((item, index) => {
              const { icon: Icon, color } = categoryMap[item.category] || categoryMap.Tending;
              return (
                <motion.div
                  key={index}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className={`p-4 rounded-xl border-2 transition-all duration-300 ${
                    item.status === 'Done' ? 'bg-slate-100 border-slate-200 opacity-60' : 'bg-white'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex-1 flex items-start gap-4">
                      <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${color.split(' ').slice(1).join(' ')}`}>
                          <Icon className={`w-5 h-5 ${color.split(' ')[0]}`} />
                      </div>
                      <div className="flex-1">
                        <p className={`font-semibold text-gray-800 ${item.status === 'Done' ? 'line-through' : ''}`}>
                          {item.task}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className={`${color} text-xs`}>{item.category}</Badge>
                          <Badge variant="secondary" className="text-xs">{item.impact}</Badge>
                        </div>
                      </div>
                    </div>

                    <div className="w-full sm:w-40">
                      <Select value={item.status} onValueChange={(value) => handleStatusChange(index, value)}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Set status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="To Do">To Do</SelectItem>
                          <SelectItem value="In Progress">In Progress</SelectItem>
                          <SelectItem value="Done">Done</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  );
}