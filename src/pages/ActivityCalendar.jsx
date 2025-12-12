import React, { useMemo } from "react";

const ActivityCalendar = ({ submissions }) => {
  if (!submissions || submissions.length === 0) {
    return (
      <div className="text-center py-8 text-[#656d76] dark:text-[#7d8590] bg-white dark:bg-[#0d1117] rounded-lg border border-[#d0d7de] dark:border-[#30363d]">
        No submission activity in the last 6 months.
      </div>
    );
  }

  const today = new Date();
  const startDate = new Date();
  startDate.setMonth(today.getMonth() - 6);

  // Align grid start to Sunday before startDate
  const gridStart = new Date(startDate);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());

  // Align grid end to Saturday after today
  const gridEnd = new Date(today);
  gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()));

  // Map submission counts per date
  const countsMap = useMemo(() => {
    const map = new Map();
    submissions.forEach((s) => {
      const d = new Date(s.timestamp);
      const dateStr = d.toISOString().split("T")[0];
      map.set(dateStr, (map.get(dateStr) || 0) + 1);
    });
    return map;
  }, [submissions]);

  // Build all days from start to end
  const allDays = useMemo(() => {
    const days = [];
    const cur = new Date(gridStart);
    while (cur <= gridEnd) {
      const dateStr = cur.toISOString().split("T")[0];
      days.push({
        date: new Date(cur),
        dateStr,
        count: countsMap.get(dateStr) || 0,
        dayOfMonth: cur.getDate(),
      });
      cur.setDate(cur.getDate() + 1);
    }
    return days;
  }, [gridStart, gridEnd, countsMap]);

  // Group into weeks
  const weeks = useMemo(() => {
    const arr = [];
    for (let i = 0; i < allDays.length; i += 7) {
      arr.push(allDays.slice(i, i + 7));
    }
    return arr;
  }, [allDays]);

  // Month labels - show label on the first week of each month
  const monthLabels = useMemo(() => {
    const labels = [];
    const seenMonths = new Set();
    
    weeks.forEach((week, weekIndex) => {
      for (const day of week) {
        const monthYear = `${day.date.getFullYear()}-${day.date.getMonth()}`;
        if (!seenMonths.has(monthYear)) {
          seenMonths.add(monthYear);
          labels.push({
            weekIndex: weekIndex,
            label: day.date.toLocaleString("default", { month: "short" }),
          });
          break;
        }
      }
    });
    
    return labels;
  }, [weeks]);

  // Color scale matching GitHub's exact colors
  const getColor = (count) => {
    if (count === 0) return "bg-[#ebedf0] dark:bg-[#161b22]";
    if (count <= 2) return "bg-[#9be9a8] dark:bg-[#0e4429]";
    if (count <= 4) return "bg-[#40c463] dark:bg-[#006d32]";
    if (count <= 6) return "bg-[#30a14e] dark:bg-[#26a641]";
    return "bg-[#216e39] dark:bg-[#39d353]";
  };

  const cellSize = 32;
  const cellGap = 4;
  const weekWidth = cellSize + cellGap;

  return (
    <div className="w-full overflow-x-auto bg-white dark:bg-[#0d1117] rounded-lg border border-[#d0d7de] dark:border-[#30363d] p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <h3 className="text-lg font-semibold text-[#1f2328] dark:text-[#e6edf3]">
          {submissions.length} submissions in the last 6 months
        </h3>
        <div className="flex items-center gap-2 text-sm text-[#656d76] dark:text-[#7d8590]">
          <span>Less</span>
          {[0, 2, 4, 6, 8].map((v, i) => (
            <div key={i} className={`w-3 h-3 rounded-sm ${getColor(v)} border border-[rgba(27,31,36,0.06)] dark:border-transparent`} />
          ))}
          <span>More</span>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Day labels */}
        <div 
          className="hidden sm:flex flex-col text-xs text-[#656d76] dark:text-[#7d8590]" 
          style={{ 
            paddingTop: '24px',
            gap: `${cellGap}px`
          }}
        >
          <div style={{ height: `${cellSize}px` }} className="flex items-center leading-none">Sun</div>
          <div style={{ height: `${cellSize}px` }} className="flex items-center leading-none">Mon</div>
          <div style={{ height: `${cellSize}px` }} className="flex items-center leading-none">Tue</div>
          <div style={{ height: `${cellSize}px` }} className="flex items-center leading-none">Wed</div>
          <div style={{ height: `${cellSize}px` }} className="flex items-center leading-none">Thu</div>
          <div style={{ height: `${cellSize}px` }} className="flex items-center leading-none">Fri</div>
          <div style={{ height: `${cellSize}px` }} className="flex items-center leading-none">Sat</div>
        </div>

        {/* Grid section */}
        <div className="flex-1 min-w-0">
          {/* Month labels */}
          <div 
            className="relative text-xs font-medium text-[#656d76] dark:text-[#7d8590] mb-2" 
            style={{ height: '20px' }}
          >
            {monthLabels.map(({ weekIndex, label }) => (
              <span
                key={`${weekIndex}-${label}`}
                className="absolute whitespace-nowrap"
                style={{
                  left: `${weekIndex * weekWidth}px`,
                }}
              >
                {label}
              </span>
            ))}
          </div>

          {/* Weekly columns */}
          <div 
            className="flex overflow-x-auto pb-2" 
            style={{ gap: `${cellGap}px` }}
          >
            {weeks.map((week, i) => (
              <div 
                key={i} 
                className="flex flex-col flex-shrink-0" 
                style={{ gap: `${cellGap}px` }}
              >
                {week.map((day, j) => {
                  const isToday = day.dateStr === today.toISOString().split("T")[0];
                  const hasSubmissions = day.count > 0;
                  
                  return (
                    <div
                      key={j}
                      title={`${day.date.toLocaleDateString("en-US", { 
                        weekday: "short", 
                        month: "short", 
                        day: "numeric", 
                        year: "numeric" 
                      })}: ${day.count} submission${day.count === 1 ? "" : "s"}`}
                      className={`rounded-md ${getColor(
                        day.count
                      )} ${isToday ? "ring-2 ring-[#0969da] dark:ring-[#58a6ff]" : ""} cursor-pointer transition-all duration-100 hover:ring-2 hover:ring-[#656d76] dark:hover:ring-[#7d8590] hover:scale-105 border border-[rgba(27,31,36,0.06)] dark:border-transparent relative flex flex-col items-center justify-center`}
                      style={{
                        width: `${cellSize}px`,
                        height: `${cellSize}px`,
                      }}
                    >
                      {/* Day number */}
                      <span className={`text-[10px] font-semibold leading-none ${hasSubmissions ? 'text-white' : 'text-[#656d76] dark:text-[#7d8590]'}`}>
                        {day.dayOfMonth}
                      </span>
                      
                      {/* Submission count */}
                      {hasSubmissions && (
                        <span className="text-[8px] font-bold text-white mt-0.5 leading-none">
                          ({day.count})
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-4 text-sm text-[#656d76] dark:text-[#7d8590]">
        Hover over a day to see full details
      </p>
    </div>
  );
};

export default ActivityCalendar;