import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SDKCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  delay?: number;
  className?: string;
  href?: string;
}

const SDKCard: React.FC<SDKCardProps> = ({ 
  title, 
  description, 
  icon,
  delay = 0,
  className = '',
  href = '#'
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

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
        "p-6 rounded-xl border border-border bg-card shadow-sm transition-all duration-500 relative overflow-hidden group",
        "hover:shadow-md hover:border-primary/50",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10", 
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div 
        className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"
      />
      <div className="relative z-10">
        <div className="mb-4 p-3 bg-primary/10 rounded-lg w-fit">
          {icon}
        </div>
        <h3 className="text-xl font-semibold mb-2 font-orbitron">{title}</h3>
        <p className="text-muted-foreground mb-4">{description}</p>
        <a 
          href={href} 
          className="inline-flex items-center text-primary hover:text-primary/80 transition-colors"
        >
          Learn more 
          <ArrowRight className={`ml-2 h-4 w-4 transition-transform duration-300 ${isHovered ? 'translate-x-1' : ''}`} />
        </a>
      </div>
    </div>
  );
};

export default SDKCard;
