import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, addDays, isSameDay, isToday, isBefore, startOfDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { classNames } from '../../utils/helpers';

export function DatePicker({ 
  selectedDate, 
  onDateChange, 
  minDate = new Date(), 
  availability = {}, 
  isLoadingAvailability = false,
  onVisibleRangeChange = null // Callback when visible date range changes
}) {
  const [startDate, setStartDate] = useState(startOfDay(new Date()));
  const visibleDays = 7;
  const onVisibleRangeChangeRef = useRef(onVisibleRangeChange);
  
  // Keep ref updated
  useEffect(() => {
    onVisibleRangeChangeRef.current = onVisibleRangeChange;
  }, [onVisibleRangeChange]);

  const dates = Array.from({ length: visibleDays }, (_, i) => addDays(startDate, i));

  // Notify parent when visible range changes
  useEffect(() => {
    if (onVisibleRangeChangeRef.current) {
      const endDate = addDays(startDate, visibleDays - 1);
      onVisibleRangeChangeRef.current(startDate, endDate);
    }
  }, [startDate, visibleDays]);

  const handlePrev = () => {
    const newDate = addDays(startDate, -7);
    if (!isBefore(newDate, startOfDay(minDate))) {
      setStartDate(newDate);
    }
  };

  const handleNext = () => {
    setStartDate(addDays(startDate, 7));
  };

  const canGoPrev = !isBefore(startDate, startOfDay(minDate));

  // Check if a date has availability
  const getDateAvailability = (date) => {
    const dateString = format(date, 'yyyy-MM-dd');
    return availability[dateString];
  };

  return (
    <div className="bg-dark-800 border border-white/5 rounded-2xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-white">
            {format(startDate, 'MMMM yyyy')}
          </h3>
          {isLoadingAvailability && (
            <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handlePrev}
            disabled={!canGoPrev}
            className={classNames(
              'p-2 rounded-lg transition-colors',
              canGoPrev
                ? 'hover:bg-white/10 text-gray-400 hover:text-white'
                : 'text-gray-600 cursor-not-allowed'
            )}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={handleNext}
            className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-4 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
          <span className="text-gray-400">Available</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-500"></div>
          <span className="text-gray-400">Fully Booked</span>
        </div>
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 gap-2">
        {dates.map((date) => {
          const isSelected = selectedDate && isSameDay(date, selectedDate);
          const isPast = isBefore(date, startOfDay(new Date()));
          const isCurrentDay = isToday(date);
          const dateAvailability = getDateAvailability(date);
          const hasAvailability = dateAvailability?.hasAvailability;
          const slotCount = Array.isArray(dateAvailability?.availableSlots) 
            ? dateAvailability.availableSlots.length 
            : (dateAvailability?.availableSlots || 0);
          const isLoaded = dateAvailability !== undefined;

          return (
            <motion.button
              key={date.toISOString()}
              whileHover={{ scale: isPast ? 1 : 1.05 }}
              whileTap={{ scale: isPast ? 1 : 0.95 }}
              onClick={() => !isPast && onDateChange(date)}
              disabled={isPast}
              className={classNames(
                'relative flex flex-col items-center py-3 px-2 rounded-xl transition-all',
                isSelected
                  ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white'
                  : isPast
                  ? 'text-gray-600 cursor-not-allowed'
                  : isLoaded && !hasAvailability
                  ? 'text-gray-500 bg-red-500/10 cursor-not-allowed opacity-60'
                  : isLoaded && hasAvailability
                  ? 'hover:bg-emerald-500/20 text-gray-300 border border-emerald-500/30'
                  : 'hover:bg-white/10 text-gray-300',
                isCurrentDay && !isSelected && 'ring-2 ring-cyan-500/50'
              )}
            >
              <span className="text-xs font-medium uppercase mb-1">
                {format(date, 'EEE')}
              </span>
              <span className={classNames(
                'text-lg font-semibold',
                isSelected ? 'text-white' : ''
              )}>
                {format(date, 'd')}
              </span>
              
              {/* Availability indicator */}
              {!isPast && isLoaded && (
                <div className="mt-1">
                  {hasAvailability ? (
                    <span className="text-[10px] text-emerald-400 font-medium">
                      {slotCount} slot{slotCount !== 1 ? 's' : ''}
                    </span>
                  ) : (
                    <span className="text-[10px] text-red-400 font-medium">
                      Full
                    </span>
                  )}
                </div>
              )}
              
              {/* Availability dot indicator */}
              {!isPast && isLoaded && !isSelected && (
                <div className={classNames(
                  'absolute top-1 right-1 w-2 h-2 rounded-full',
                  hasAvailability ? 'bg-emerald-500' : 'bg-red-500'
                )} />
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

export function MiniCalendar({ selectedDate, onDateChange, availableDates = [] }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const daysInMonth = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth() + 1,
    0
  ).getDate();

  const firstDayOfMonth = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth(),
    1
  ).getDay();

  const days = Array.from({ length: daysInMonth }, (_, i) => 
    new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i + 1)
  );

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  return (
    <div className="bg-dark-800 border border-white/5 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-1 hover:bg-white/10 rounded-lg">
          <ChevronLeft className="w-5 h-5 text-gray-400" />
        </button>
        <span className="text-white font-medium">
          {format(currentMonth, 'MMMM yyyy')}
        </span>
        <button onClick={nextMonth} className="p-1 hover:bg-white/10 rounded-lg">
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
          <div key={day} className="text-xs text-gray-500 py-1">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDayOfMonth }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {days.map((date) => {
          const isSelected = selectedDate && isSameDay(date, selectedDate);
          const isPast = isBefore(date, startOfDay(new Date()));
          const isAvailable = availableDates.some(d => isSameDay(new Date(d), date));

          return (
            <button
              key={date.toISOString()}
              onClick={() => !isPast && onDateChange(date)}
              disabled={isPast}
              className={classNames(
                'aspect-square rounded-lg text-sm transition-all',
                isSelected
                  ? 'bg-cyan-500 text-white font-semibold'
                  : isPast
                  ? 'text-gray-600 cursor-not-allowed'
                  : isAvailable
                  ? 'text-emerald-400 hover:bg-emerald-500/20'
                  : 'text-gray-400 hover:bg-white/10',
                isToday(date) && !isSelected && 'ring-1 ring-cyan-500'
              )}
            >
              {format(date, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
}
