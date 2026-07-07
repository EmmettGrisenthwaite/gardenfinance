import { useState, useRef, useCallback, useEffect } from 'react'

/**
 * Custom accessible slider component (no Radix dependency).
 * Supports keyboard navigation (arrow keys, Home, End).
 */
export default function Slider({ value, onValueChange, min = 0, max = 100, step = 1, className = '' }) {
  const [isDragging, setIsDragging] = useState(false)
  const trackRef = useRef(null)
  const currentValue = value?.[0] ?? min

  const percentage = ((currentValue - min) / (max - min)) * 100

  const updateValueFromPosition = useCallback((clientX) => {
    if (!trackRef.current) return
    const rect = trackRef.current.getBoundingClientRect()
    const raw = ((clientX - rect.left) / rect.width) * (max - min) + min
    const stepped = Math.round(raw / step) * step
    const clamped = Math.max(min, Math.min(max, stepped))
    onValueChange?.([clamped])
  }, [min, max, step, onValueChange])

  const handleMouseDown = (e) => {
    setIsDragging(true)
    updateValueFromPosition(e.clientX)
  }

  const handleTouchStart = (e) => {
    setIsDragging(true)
    updateValueFromPosition(e.touches[0].clientX)
  }

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e) => updateValueFromPosition(e.clientX)
    const handleTouchMove = (e) => updateValueFromPosition(e.touches[0].clientX)
    const handleEnd = () => setIsDragging(false)

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleEnd)
    window.addEventListener('touchmove', handleTouchMove, { passive: false })
    window.addEventListener('touchend', handleEnd)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleEnd)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleEnd)
    }
  }, [isDragging, updateValueFromPosition])

  const handleKeyDown = (e) => {
    const delta = step * (e.shiftKey ? 5 : 1)
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        e.preventDefault()
        onValueChange?.([Math.max(min, currentValue - delta)])
        break
      case 'ArrowRight':
      case 'ArrowUp':
        e.preventDefault()
        onValueChange?.([Math.min(max, currentValue + delta)])
        break
      case 'Home':
        e.preventDefault()
        onValueChange?.([min])
        break
      case 'End':
        e.preventDefault()
        onValueChange?.([max])
        break
    }
  }

  return (
    <div
      ref={trackRef}
      className={`relative h-6 flex items-center cursor-pointer select-none touch-none ${className}`}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      role="slider"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={currentValue}
      aria-valuetext={`${currentValue}`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Track background */}
      <div className="absolute inset-x-0 h-1.5 bg-white/[0.08] rounded-full" />
      {/* Filled track */}
      <div
        className="absolute h-1.5 bg-emerald-500 rounded-full"
        style={{ width: `${percentage}%` }}
      />
      {/* Thumb */}
      <div
        className={`absolute w-5 h-5 rounded-full bg-white border-2 border-emerald-500 shadow-lg transition-transform ${
          isDragging ? 'scale-110' : 'scale-100'
        }`}
        style={{
          left: `${percentage}%`,
          transform: `translateX(-50%) ${isDragging ? 'scale(1.1)' : 'scale(1)'}`,
        }}
      />
    </div>
  )
}
