import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Check, X, Loader2, Wifi } from 'lucide-react';
import { formatTime, classNames } from '../../utils/helpers';
import { SlotSkeleton } from '../ui/Skeleton';

export function SlotGrid({ 
  slots = [], 
  selectedSlot, 
  onSlotSelect, 
  isLoading = false,
  isConnected = false 
}) {
  if (isLoading) {
    return <SlotSkeleton />;
  }

  if (!slots.length) {
    return (
      <div className="text-center py-12">
        <Clock className="w-12 h-12 text-gray-600 mx-auto mb-4" />
        <p className="text-gray-400">No available slots for this date</p>
        <p className="text-gray-500 text-sm mt-1">Try selecting a different date</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Connection indicator */}
      <div className="flex items-center gap-2 text-sm">
        <div className={classNames(
          'w-2 h-2 rounded-full',
          isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'
        )} />
        <span className={isConnected ? 'text-emerald-400' : 'text-gray-500'}>
          {isConnected ? 'Live updates enabled' : 'Connecting...'}
        </span>
      </div>

      {/* Slots grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
        <AnimatePresence mode="popLayout">
          {slots.map((slot) => {
            // Slots from API are available by default unless marked otherwise
            const isSlotAvailable = slot.available !== false && slot.isAvailable !== false;
            return (
              <SlotButton
                key={`${slot.startTime}-${slot.endTime}`}
                slot={slot}
                isSelected={selectedSlot?.startTime === slot.startTime}
                onSelect={() => isSlotAvailable && onSlotSelect(slot)}
              />
            );
          })}
        </AnimatePresence>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 pt-4 border-t border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-emerald-500/20 border border-emerald-500/50" />
          <span className="text-xs text-gray-400">Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-dark-700 border border-white/10" />
          <span className="text-xs text-gray-400">Taken</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-cyan-500/20 border border-cyan-500" />
          <span className="text-xs text-gray-400">Selected</span>
        </div>
      </div>
    </div>
  );
}

function SlotButton({ slot, isSelected, onSelect }) {
  // Slots returned from API are available by default (unavailable slots are filtered out)
  // Check for explicit `available` or `isAvailable` property, default to true
  const isAvailable = slot.available !== false && slot.isAvailable !== false;

  return (
    <motion.button
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
      whileHover={isAvailable ? { scale: 1.05 } : {}}
      whileTap={isAvailable ? { scale: 0.95 } : {}}
      onClick={onSelect}
      disabled={!isAvailable}
      className={classNames(
        'relative flex flex-col items-center justify-center py-3 px-2 rounded-xl border-2 transition-all',
        isSelected
          ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 ring-2 ring-cyan-500/30'
          : isAvailable
          ? 'bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-400 cursor-pointer'
          : 'bg-dark-700 border-white/5 text-gray-500 cursor-not-allowed opacity-60'
      )}
    >
      {/* Status icon */}
      {isSelected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-cyan-500 rounded-full flex items-center justify-center"
        >
          <Check className="w-3 h-3 text-white" />
        </motion.div>
      )}

      {!isAvailable && (
        <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-dark-600 rounded-full flex items-center justify-center border border-white/10">
          <X className="w-3 h-3 text-gray-500" />
        </div>
      )}

      <span className="text-sm font-medium">{formatTime(slot.startTime)}</span>
      {slot.endTime && (
        <span className="text-xs opacity-70">{formatTime(slot.endTime)}</span>
      )}
    </motion.button>
  );
}

export function TimelineSlots({ slots = [], selectedSlot, onSlotSelect, isLoading }) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="skeleton h-16 rounded-xl" />
        ))}
      </div>
    );
  }

  // Group slots by hour
  const groupedSlots = slots.reduce((acc, slot) => {
    const hour = slot.startTime.split(':')[0];
    if (!acc[hour]) acc[hour] = [];
    acc[hour].push(slot);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {Object.entries(groupedSlots).map(([hour, hourSlots]) => (
        <div key={hour} className="flex gap-4">
          <div className="w-16 flex-shrink-0">
            <span className="text-sm text-gray-400">
              {formatTime(`${hour}:00`)}
            </span>
          </div>
          <div className="flex-1 flex gap-2 flex-wrap">
            {hourSlots.map((slot) => (
              <motion.button
                key={slot.startTime}
                whileHover={slot.available ? { scale: 1.02 } : {}}
                whileTap={slot.available ? { scale: 0.98 } : {}}
                onClick={() => slot.available && onSlotSelect(slot)}
                disabled={!slot.available}
                className={classNames(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  selectedSlot?.startTime === slot.startTime
                    ? 'bg-cyan-500 text-white'
                    : slot.available
                    ? 'bg-dark-700 text-gray-300 hover:bg-dark-600'
                    : 'bg-dark-800 text-gray-600 cursor-not-allowed line-through'
                )}
              >
                {formatTime(slot.startTime)}
              </motion.button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
