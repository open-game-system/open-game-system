import React from 'react';

interface NavBarLogoProps {
  className?: string;
}

const NavBarLogo: React.FC<NavBarLogoProps> = ({ className = "" }) => {
  return (
    <img 
      src="/logo.svg" 
      alt="Open Game System Logo Icon" 
      className={className}
    />
  );
};

export default NavBarLogo; 