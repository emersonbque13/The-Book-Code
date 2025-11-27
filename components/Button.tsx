import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'cyber';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md',
  isLoading, 
  className = '', 
  ...props 
}) => {
  
  const sizeStyles = {
    sm: "px-3 py-1 text-xs tracking-wider",
    md: "px-6 py-2 text-sm tracking-widest",
    lg: "px-8 py-4 text-base tracking-widest"
  };

  // Base styles: uppercase, font-orbitron for headings/buttons, sharp transitions
  const baseStyles = `
    relative font-orbitron font-bold uppercase transition-all duration-300 
    flex items-center justify-center gap-2 
    disabled:opacity-50 disabled:cursor-not-allowed
    clip-corner
  `;

  // Additional style block to inject the clip-path directly if needed, or rely on global CSS
  const clipStyle = {
    clipPath: "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)"
  };
  
  const variants = {
    // Cyber Primary: Cyan/Emerald Gradient feel
    primary: "bg-cyan-950 text-cyan-400 border border-cyan-500/50 hover:bg-cyan-900 hover:border-cyan-400 hover:shadow-[0_0_15px_rgba(34,211,238,0.3)]",
    
    // Cyber Secondary: Darker, Slate based
    secondary: "bg-slate-900 text-slate-400 border border-slate-700 hover:bg-slate-800 hover:text-cyan-300 hover:border-cyan-500/30",
    
    // Cyber Danger
    danger: "bg-red-950 text-red-500 border border-red-800 hover:bg-red-900 hover:border-red-500 hover:shadow-[0_0_15px_rgba(239,68,68,0.3)]",
    
    // Ghost
    ghost: "bg-transparent text-slate-500 hover:text-cyan-400 hover:bg-slate-900/50",

    // Special Cyber Action (e.g., Encode)
    cyber: "bg-emerald-950 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-900 hover:border-emerald-400 hover:shadow-[0_0_20px_rgba(52,211,153,0.3)]"
  };

  return (
    <button 
      className={`${baseStyles} ${sizeStyles[size]} ${variants[variant]} ${className}`}
      style={clipStyle}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? (
        <svg className="animate-spin h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      ) : children}
      
      {/* Decorative corner lines for extra tech feel (optional, simplistic approach) */}
    </button>
  );
};