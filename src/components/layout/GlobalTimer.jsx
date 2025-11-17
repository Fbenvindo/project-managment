
import { useContext, useState, useEffect } from 'react';
import { ActivityTimerContext } from "@/components/contexts/ActivityTimerContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Square, Pause, Loader2, Maximize, Minimize } from "lucide-react";

// Helper component to display the timer, introduced by the outline
const TimerDisplay = ({ startTime }) => {
  const [elapsedTime, setElapsedTime] = useState('00:00:00');

  useEffect(() => {
    if (!startTime) {
      setElapsedTime('00:00:00');
      return;
    }

    const interval = setInterval(() => {
      const now = new Date();
      const start = new Date(startTime);
      const diffInSeconds = Math.floor((now.getTime() - start.getTime()) / 1000);

      const hours = String(Math.floor(diffInSeconds / 3600)).padStart(2, '0');
      const minutes = String(Math.floor((diffInSeconds % 3600) / 60)).padStart(2, '0');
      const seconds = String(diffInSeconds % 60).padStart(2, '0');

      setElapsedTime(`${hours}:${minutes}:${seconds}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  return <span>{elapsedTime}</span>;
};

export default function GlobalTimer() {
  const {
    activeExecution,
    finishExecution,
    pauseExecution,
    isFinishing,
    isPausing,
  } = useContext(ActivityTimerContext);

  const [isMinimized, setIsMinimized] = useState(true);

  if (!activeExecution) {
    return null;
  }

  const handleStop = async () => {
    // **CORREÇÃO CRÍTICA**: Adicionado `await` para garantir que a execução seja finalizada antes de qualquer outra ação.
    await finishExecution();
  };

  const handlePause = async () => {
    // **CORREÇÃO CRÍTICA**: Adicionado `await` para garantir que a execução seja pausada antes de qualquer outra ação.
    await pauseExecution();
  };

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  if (isMinimized) {
    return (
      <Card className="fixed bottom-6 left-6 z-50 p-2 shadow-lg bg-white/80 backdrop-blur-sm border-gray-200">
        <div className="flex items-center gap-2">
          <TimerDisplay startTime={activeExecution.inicio} />
          <Button size="icon" className="w-8 h-8 bg-red-500 hover:bg-red-600" onClick={handleStop} disabled={isFinishing || isPausing}>
            {isFinishing ? <Loader2 className="animate-spin w-4 h-4" /> : <Square className="w-4 h-4" />}
          </Button>
          <Button size="icon" variant="outline" className="w-8 h-8" onClick={handlePause} disabled={isFinishing || isPausing}>
            {isPausing ? <Loader2 className="animate-spin w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </Button>
          <Button size="icon" variant="ghost" className="w-8 h-8" onClick={toggleMinimize}>
            <Maximize className="w-4 h-4 text-gray-500" />
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="fixed bottom-6 left-6 z-50 p-4 shadow-lg bg-white/90 backdrop-blur-md border-gray-200 w-96">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-bold text-base text-gray-800">Atividade em Andamento</h3>
          <p className="text-sm text-gray-600 truncate mt-1" title={activeExecution.descritivo}>
            {activeExecution.descritivo}
          </p>
        </div>
        <Button size="icon" variant="ghost" className="w-8 h-8" onClick={toggleMinimize}>
          <Minimize className="w-4 h-4 text-gray-500" />
        </Button>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-2xl font-mono font-semibold text-blue-600 tabular-nums">
          <TimerDisplay startTime={activeExecution.inicio} />
        </div>
        <div className="flex items-center gap-2">
          <Button className="bg-red-500 hover:bg-red-600" onClick={handleStop} disabled={isFinishing || isPausing}>
            {isFinishing ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Square className="w-4 h-4 mr-2" />}
            Finalizar
          </Button>
          <Button variant="outline" onClick={handlePause} disabled={isFinishing || isPausing}>
            {isPausing ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Pause className="w-4 h-4 mr-2" />}
            Pausar
          </Button>
        </div>
      </div>
    </Card>
  );
}
