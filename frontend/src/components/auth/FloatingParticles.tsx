'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Heart, MessageCircle, Camera, Star, ThumbsUp, Send, Image as ImageIcon, Smile } from 'lucide-react';

const icons = [Heart, MessageCircle, Camera, Star, ThumbsUp, Send, ImageIcon, Smile];

interface Particle {
  id: number;
  Icon: (typeof icons)[number];
  x: number;       // % from left
  size: number;     // px
  duration: number; // seconds for full float
  delay: number;    // seconds
  opacity: number;
}

function generateParticles(count: number): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    particles.push({
      id: i,
      Icon: icons[i % icons.length],
      x: Math.random() * 100,
      size: 14 + Math.random() * 16,
      duration: 12 + Math.random() * 18,
      delay: Math.random() * 10,
      opacity: 0.06 + Math.random() * 0.1,
    });
  }
  return particles;
}

export default function FloatingParticles() {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    setParticles(generateParticles(20));
  }, []);

  if (particles.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute text-white"
          style={{ left: `${p.x}%`, opacity: p.opacity }}
          initial={{ y: '110vh', rotate: 0 }}
          animate={{ y: '-10vh', rotate: 360 }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'linear',
          }}
        >
          <p.Icon style={{ width: p.size, height: p.size }} />
        </motion.div>
      ))}
    </div>
  );
}
