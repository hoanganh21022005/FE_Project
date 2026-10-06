import React, { useEffect, useRef, useState } from 'react';
import { useInView } from 'motion/react';

export function AnimatedCounter({ value, duration = 2, className = '' }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (isInView) {
      let start = null;
      let animationFrame;

      const easeOutQuart = (x) => 1 - Math.pow(1 - x, 4);

      const step = (timestamp) => {
        if (!start) start = timestamp;
        const progress = Math.min((timestamp - start) / (duration * 1000), 1);
        
        const currentVal = Math.floor(easeOutQuart(progress) * value);
        setDisplayValue(currentVal);

        if (progress < 1) {
          animationFrame = requestAnimationFrame(step);
        } else {
          setDisplayValue(value);
        }
      };

      animationFrame = requestAnimationFrame(step);

      return () => cancelAnimationFrame(animationFrame);
    }
  }, [isInView, value, duration]);

  return <span ref={ref} className={className}>{displayValue}</span>;
}
