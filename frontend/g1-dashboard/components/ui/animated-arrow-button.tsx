import React from 'react';
import { cn } from "@/lib/utils";

interface AnimatedArrowButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  text: string;
}

export const AnimatedArrowButton = React.forwardRef<HTMLButtonElement, AnimatedArrowButtonProps>(
  ({ className, text, ...props }, ref) => {
    return (
      <button 
        ref={ref}
        className={cn(
          "group relative inline-block cursor-pointer outline-none border-0 bg-transparent p-0 w-[18rem] h-auto", 
          className
        )} 
        {...props}
      >
        <span className="relative block m-0 w-[3rem] h-[3rem] bg-primary rounded-[1.625rem] transition-all duration-[450ms] ease-[cubic-bezier(0.65,0,0.076,1)] group-hover:w-full">
          <span className="absolute top-0 bottom-0 m-auto left-[0.625rem] w-[1.125rem] h-[0.125rem] bg-transparent transition-all duration-[450ms] ease-[cubic-bezier(0.65,0,0.076,1)] group-hover:bg-primary-foreground group-hover:translate-x-[1rem]">
            <span className="absolute -top-[0.29rem] right-[0.0625rem] w-[0.625rem] h-[0.625rem] border-t-[0.125rem] border-r-[0.125rem] border-primary-foreground rotate-45" />
          </span>
        </span>
        <span className="absolute top-0 left-0 right-0 bottom-0 py-[0.75rem] m-0 ml-[1.85rem] text-foreground font-bold leading-[1.6] text-center uppercase tracking-wider transition-all duration-[450ms] ease-[cubic-bezier(0.65,0,0.076,1)] group-hover:text-primary-foreground">
          {text}
        </span>
      </button>
    );
  }
);

AnimatedArrowButton.displayName = "AnimatedArrowButton";
