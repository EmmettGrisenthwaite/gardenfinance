import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CreditCard, Edit, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

export default function DebtList({ debts, onEditDebt }) {
  const getDebtTypeIcon = (type) => {
    switch (type) {
      case 'credit_card': return '💳';
      case 'student_loan': return '🎓';
      case 'personal_loan': return '💼';
      case 'auto_loan': return '🚗';
      default: return '📄';
    }
  };

  const getDebtTypeColor = (type) => {
    switch (type) {
      case 'credit_card': return 'bg-red-50 text-red-700 border-red-200';
      case 'student_loan': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'personal_loan': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'auto_loan': return 'bg-green-50 text-green-700 border-green-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getRiskLevel = (rate) => {
    if (rate >= 20) return { level: 'High Risk', color: 'bg-red-50 text-red-700 border-red-200' };
    if (rate >= 10) return { level: 'Medium Risk', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' };
    return { level: 'Low Risk', color: 'bg-green-50 text-green-700 border-green-200' };
  };

  if (debts.length === 0) {
    return (
      <Card className="glassmorphism border-0 shadow-lg">
        <CardContent className="text-center py-12 space-y-4">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto">
            <CreditCard className="w-10 h-10 text-red-600" />
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-gray-900">No debts tracked yet</h3>
            <p className="text-gray-500 text-sm max-w-md mx-auto">
              Start by adding your debts to get AI-powered payoff strategies and track your progress toward financial freedom.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {debts.map((debt, index) => {
        const risk = getRiskLevel(debt.interest_rate);
        const payoffProgress = debt.current_payment > debt.minimum_payment ? 
          ((debt.current_payment - debt.minimum_payment) / debt.current_payment) * 100 : 0;

        return (
          <motion.div
            key={debt.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.1 }}
          >
            <Card className="glassmorphism border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="border-b border-gray-100">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-white rounded-2xl border-2 border-gray-100 flex items-center justify-center text-2xl shadow-sm">
                      {getDebtTypeIcon(debt.type)}
                    </div>
                    <div>
                      <CardTitle className="text-xl text-gray-900">{debt.name}</CardTitle>
                      <div className="flex gap-2 mt-2">
                        <Badge className={`${getDebtTypeColor(debt.type)} border`} variant="outline">
                          {debt.type.replace('_', ' ').toUpperCase()}
                        </Badge>
                        <Badge className={`${risk.color} border`} variant="outline">
                          {risk.level}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => onEditDebt(debt)}
                    className="rounded-xl hover:bg-gray-50"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium text-gray-500 mb-1">Outstanding Balance</p>
                      <p className="text-3xl font-bold text-red-600">${debt.balance.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500 mb-1">Interest Rate</p>
                      <div className="flex items-center gap-2">
                        <p className="text-2xl font-bold text-gray-900">{debt.interest_rate}%</p>
                        {debt.interest_rate >= 15 && <AlertCircle className="w-5 h-5 text-orange-500" />}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium text-gray-500 mb-1">Minimum Payment</p>
                      <p className="text-xl font-semibold text-orange-600">${debt.minimum_payment.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500 mb-1">Current Payment</p>
                      <div className="flex items-center gap-2">
                        <p className="text-xl font-semibold text-gray-900">
                          ${(debt.current_payment || debt.minimum_payment).toLocaleString()}
                        </p>
                        {(debt.current_payment || 0) > debt.minimum_payment && (
                          <Badge className="bg-green-50 text-green-700 border-green-200">
                            Extra ${((debt.current_payment || debt.minimum_payment) - debt.minimum_payment).toLocaleString()}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {payoffProgress > 0 && (
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <p className="text-sm font-medium text-gray-500">Accelerated Payoff</p>
                          <p className="text-sm font-semibold text-green-600">{Math.round(payoffProgress)}% faster</p>
                        </div>
                        <Progress value={payoffProgress} className="h-2" />
                      </div>
                    )}
                    
                    {debt.interest_rate >= 18 && (
                      <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-orange-600 mt-0.5" />
                          <div>
                            <p className="text-xs font-semibold text-orange-800">High Interest Alert</p>
                            <p className="text-xs text-orange-700 mt-1">
                              Consider prioritizing this debt or exploring balance transfer options
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}