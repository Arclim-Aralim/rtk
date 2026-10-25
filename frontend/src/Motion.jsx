import { motion, useReducedMotion } from "motion/react";

export function RevealSection(props) {
  const reduced = useReducedMotion();
  return (
    <motion.section
      initial={{ opacity: 0, y: reduced ? 0 : 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.05 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      {...props}
    />
  );
}

export function MetricCard({ index, ...props }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: reduced ? 0 : 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: reduced ? 0 : index * 0.06, duration: 0.5 }}
      whileHover={
        reduced ? undefined : { y: -3, transition: { duration: 0.5, delay: 0 } }
      }
      {...props}
    />
  );
}
