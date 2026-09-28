import React, { Fragment } from 'react';
import { motion, useReducedMotion } from 'motion/react';


export const EASE = [0.22, 1, 0.36, 1];


export function Reveal({ children, delay = 0, y = 60, className, style, once = true, amount = 0.25 }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      style={style}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, amount }}
      transition={{ duration: 0.9, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}


const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 60, scale: 0.94 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.7, ease: EASE } },
};

export function Stagger({ children, className, style, amount = 0.2 }) {
  return (
    <motion.div
      className={className}
      style={style}
      variants={listVariants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount }}
    >
      {children}
    </motion.div>
  );
}

export function Item({ children, className, style, ...props }) {
  return (
    <motion.div className={className} style={style} variants={itemVariants} {...props}>
      {children}
    </motion.div>
  );
}
