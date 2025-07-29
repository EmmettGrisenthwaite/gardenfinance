import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sprout, Sun, Droplets } from 'lucide-react';
import { motion } from 'framer-motion';

// --- Animated Background Scene ---
const AnimatedGardenBackground = () => (
  <div className="absolute inset-0 overflow-hidden bg-gradient-to-b from-sky-200 to-sky-100">
    {/* Drifting Clouds */}
    <motion.div
      animate={{ x: [-20, 20, -20] }}
      transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
      className="absolute top-[10%] left-[-5%] w-[110%]"
    >
      <div className="absolute w-32 h-16 bg-white/80 rounded-full top-0 left-[10%]" />
      <div className="absolute w-48 h-24 bg-white/70 rounded-full top-4 left-[30%]" />
      <div className="absolute w-24 h-12 bg-white/80 rounded-full top-2 left-[60%]" />
      <div className="absolute w-40 h-20 bg-white/70 rounded-full top-5 left-[80%]" />
    </motion.div>

    {/* Sun with a gentle glow */}
    <motion.div 
      className="absolute top-[8%] right-[10%] w-16 h-16 bg-yellow-300 rounded-full"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 0.5, duration: 1 }}
    >
       <motion.div 
          className="w-full h-full bg-yellow-300/50 rounded-full"
          animate={{ scale: [1, 1.2, 1]}}
          transition={{ duration: 4, repeat: Infinity }}
        />
    </motion.div>
    
    {/* Wooden Fence */}
    <div className="absolute bottom-[10%] left-0 w-full h-1/4 flex justify-around items-end z-10">
      {Array.from({ length: 15 }).map((_, i) => (
        <div key={i} className="w-4 h-full bg-gradient-to-b from-[#b9936c] to-[#a47d54] rounded-t-md shadow-sm" />
      ))}
      <div className="absolute top-[20%] w-full h-2 bg-[#a47d54]" />
      <div className="absolute top-[50%] w-full h-2 bg-[#a47d54]" />
    </div>

    {/* Grassy Ground with layers */}
    <div className="absolute bottom-0 left-0 w-full h-1/3 bg-gradient-to-t from-green-600 to-green-500 z-0" />
    <div className="absolute bottom-0 left-0 w-full h-1/4 bg-gradient-to-t from-green-500 to-green-400 z-20" />
    <div className="absolute bottom-0 left-0 w-full h-[15%] bg-gradient-to-t from-green-400 to-lime-300 z-30" />
  </div>
);


// --- Enhanced, Crisp Plant Components ---
const plantAnimation = (delay = 0) => ({
  initial: { opacity: 0, scale: 0, y: 50 },
  animate: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 12, delay } },
  exit: { opacity: 0, scale: 0, y: 50, transition: { duration: 0.3 } }
});

const Tree = ({ show, delay }) => (
  show && (
    <motion.div {...plantAnimation(delay)} className="absolute bottom-[18%] left-[12%] w-[22%] h-[42%] z-20">
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[18%] h-[55%] bg-gradient-to-b from-[#8B4513] to-[#654321] rounded-t-lg shadow-md" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[90%] h-[75%] bg-gradient-to-b from-[#228B22] to-[#006400] rounded-full shadow-lg">
        <div className="absolute top-[15%] -left-[20%] w-[60%] h-[60%] bg-gradient-to-br from-[#32CD32] to-[#228B22] rounded-full opacity-90" />
        <div className="absolute top-[10%] -right-[20%] w-[70%] h-[70%] bg-gradient-to-bl from-[#32CD32] to-[#228B22] rounded-full opacity-90" />
      </div>
    </motion.div>
  )
);

const RoseBush = ({ show, delay }) => (
  show && (
    <motion.div {...plantAnimation(delay)} className="absolute bottom-[14%] left-[38%] w-[20%] h-[26%] z-40">
      <div className="absolute bottom-0 w-full h-full bg-gradient-to-t from-[#556B2F] to-[#6B8E23] rounded-t-full shadow-md" />
      {[
        { top: '12%', left: '45%' }, { top: '28%', left: '18%' }, { top: '35%', left: '72%' },
        { top: '52%', left: '38%' }, { top: '58%', left: '12%' }, { top: '62%', left: '78%' }
      ].map((pos, i) => (
        <motion.div
          key={i}
          style={pos}
          className="absolute w-3 h-3 bg-gradient-to-br from-pink-300 to-rose-400 rounded-full shadow-sm border border-white/50"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: delay + (i * 0.1), duration: 0.3 }}
        />
      ))}
    </motion.div>
  )
);

const ConiferTree = ({ show, delay }) => (
  show && (
    <motion.div {...plantAnimation(delay)} className="absolute bottom-[12%] right-[10%] w-[16%] h-[48%] z-20">
      <div className="w-full h-full bg-gradient-to-b from-[#228B22] via-[#006400] to-[#2F4F2F] shadow-lg"
        style={{ clipPath: 'polygon(50% 0%, 15% 100%, 85% 100%)' }} />
    </motion.div>
  )
);

const SmallPlant = ({ show, delay }) => (
  show && (
    <motion.div {...plantAnimation(delay)} className="absolute bottom-[12%] right-[28%] w-[10%] h-[18%] z-40">
      <div className="absolute bottom-0 w-full h-[70%] bg-gradient-to-t from-[#228B22] to-[#32CD32] rounded-t-2xl shadow-md" />
      <motion.div className="absolute -top-1 left-[20%] w-3 h-5 bg-gradient-to-t from-[#32CD32] to-[#90EE90] rounded-full transform -rotate-12 shadow-sm"
        initial={{ rotate: -30, scale: 0 }} animate={{ rotate: -12, scale: 1 }} transition={{ delay: delay + 0.2 }} />
      <motion.div className="absolute -top-1 right-[20%] w-3 h-5 bg-gradient-to-t from-[#32CD32] to-[#90EE90] rounded-full transform rotate-12 shadow-sm"
        initial={{ rotate: 30, scale: 0 }} animate={{ rotate: 12, scale: 1 }} transition={{ delay: delay + 0.3 }} />
    </motion.div>
  )
);

export default function GardenVisual({ progress, checklist = [] }) {
  const progressInt = Math.round(progress);
  
  const completedTasks = checklist.filter(task => task.status === 'Done');
  const debtTasks = completedTasks.filter(task => task.category === 'Weeding').length;
  const savingTasks = completedTasks.filter(task => task.category === 'Watering').length;
  const investingTasks = completedTasks.filter(task => task.category === 'Planting').length;
  const incomeTasks = completedTasks.filter(task => task.category === 'Tending').length;
  const learningTasks = completedTasks.filter(task => task.category === 'Learning').length;

  return (
    <Card className="glassmorphism border-0 shadow-lg overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sprout className="w-6 h-6 text-green-600" />
          Your Financial Garden
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* The Garden Scene */}
        <div className="relative h-96 rounded-2xl overflow-hidden border-2 border-green-100 shadow-inner">
          <AnimatedGardenBackground />
          
          {/* Animated Plants Layer */}
          <Tree show={investingTasks >= 1} delay={0.2} />
          <ConiferTree show={investingTasks >= 2} delay={0.4} />
          <RoseBush show={debtTasks >= 1} delay={0.6} />
          <SmallPlant show={incomeTasks >= 1} delay={0.8} />
        </div>

        {/* Garden Stats */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 text-center">
          <div className="space-y-1 p-3 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-100 shadow-sm">
            <div className="text-xl font-bold text-green-700">{savingTasks}</div>
            <div className="text-xs text-gray-600 font-medium">Savings Tasks</div>
            <Droplets className="w-5 h-5 mx-auto text-blue-500" />
          </div>
          <div className="space-y-1 p-3 bg-gradient-to-br from-rose-50 to-pink-50 rounded-xl border border-rose-100 shadow-sm">
            <div className="text-xl font-bold text-rose-700">{debtTasks}</div>
            <div className="text-xs text-gray-600 font-medium">Debt Weeded</div>
            <div className="text-xl">🌹</div>
          </div>
          <div className="space-y-1 p-3 bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl border border-emerald-100 shadow-sm">
            <div className="text-xl font-bold text-emerald-800">{investingTasks}</div>
            <div className="text-xs text-gray-600 font-medium">Investments Planted</div>
            <div className="text-xl">🌳</div>
          </div>
          <div className="space-y-1 p-3 bg-gradient-to-br from-yellow-50 to-amber-50 rounded-xl border border-yellow-100 shadow-sm">
            <div className="text-xl font-bold text-yellow-800">{incomeTasks}</div>
            <div className="text-xs text-gray-600 font-medium">Income Sources</div>
            <Sun className="w-5 h-5 mx-auto text-yellow-500" />
          </div>
          <div className="space-y-1 p-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100 shadow-sm">
            <div className="text-xl font-bold text-blue-700">{learningTasks}</div>
            <div className="text-xs text-gray-600 font-medium">Skills Learned</div>
            <div className="text-xl">💡</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-6">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-semibold text-gray-700">Overall Garden Growth</span>
            <span className="text-sm font-bold text-green-700 bg-green-50 px-2 py-1 rounded-full">{progressInt}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4 shadow-inner border border-gray-300">
            <motion.div 
              className="bg-gradient-to-r from-green-400 via-emerald-500 to-green-600 h-4 rounded-full shadow-sm relative overflow-hidden" 
              initial={{ width: '0%' }}
              animate={{ width: `${progressInt}%` }}
              transition={{ duration: 2, ease: "easeInOut" }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
            </motion.div>
          </div>
          <p className="text-center text-gray-600 text-sm mt-3 font-medium">
            Your garden is <span className="font-bold text-green-700">{progressInt}%</span> grown! Keep nurturing it! 🌱
          </p>
        </div>
      </CardContent>
    </Card>
  );
}