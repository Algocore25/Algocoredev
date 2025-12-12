const PROCESS_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
  '#FF9FF3', '#54A0FF', '#5F27CD', '#00D2D3', '#FF9F43',
  '#FF6348', '#2ED573', '#3742FA', '#2F3542', '#57606F'
];

function getProcessColor(processId) {
  return PROCESS_COLORS[processId % PROCESS_COLORS.length];
}

export function runSchedulingAlgorithm(algorithm, processes, timeQuantum = 2) {
  switch (algorithm) {
    case 'fcfs':
      return fcfsScheduling(processes);
    case 'sjf':
      return sjfScheduling(processes);
    case 'srtf':
      return srtfScheduling(processes);
    case 'rr':
      return roundRobinScheduling(processes, timeQuantum);
    case 'priority':
      return priorityScheduling(processes);
    case 'multilevel':
      return multilevelQueueScheduling(processes);
    default:
      return fcfsScheduling(processes);
  }
}

export function fcfsScheduling(processes) {
  const sortedProcesses = [...processes].sort((a, b) => a.arrivalTime - b.arrivalTime);
  const ganttChart = [];
  let currentTime = 0;
  
  const result = sortedProcesses.map(process => {
    const startTime = Math.max(currentTime, process.arrivalTime);
    const completionTime = startTime + process.burstTime;
    
    ganttChart.push({
      processId: process.id,
      processName: process.name,
      startTime,
      endTime: completionTime,
      color: getProcessColor(process.id)
    });
    
    currentTime = completionTime;
    
    return {
      ...process,
      startTime,
      completionTime,
      turnaroundTime: completionTime - process.arrivalTime,
      waitingTime: startTime - process.arrivalTime,
      responseTime: startTime - process.arrivalTime
    };
  });
  
  return calculateMetrics(result, ganttChart);
}

export function sjfScheduling(processes) {
  const remainingProcesses = [...processes];
  const ganttChart = [];
  const completed = [];
  let currentTime = 0;
  
  while (remainingProcesses.length > 0) {
    const available = remainingProcesses.filter(p => p.arrivalTime <= currentTime);
    
    if (available.length === 0) {
      currentTime = Math.min(...remainingProcesses.map(p => p.arrivalTime));
      continue;
    }
    
    const shortest = available.reduce((min, current) => 
      current.burstTime < min.burstTime ? current : min
    );
    
    const startTime = currentTime;
    const completionTime = currentTime + shortest.burstTime;
    
    ganttChart.push({
      processId: shortest.id,
      processName: shortest.name,
      startTime,
      endTime: completionTime,
      color: getProcessColor(shortest.id)
    });
    
    completed.push({
      ...shortest,
      startTime,
      completionTime,
      turnaroundTime: completionTime - shortest.arrivalTime,
      waitingTime: startTime - shortest.arrivalTime,
      responseTime: startTime - shortest.arrivalTime
    });
    
    currentTime = completionTime;
    remainingProcesses.splice(remainingProcesses.indexOf(shortest), 1);
  }
  
  return calculateMetrics(completed, ganttChart);
}

export function srtfScheduling(processes) {
  const processQueue = processes.map(p => ({ ...p, remainingTime: p.burstTime }));
  const ganttChart = [];
  const completed = [];
  let currentTime = 0;
  let currentProcess = null;
  
  while (processQueue.some(p => p.remainingTime > 0)) {
    const available = processQueue.filter(p => p.arrivalTime <= currentTime && p.remainingTime > 0);
    
    if (available.length === 0) {
      currentTime++;
      continue;
    }
    
    const shortest = available.reduce((min, current) => 
      current.remainingTime < min.remainingTime ? current : min
    );
    
    if (!currentProcess || currentProcess.id !== shortest.id) {
      if (currentProcess) {
        ganttChart[ganttChart.length - 1].endTime = currentTime;
      }
      
      ganttChart.push({
        processId: shortest.id,
        processName: shortest.name,
        startTime: currentTime,
        endTime: currentTime + 1,
        color: getProcessColor(shortest.id)
      });
      
      if (!shortest.startTime && shortest.startTime !== 0) {
        shortest.startTime = currentTime;
      }
      
      currentProcess = shortest;
    } else {
      ganttChart[ganttChart.length - 1].endTime = currentTime + 1;
    }
    
    shortest.remainingTime--;
    currentTime++;
    
    if (shortest.remainingTime === 0) {
      shortest.completionTime = currentTime;
      shortest.turnaroundTime = shortest.completionTime - shortest.arrivalTime;
      shortest.waitingTime = shortest.turnaroundTime - shortest.burstTime;
      shortest.responseTime = shortest.startTime - shortest.arrivalTime;
      completed.push(shortest);
    }
  }
  
  return calculateMetrics(completed, mergeGanttChart(ganttChart));
}

export function roundRobinScheduling(processes, timeQuantum) {
  const processQueue = processes.map(p => ({ ...p, remainingTime: p.burstTime }));
  const readyQueue = [];
  const ganttChart = [];
  const completed = [];
  let currentTime = 0;
  let processIndex = 0;
  
  // Add initial processes to ready queue
  while (processIndex < processQueue.length && processQueue[processIndex].arrivalTime <= currentTime) {
    readyQueue.push(processQueue[processIndex]);
    processIndex++;
  }
  
  while (readyQueue.length > 0 || processIndex < processQueue.length) {
    if (readyQueue.length === 0) {
      currentTime = processQueue[processIndex].arrivalTime;
      readyQueue.push(processQueue[processIndex]);
      processIndex++;
    }
    
    const currentProcess = readyQueue.shift();
    const executionTime = Math.min(timeQuantum, currentProcess.remainingTime);
    
    if (!currentProcess.startTime && currentProcess.startTime !== 0) {
      currentProcess.startTime = currentTime;
    }
    
    ganttChart.push({
      processId: currentProcess.id,
      processName: currentProcess.name,
      startTime: currentTime,
      endTime: currentTime + executionTime,
      color: getProcessColor(currentProcess.id)
    });
    
    currentTime += executionTime;
    currentProcess.remainingTime -= executionTime;
    
    // Add newly arrived processes
    while (processIndex < processQueue.length && processQueue[processIndex].arrivalTime <= currentTime) {
      readyQueue.push(processQueue[processIndex]);
      processIndex++;
    }
    
    if (currentProcess.remainingTime > 0) {
      readyQueue.push(currentProcess);
    } else {
      currentProcess.completionTime = currentTime;
      currentProcess.turnaroundTime = currentProcess.completionTime - currentProcess.arrivalTime;
      currentProcess.waitingTime = currentProcess.turnaroundTime - currentProcess.burstTime;
      currentProcess.responseTime = currentProcess.startTime - currentProcess.arrivalTime;
      completed.push(currentProcess);
    }
  }
  
  return calculateMetrics(completed, ganttChart);
}

export function priorityScheduling(processes) {
  const remainingProcesses = [...processes];
  const ganttChart = [];
  const completed = [];
  let currentTime = 0;
  
  while (remainingProcesses.length > 0) {
    const available = remainingProcesses.filter(p => p.arrivalTime <= currentTime);
    
    if (available.length === 0) {
      currentTime = Math.min(...remainingProcesses.map(p => p.arrivalTime));
      continue;
    }
    
    const highestPriority = available.reduce((min, current) => 
      current.priority < min.priority ? current : min
    );
    
    const startTime = currentTime;
    const completionTime = currentTime + highestPriority.burstTime;
    
    ganttChart.push({
      processId: highestPriority.id,
      processName: highestPriority.name,
      startTime,
      endTime: completionTime,
      color: getProcessColor(highestPriority.id)
    });
    
    completed.push({
      ...highestPriority,
      startTime,
      completionTime,
      turnaroundTime: completionTime - highestPriority.arrivalTime,
      waitingTime: startTime - highestPriority.arrivalTime,
      responseTime: startTime - highestPriority.arrivalTime
    });
    
    currentTime = completionTime;
    remainingProcesses.splice(remainingProcesses.indexOf(highestPriority), 1);
  }
  
  return calculateMetrics(completed, ganttChart);
}

export function multilevelQueueScheduling(processes) {
  // Simplified multilevel queue: system processes (priority 1), interactive (priority 2-3), batch (priority 4+)
  const systemQueue = processes.filter(p => p.priority === 1);
  const interactiveQueue = processes.filter(p => p.priority >= 2 && p.priority <= 3);
  const batchQueue = processes.filter(p => p.priority > 3);
  
  let ganttChart = [];
  let completed = [];
  let currentTime = 0;
  
  // Process system queue first (FCFS)
  if (systemQueue.length > 0) {
    const systemResult = fcfsScheduling(systemQueue);
    ganttChart = [...ganttChart, ...systemResult.ganttChart];
    completed = [...completed, ...systemResult.processes];
    currentTime = Math.max(...systemResult.ganttChart.map(g => g.endTime));
  }
  
  // Process interactive queue (Round Robin)
  if (interactiveQueue.length > 0) {
    const adjustedInteractive = interactiveQueue.map(p => ({
      ...p,
      arrivalTime: Math.max(p.arrivalTime, currentTime)
    }));
    const interactiveResult = roundRobinScheduling(adjustedInteractive, 2);
    ganttChart = [...ganttChart, ...interactiveResult.ganttChart];
    completed = [...completed, ...interactiveResult.processes];
    currentTime = Math.max(...interactiveResult.ganttChart.map(g => g.endTime));
  }
  
  // Process batch queue (SJF)
  if (batchQueue.length > 0) {
    const adjustedBatch = batchQueue.map(p => ({
      ...p,
      arrivalTime: Math.max(p.arrivalTime, currentTime)
    }));
    const batchResult = sjfScheduling(adjustedBatch);
    ganttChart = [...ganttChart, ...batchResult.ganttChart];
    completed = [...completed, ...batchResult.processes];
  }
  
  return calculateMetrics(completed, ganttChart);
}

function mergeGanttChart(ganttChart) {
  if (ganttChart.length === 0) return [];
  
  const merged = [];
  let current = { ...ganttChart[0] };
  
  for (let i = 1; i < ganttChart.length; i++) {
    if (ganttChart[i].processId === current.processId && ganttChart[i].startTime === current.endTime) {
      current.endTime = ganttChart[i].endTime;
    } else {
      merged.push(current);
      current = { ...ganttChart[i] };
    }
  }
  
  merged.push(current);
  return merged;
}

function calculateMetrics(processes, ganttChart) {
  const totalWaitingTime = processes.reduce((sum, p) => sum + (p.waitingTime || 0), 0);
  const totalTurnaroundTime = processes.reduce((sum, p) => sum + (p.turnaroundTime || 0), 0);
  const totalResponseTime = processes.reduce((sum, p) => sum + (p.responseTime || 0), 0);
  const totalTime = ganttChart.length > 0 ? Math.max(...ganttChart.map(item => item.endTime)) : 0;
  const totalBurstTime = processes.reduce((sum, p) => sum + p.burstTime, 0);
  
  return {
    ganttChart,
    processes: processes.sort((a, b) => a.id - b.id),
    averageWaitingTime: processes.length > 0 ? totalWaitingTime / processes.length : 0,
    averageTurnaroundTime: processes.length > 0 ? totalTurnaroundTime / processes.length : 0,
    averageResponseTime: processes.length > 0 ? totalResponseTime / processes.length : 0,
    cpuUtilization: totalTime > 0 ? (totalBurstTime / totalTime) * 100 : 0
  };
}