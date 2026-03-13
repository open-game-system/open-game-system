
import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface FeatureCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  delay?: number;
  className?: string;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ 
  title, 
  description, 
  icon,
  delay = 0,
  className = '' 
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            setIsVisible(true);
          }, delay);
          observer.unobserve(entry.target);
        }
      },
      {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
      }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, [delay]);

  return (
    <div 
      ref={ref}
      className={cn(
        "p-6 rounded-xl border border-border bg-card shadow-sm transition-all duration-500",
        "hover:shadow-md hover:border-primary/50 hover:translate-y-[-4px]",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10", 
        className
      )}
    >
      <div className="mb-4 p-3 bg-primary/10 rounded-lg w-fit">
        {icon}
      </div>
      <h3 className="text-xl font-semibold mb-2 font-orbitron">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
};

export default FeatureCard;
